import { createAdminClient } from "@/lib/supabase/server"
import { type NextRequest, NextResponse } from "next/server"

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { request_id, approved, comments, user_id } = body

    if (!request_id) {
      return NextResponse.json(
        { error: "Request ID is required" },
        { status: 400 }
      )
    }

    if (!user_id) {
      return NextResponse.json(
        { error: "User ID is required" },
        { status: 400 }
      )
    }

    console.log("[v0] Processing approval:", { request_id, approved, manager_id: user_id })

    const supabase = await createAdminClient()

    // Verify the approver is a department head, regional manager, or admin
    const { data: approverProfile, error: approverError } = await supabase
      .from("user_profiles")
      .select("role, department_id")
      .eq("id", user_id)
      .single()

    if (approverError || !approverProfile) {
      console.error("[v0] Failed to get approver profile:", approverError)
      return NextResponse.json(
        { error: "Approver profile not found" },
        { status: 404 }
      )
    }

    if (!["department_head", "regional_manager", "admin"].includes(approverProfile.role)) {
      console.error("[v0] User not authorized to approve:", approverProfile.role)
      return NextResponse.json(
        { error: "Only managers can approve off-premises check-ins" },
        { status: 403 }
      )
    }

    // Get the pending check-in request with staff details
    const { data: pendingRequest, error: getError } = await supabase
      .from("pending_offpremises_checkins")
      .select(`
        *,
        user_profiles!pending_offpremises_checkins_user_id_fkey (
          id,
          first_name,
          last_name,
          email,
          department_id
        )
      `)
      .eq("id", request_id)
      .single()

    if (getError || !pendingRequest) {
      console.error("[v0] Request not found:", getError)
      return NextResponse.json(
        { error: "Request not found" },
        { status: 404 }
      )
    }

    if (pendingRequest.status !== "pending") {
      console.error("[v0] Request already processed:", pendingRequest.status)
      return NextResponse.json(
        { error: "This request has already been processed" },
        { status: 400 }
      )
    }

    // Permission validation based on role
    if (approverProfile.role === "admin") {
      // Admins can approve all requests
      console.log("[v0] Admin approving request")
    } else if (approverProfile.role === "department_head") {
      // Department heads can only approve requests from staff in their department
      if (pendingRequest.user_profiles?.department_id !== approverProfile.department_id) {
        console.error("[v0] Department head trying to approve outside their department")
        return NextResponse.json(
          { error: "You can only approve requests from staff in your department" },
          { status: 403 }
        )
      }
    }
    // Regional managers can approve all in current setup since we don't have location filtering

    if (approved) {
      console.log("[v0] Approving request and creating check-in")
      
      // Create attendance record for the user
      const { data: attendanceRecord, error: attendanceError } = await supabase
        .from("attendance_records")
        .insert({
          user_id: pendingRequest.user_id,
          check_in_time: new Date().toISOString(),
          actual_location_name: pendingRequest.current_location_name,
          actual_latitude: pendingRequest.latitude,
          actual_longitude: pendingRequest.longitude,
          on_official_duty_outside_premises: true,
          device_info: pendingRequest.device_info,
          check_in_type: "offpremises_confirmed",
          notes: `Off-premises check-in approved by manager. ${comments ? "Comments: " + comments : ""}`,
        })
        .select()
        .single()

      if (attendanceError) {
        console.error("[v0] Failed to create attendance record:", attendanceError)
        // Continue even if notification fails
      }

      // Update pending request status
      const { error: updateError } = await supabase
        .from("pending_offpremises_checkins")
        .update({
          status: "approved",
          approved_by_id: user_id,
          approved_at: new Date().toISOString(),
        })
        .eq("id", request_id)

      if (updateError) {
        console.error("[v0] Failed to update request status:", updateError)
        return NextResponse.json(
          { error: "Failed to update request status" },
          { status: 500 }
        )
      }

      // Send notification to the staff member
      await supabase.from("staff_notifications").insert({
        user_id: pendingRequest.user_id,
        type: "offpremises_checkin_approved",
        title: "Off-Premises Check-In Approved",
        message: `Your off-premises check-in request from ${pendingRequest.google_maps_name || pendingRequest.current_location_name} has been approved. You are checked in to your assigned location on official duty.`,
        data: {
          request_id: request_id,
          attendance_record_id: attendanceRecord?.id,
        },
        is_read: false,
      }).catch((err) => console.warn("[v0] Failed to send approval notification:", err))

      console.log("[v0] Request approved successfully:", request_id)
      
      return NextResponse.json(
        {
          success: true,
          message: "Off-premises check-in approved and staff member has been automatically checked in",
          attendance_record_id: attendanceRecord?.id,
        },
        { status: 200 }
      )
    } else {
      console.log("[v0] Rejecting off-premises check-in request:", request_id)

      // Update pending request status
      const { error: updateError } = await supabase
        .from("pending_offpremises_checkins")
        .update({
          status: "rejected",
          approved_by_id: user_id,
          approved_at: new Date().toISOString(),
          rejection_reason: comments,
        })
        .eq("id", request_id)

      if (updateError) {
        console.error("[v0] Failed to update request status:", updateError)
        return NextResponse.json(
          { error: "Failed to update request status" },
          { status: 500 }
        )
      }

      // Send notification to the staff member
      await supabase.from("staff_notifications").insert({
        user_id: pendingRequest.user_id,
        type: "offpremises_checkin_rejected",
        title: "Off-Premises Check-In Rejected",
        message: `Your off-premises check-in request from ${pendingRequest.google_maps_name || pendingRequest.current_location_name} has been rejected. ${comments ? `Reason: ${comments}` : ""}`,
        data: {
          request_id: request_id,
        },
        is_read: false,
      }).catch((err) => console.warn("[v0] Failed to send rejection notification:", err))

      console.log("[v0] Request rejected successfully:", request_id)

      return NextResponse.json(
        {
          success: true,
          message: "Off-premises check-in request has been rejected",
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
