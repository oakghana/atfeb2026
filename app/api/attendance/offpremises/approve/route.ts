import { createClient } from "@/lib/supabase/server"
import { type NextRequest, NextResponse } from "next/server"

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const { request_id, approved, comments } = body

    if (!request_id) {
      return NextResponse.json(
        { error: "Request ID is required" },
        { status: 400 }
      )
    }

    // Verify the approver is a department head, regional manager, or admin
    const { data: approverProfile } = await supabase
      .from("user_profiles")
      .select("role")
      .eq("id", user.id)
      .single()

    if (!approverProfile || !["department_head", "regional_manager", "admin"].includes(approverProfile.role)) {
      return NextResponse.json(
        { error: "Only managers can approve off-premises check-ins" },
        { status: 403 }
      )
    }

    // Get the pending check-in request
    const { data: pendingRequest } = await supabase
      .from("pending_offpremises_checkins")
      .select("*")
      .eq("id", request_id)
      .single()

    if (!pendingRequest) {
      return NextResponse.json(
        { error: "Request not found" },
        { status: 404 }
      )
    }

    if (approved) {
      // Approve and create automatic check-in
      console.log("[v0] Approving off-premises check-in request:", request_id)

      // Create attendance record for the user's assigned location
      const { data: attendanceRecord, error: attendanceError } = await supabase
        .from("attendance_records")
        .insert({
          user_id: pendingRequest.user_id,
          check_in_time: new Date().toISOString(),
          check_in_location_id: pendingRequest.assigned_location_id,
          geofence_locations: pendingRequest.assigned_location_id,
          actual_location_name: pendingRequest.current_location_name,
          actual_latitude: pendingRequest.latitude,
          actual_longitude: pendingRequest.longitude,
          on_official_duty_outside_premises: true, // Flag indicating they're on duty outside their assigned location
          device_info: pendingRequest.device_info,
          check_in_type: "offpremises_confirmed",
        })
        .select()
        .single()

      if (attendanceError) {
        console.error("[v0] Failed to create attendance record:", attendanceError)
        return NextResponse.json(
          { error: "Failed to create attendance record" },
          { status: 500 }
        )
      }

      // Update pending request status
      await supabase
        .from("pending_offpremises_checkins")
        .update({
          status: "approved",
          approved_by: user.id,
          approved_at: new Date().toISOString(),
          approval_comments: comments,
        })
        .eq("id", request_id)

      // Send notification to the staff member
      await supabase.from("staff_notifications").insert({
        user_id: pendingRequest.user_id,
        type: "offpremises_checkin_approved",
        title: "Off-Premises Check-In Approved",
        message: `Your off-premises check-in request from ${pendingRequest.current_location_name} has been approved. You are checked in to your assigned location on official duty.`,
        data: {
          request_id: request_id,
          attendance_record_id: attendanceRecord.id,
        },
        is_read: false,
      })

      return NextResponse.json(
        {
          success: true,
          message: "Off-premises check-in approved and staff member has been automatically checked in",
          attendance_record_id: attendanceRecord.id,
        },
        { status: 200 }
      )
    } else {
      // Deny the request
      console.log("[v0] Denying off-premises check-in request:", request_id)

      // Update pending request status
      await supabase
        .from("pending_offpremises_checkins")
        .update({
          status: "denied",
          denied_by: user.id,
          denied_at: new Date().toISOString(),
          denial_comments: comments,
        })
        .eq("id", request_id)

      // Send notification to the staff member
      await supabase.from("staff_notifications").insert({
        user_id: pendingRequest.user_id,
        type: "offpremises_checkin_denied",
        title: "Off-Premises Check-In Denied",
        message: `Your off-premises check-in request from ${pendingRequest.current_location_name} has been denied. ${comments ? `Reason: ${comments}` : ""}`,
        data: {
          request_id: request_id,
        },
        is_read: false,
      })

      return NextResponse.json(
        {
          success: true,
          message: "Off-premises check-in request has been denied",
        },
        { status: 200 }
      )
    }
  } catch (error: any) {
    console.error("[v0] Off-premises approval error:", error)
    return NextResponse.json(
      { error: error.message || "Failed to process approval" },
      { status: 500 }
    )
  }
}
