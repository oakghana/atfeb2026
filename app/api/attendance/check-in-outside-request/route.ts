import { createAdminClient } from "@/lib/supabase/server"
import { type NextRequest, NextResponse } from "next/server"

console.log("[v0] check-in-outside-request route module loaded")

export async function POST(request: NextRequest) {
  console.log("[v0] POST handler invoked for check-in-outside-request")
  
  try {
    console.log("[v0] Off-premises check-in API called")
    
    const body = await request.json()
    console.log("[v0] Request body received:", { location: body.current_location?.name, userId: body.user_id })
    
    const { current_location, device_info, user_id, reason } = body

    if (!current_location) {
      console.error("[v0] Missing current_location")
      return NextResponse.json(
        { error: "Current location is required" },
        { status: 400 }
      )
    }

    if (!user_id) {
      console.error("[v0] Missing user_id")
      return NextResponse.json(
        { error: "User ID is required" },
        { status: 400 }
      )
    }

    console.log("[v0] Creating admin client...")
    const supabase = await createAdminClient()
    console.log("[v0] Admin client created")

    // Get user's direct manager (department head or regional manager they report to)
    const { data: userProfile } = await supabase
      .from("user_profiles")
      .select("department_id, reports_to_id, role, first_name, last_name")
      .eq("id", user_id)
      .single()

    console.log("[v0] User profile:", { userProfile, user_id })

    if (!userProfile) {
      console.error("[v0] User profile not found")
      return NextResponse.json(
        { error: "User profile not found" },
        { status: 404 }
      )
    }

    // Get ALL managers (admins, regional managers, department heads) - no department/location filtering
    console.log("[v0] Looking for all managers (admin, regional_manager, department_head)...")
    const { data: allManagers } = await supabase
      .from("user_profiles")
      .select("id, email, first_name, last_name, role")
      .in("role", ["admin", "regional_manager", "department_head"])
      .eq("is_active", true)
    
    console.log("[v0] Managers found:", { count: allManagers?.length || 0 })

    if (!allManagers || allManagers.length === 0) {
      console.error("[v0] No managers found in the system")
      return NextResponse.json(
        {
          success: false,
          error: "Cannot submit off-premises request: No managers found in the system. Please contact HR.",
          requiresManualApproval: true,
        },
        { status: 400 }
      )
    }

    const managers = allManagers

    // Store the off-premises check-in request for manager approval
    console.log("[v0] Inserting pending check-in:", {
      user_id,
      location_name: current_location.name,
      status: "pending",
    })

    // Insert with only the core required fields first
    const insertPayload: any = {
      user_id,
      current_location_name: current_location.name,
      latitude: current_location.latitude,
      longitude: current_location.longitude,
      accuracy: current_location.accuracy,
      device_info: device_info,
      status: "pending",
    }
    
    // Add optional fields if columns exist
    if (current_location.display_name) {
      insertPayload.google_maps_name = current_location.display_name
    }
    if (reason) {
      insertPayload.reason = reason
    }
    
    console.log("[v0] Insert payload:", insertPayload)
    
    const { data: requestRecord, error: insertError } = await supabase
      .from("pending_offpremises_checkins")
      .insert(insertPayload)
      .select()
      .single()

    console.log("[v0] Insert result:", { insertError, hasData: !!requestRecord, recordId: requestRecord?.id })

    if (insertError) {
      console.error("[v0] Failed to store pending check-in:", {
        message: insertError.message,
        code: insertError.code,
        details: insertError.details,
        hint: insertError.hint,
      })
      return NextResponse.json(
        { 
          success: false,
          error: "Failed to process request: " + insertError.message,
          errorCode: insertError.code,
          errorDetails: insertError.details 
        },
        { status: 500 }
      )
    }

    if (!requestRecord || !requestRecord.id) {
      console.error("[v0] Request stored but no ID returned from database")
      return NextResponse.json(
        { error: "Request was not properly saved - no record returned from database" },
        { status: 500 }
      )
    }

    console.log("[v0] Request stored successfully:", requestRecord.id)

    // CREATE TEMPORARY ATTENDANCE RECORD WITH PENDING APPROVAL STATUS
    const today = new Date().toISOString().split('T')[0]
    const { data: tempAttendanceRecord, error: attendanceError } = await supabase
      .from("attendance_records")
      .insert({
        user_id,
        attendance_date: today,
        check_in_time: new Date().toISOString(),
        location_id: null, // Not at a QCC location
        check_in_latitude: current_location.latitude,
        check_in_longitude: current_location.longitude,
        check_in_location_name: current_location.name,
        status: "present", // Mark as present temporarily
        off_premises_request_id: requestRecord.id,
        approval_status: "pending_supervisor_approval", // KEY: Indicates pending supervisor review
        supervisor_approval_remarks: `Off-premises check-in request submitted at ${new Date().toLocaleTimeString()}. Reason: ${reason || 'Not provided'}. Awaiting supervisor approval.`,
        on_official_duty_outside_premises: false, // Will be set to true if approved
        device_info: device_info,
      })
      .select()
      .single()

    if (attendanceError) {
      console.warn("[v0] Failed to create temporary attendance record:", attendanceError)
      // Log warning but don't fail - the request is still valid
    } else {
      console.log("[v0] Temporary attendance record created:", tempAttendanceRecord?.id)
    }

    console.log("[v0] Request stored successfully:", requestRecord.id)

    // Send notifications to managers
    const managerNotifications = managers.map((manager: any) => ({
      user_id: manager.id,
      type: "offpremises_checkin_request",
      title: "Off-Premises Check-In Request",
      message: `${userProfile.first_name} ${userProfile.last_name} is requesting to check-in from outside their assigned location: ${current_location.display_name || current_location.name}. Reason: ${reason || 'Not provided'}. Please review and approve or deny.`,
      data: {
        request_id: requestRecord.id,
        staff_user_id: user_id,
        staff_name: `${userProfile.first_name} ${userProfile.last_name}`,
        location_name: current_location.name,
        google_maps_name: current_location.display_name || current_location.name,
        coordinates: `${current_location.latitude}, ${current_location.longitude}`,
        reason: reason || 'Not provided',
      },
      is_read: false,
    }))

    const { error: notificationError } = await supabase
      .from("staff_notifications")
      .insert(managerNotifications)

    if (notificationError) {
      console.warn("[v0] Failed to send notifications:", notificationError)
      // Don't fail the request if notifications fail
    }

    return NextResponse.json(
      {
        success: true,
        message: "Your off-premises check-in request has been sent to your managers for approval",
        request_id: requestRecord.id,
        pending_approval: true,
      },
      { status: 200 }
    )
  } catch (error: any) {
    console.error("[v0] Off-premises check-in request error:", {
      message: error?.message,
      code: error?.code,
      name: error?.name,
      stack: error?.stack?.split('\n').slice(0, 3).join('\n'),
    })
    return NextResponse.json(
      { error: error.message || "Failed to process request" },
      { status: 500 }
    )
  }
}
