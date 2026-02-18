import { createClient } from "@/lib/supabase/server"
import { type NextRequest, NextResponse } from "next/server"

export async function GET(request: NextRequest) {
  try {
    console.log("[v0] Fetching approved off-premises records")
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
      .select("id, role, department_id")
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
        { error: "Only managers can view approved off-premises records" },
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
        google_maps_name,
        latitude,
        longitude,
        created_at,
        approved_at,
        approved_by_id,
        status,
        user_profiles!pending_offpremises_checkins_user_id_fkey (
          id,
          first_name,
          last_name,
          email,
          department_id,
          departments!user_profiles_department_id_fkey (
            id,
            name
          )
        )
      `,
        { count: "exact" }
      )
      .eq("status", "approved")
      .order("approved_at", { ascending: false })

    // Apply role-based filtering
    if (managerProfile.role === "admin") {
      console.log("[v0] Admin - showing all approved records")
    } else if (managerProfile.role === "regional_manager") {
      console.log("[v0] Regional manager - showing all approved records")
    } else if (managerProfile.role === "department_head") {
      console.log("[v0] Department head - filtering by department:", managerProfile.department_id)
      // Get staff IDs for this department first
      const { data: deptStaff, error: staffError } = await supabase
        .from("user_profiles")
        .select("id")
        .eq("department_id", managerProfile.department_id)

      if (staffError) {
        console.error("[v0] Error fetching department staff:", staffError)
      }

      const staffIds = deptStaff?.map(s => s.id) || []
      if (staffIds.length > 0) {
        query = query.in("user_id", staffIds)
      } else {
        console.log("[v0] No staff found for department")
        return NextResponse.json({
          records: [],
          profile: managerProfile,
          count: 0,
        })
      }
    }

    const { data: records, error: fetchError, count } = await query

    console.log("[v0] Fetch result:", { count, recordCount: records?.length || 0, error: fetchError?.message })

    if (fetchError) {
      console.error("[v0] Fetch error:", fetchError)
      return NextResponse.json(
        { error: "Failed to fetch approved records" },
        { status: 500 }
      )
    }

    return NextResponse.json({
      records: records || [],
      profile: managerProfile,
      count: count || 0,
    })
  } catch (error) {
    console.error("[v0] Unexpected error:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
