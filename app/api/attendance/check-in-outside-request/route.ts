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
    const { current_location, device_info, assigned_location_id } = body

    if (!current_location) {
      return NextResponse.json(
        { error: "Current location is required" },
        { status: 400 }
      )
    }

    console.log("[v0] Off-premises check-in request:", {
      user_id: user.id,
      location_name: current_location.name,
      coordinates: `${current_location.latitude}, ${current_location.longitude}`,
    })

    // Get user's direct manager (department head or regional manager they report to)
    const { data: userProfile } = await supabase
      .from("user_profiles")
      .select("department_id, reports_to_id, role, first_name, last_name")
      .eq("id", user.id)
      .single()

    if (!userProfile) {
      return NextResponse.json(
        { error: "User profile not found" },
        { status: 404 }
      )
    }

    // Get the specific manager(s) this user reports to
    let managers = []
    
    if (userProfile.reports_to_id) {
      // User has a direct manager assigned
      const { data: directManager } = await supabase
        .from("user_profiles")
        .select("id, email, first_name, last_name, role")
        .eq("id", userProfile.reports_to_id)
        .single()
      
      if (directManager) {
        managers.push(directManager)
      }
    }
    
    // If no direct manager, get all department heads and regional managers in the department
    if (managers.length === 0) {
      const { data: deptManagers } = await supabase
        .from("user_profiles")
        .select("id, email, first_name, last_name, role")
        .in("role", ["department_head", "regional_manager"])
        .eq("department_id", userProfile.department_id)
      
      if (deptManagers && deptManagers.length > 0) {
        managers = deptManagers
      }
    }

    if (managers.length === 0) {
      return NextResponse.json(
        {
          error: "No managers found to approve your request",
          requiresManualApproval: true,
        },
        { status: 400 }
      )
    }

    // Store the off-premises check-in request for manager approval
    const { data: requestRecord, error: insertError } = await supabase
      .from("pending_offpremises_checkins")
      .insert({
        user_id: user.id,
        current_location_name: current_location.name,
        latitude: current_location.latitude,
        longitude: current_location.longitude,
        accuracy: current_location.accuracy,
        device_info: device_info,
        status: "pending",
      })
      .select()
      .single()

    if (insertError) {
      console.error("[v0] Failed to store pending check-in:", insertError)
      return NextResponse.json(
        { error: "Failed to process request" },
        { status: 500 }
      )
    }

    // Send notifications to managers
    const managerNotifications = managers.map((manager: any) => ({
      user_id: manager.id,
      type: "offpremises_checkin_request",
      title: "Off-Premises Check-In Request",
      message: `${userProfile.first_name} ${userProfile.last_name} is requesting to check-in from outside their assigned location: ${current_location.name}. Please approve or deny.`,
      data: {
        request_id: requestRecord.id,
        staff_user_id: user.id,
        staff_name: `${userProfile.first_name} ${userProfile.last_name}`,
        location_name: current_location.name,
        coordinates: `${current_location.latitude}, ${current_location.longitude}`,
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
    console.error("[v0] Off-premises check-in request error:", error)
    return NextResponse.json(
      { error: error.message || "Failed to process request" },
      { status: 500 }
    )
  }
}
