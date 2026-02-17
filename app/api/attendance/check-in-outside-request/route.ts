import { createAdminClient } from "@/lib/supabase/server"
import { type NextRequest, NextResponse } from "next/server"

export async function POST(request: NextRequest) {
  try {
    console.log("[v0] Off-premises check-in API called")
    
    const body = await request.json()
    console.log("[v0] Request body received:", { user_id: body.user_id, location: body.current_location?.name })
    
    const { current_location, device_info, user_id } = body

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

    // Get the specific manager(s) this user reports to
    let managers = []
    
    if (userProfile.reports_to_id) {
      // User has a direct manager assigned
      console.log("[v0] Looking for direct manager:", userProfile.reports_to_id)
      const { data: directManager } = await supabase
        .from("user_profiles")
        .select("id, email, first_name, last_name, role")
        .eq("id", userProfile.reports_to_id)
        .single()
      
      console.log("[v0] Direct manager result:", directManager)
      if (directManager) {
        managers.push(directManager)
      }
    }
    
    // If no direct manager, get all department heads and regional managers in the department
    if (managers.length === 0) {
      console.log("[v0] No direct manager, looking for department managers in:", userProfile.department_id)
      const { data: deptManagers } = await supabase
        .from("user_profiles")
        .select("id, email, first_name, last_name, role")
        .in("role", ["department_head", "regional_manager"])
        .eq("department_id", userProfile.department_id)
      
      console.log("[v0] Department managers result:", { count: deptManagers?.length || 0, managers: deptManagers })
      if (deptManagers && deptManagers.length > 0) {
        managers = deptManagers
      }
    }

    console.log("[v0] Final managers found:", { count: managers.length, managers })

    if (managers.length === 0) {
      console.error("[v0] No managers found for user")
      return NextResponse.json(
        {
          error: "No managers found to approve your request",
          requiresManualApproval: true,
        },
        { status: 400 }
      )
    }

    // Store the off-premises check-in request for manager approval
    console.log("[v0] Inserting pending check-in:", {
      user_id,
      location_name: current_location.name,
      status: "pending",
    })

    const { data: requestRecord, error: insertError } = await supabase
      .from("pending_offpremises_checkins")
      .insert({
        user_id,
        current_location_name: current_location.name,
        latitude: current_location.latitude,
        longitude: current_location.longitude,
        accuracy: current_location.accuracy,
        device_info: device_info,
        status: "pending",
      })
      .select()
      .single()

    console.log("[v0] Insert result:", { insertError, hasData: !!requestRecord })

    if (insertError) {
      console.error("[v0] Failed to store pending check-in:", insertError)
      return NextResponse.json(
        { error: "Failed to process request: " + insertError.message },
        { status: 500 }
      )
    }

    console.log("[v0] Request stored successfully:", requestRecord.id)

    // Send notifications to managers
    const managerNotifications = managers.map((manager: any) => ({
      user_id: manager.id,
      type: "offpremises_checkin_request",
      title: "Off-Premises Check-In Request",
      message: `${userProfile.first_name} ${userProfile.last_name} is requesting to check-in from outside their assigned location: ${current_location.name}. Please approve or deny.`,
      data: {
        request_id: requestRecord.id,
        staff_user_id: user_id,
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
