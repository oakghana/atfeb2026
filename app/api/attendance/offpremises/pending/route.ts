import { createClient } from "@/lib/supabase/server"
import { type NextRequest, NextResponse } from "next/server"

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Verify the user is a department head, regional manager, or admin
    const { data: managerProfile } = await supabase
      .from("user_profiles")
      .select("id, role, department_id, geofence_locations")
      .eq("id", user.id)
      .single()

    if (!managerProfile || !["department_head", "regional_manager", "admin"].includes(managerProfile.role)) {
      return NextResponse.json(
        { error: "Only managers can view pending off-premises requests" },
        { status: 403 }
      )
    }

    // Get pending off-premises check-in requests
    let query = supabase
      .from("pending_offpremises_checkins")
      .select(
        `
        id,
        user_id,
        current_location_name,
        latitude,
        longitude,
        accuracy,
        device_info,
        created_at,
        status,
        user_profiles!pending_offpremises_checkins_user_id_fkey (
          id,
          first_name,
          last_name,
          email,
          department_id,
          geofence_locations
        )
      `
      )
      .eq("status", "pending")
      .order("created_at", { ascending: false })

    // Admins can see all pending requests
    // Regional managers can only see requests from their assigned location
    // Department heads can only see requests from their department
    if (managerProfile.role === "admin") {
      // No filtering for admins
    } else if (managerProfile.role === "regional_manager") {
      // Regional managers can only approve requests from their location
      const { data: locationStaff } = await supabase
        .from("user_profiles")
        .select("id")
        .contains("geofence_locations", managerProfile.geofence_locations || [])

      const staffIds = locationStaff?.map(s => s.id) || []
      if (staffIds.length > 0) {
        query = query.in("user_id", staffIds)
      } else {
        // No staff in this regional manager's location
        return NextResponse.json({
          requests: [],
          count: 0,
        })
      }
    } else if (managerProfile.role === "department_head") {
      // Department heads can only see requests from their department
      query = query.eq("user_profiles.department_id", managerProfile.department_id)
    }

    const { data: pendingRequests, error } = await query

    if (error) {
      console.error("[v0] Failed to fetch pending requests:", error)
      return NextResponse.json(
        { error: "Failed to fetch pending requests" },
        { status: 500 }
      )
    }

    return NextResponse.json({
      requests: pendingRequests || [],
      count: pendingRequests?.length || 0,
    })
  } catch (error) {
    console.error("[v0] Error in pending requests endpoint:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
