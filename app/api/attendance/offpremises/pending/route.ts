import { createClient } from "@/lib/supabase/server"
import { type NextRequest, NextResponse } from "next/server"

export async function GET(request: NextRequest) {
  try {
    console.log("[v0] Fetching pending off-premises requests")
    const supabase = await createClient()

    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError) {
      console.error("[v0] Auth error:", authError.message)
    }

    if (!user) {
      console.log("[v0] No authenticated user found - returning 401")
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    console.log("[v0] Authenticated user:", user.id)

    // Get user profile to verify permissions
    const { data: managerProfile, error: profileError } = await supabase
      .from("user_profiles")
      .select("id, role, department_id, geofence_locations")
      .eq("id", user.id)
      .maybeSingle()

    if (profileError) {
      console.error("[v0] Error fetching manager profile:", profileError)
      return NextResponse.json(
        { error: "Failed to fetch user profile" },
        { status: 500 }
      )
    }

    if (!managerProfile) {
      console.log("[v0] User profile not found")
      return NextResponse.json(
        { error: "User profile not found" },
        { status: 404 }
      )
    }

    if (!["department_head", "regional_manager", "admin"].includes(managerProfile.role)) {
      console.log("[v0] User not authorized - role:", managerProfile.role)
      return NextResponse.json(
        { error: "Only managers can view pending off-premises requests" },
        { status: 403 }
      )
    }

    console.log("[v0] Manager authorized:", managerProfile.role)

    // Build query based on role
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

    // Apply role-based filtering
    if (managerProfile.role === "admin") {
      // Admins see all requests
      console.log("[v0] Admin - showing all requests")
    } else if (managerProfile.role === "regional_manager") {
      // Regional managers see requests from their location staff
      console.log("[v0] Regional manager - filtering by location")
      const { data: locationStaff, error: staffError } = await supabase
        .from("user_profiles")
        .select("id")
        .contains("geofence_locations", managerProfile.geofence_locations || [])

      if (staffError) {
        console.error("[v0] Error fetching location staff:", staffError)
      }

      const staffIds = locationStaff?.map(s => s.id) || []
      if (staffIds.length > 0) {
        query = query.in("user_id", staffIds)
      } else {
        console.log("[v0] No staff found for regional manager's location")
        return NextResponse.json({
          requests: [],
          count: 0,
        })
      }
    } else if (managerProfile.role === "department_head") {
      // Department heads see requests from their department
      console.log("[v0] Department head - filtering by department:", managerProfile.department_id)
      query = query.eq("user_profiles.department_id", managerProfile.department_id)
    }

    const { data: pendingRequests, error } = await query

    if (error) {
      console.error("[v0] Failed to fetch pending requests:", error)
      return NextResponse.json(
        { error: "Failed to fetch pending requests", details: error.message },
        { status: 500 }
      )
    }

    const count = pendingRequests?.length || 0
    console.log("[v0] Pending requests found:", count)

    return NextResponse.json({
      requests: pendingRequests || [],
      count,
    })
  } catch (error) {
    console.error("[v0] Error in pending requests endpoint:", error)
    return NextResponse.json(
      { error: "Internal server error", details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    )
  }
}
