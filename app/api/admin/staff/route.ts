import { type NextRequest, NextResponse } from "next/server"
import crypto from "crypto"

export async function GET(request: NextRequest) {
  try {
    // Always return JSON with proper headers
    const headers = {
      "Content-Type": "application/json",
      "Cache-Control": "no-cache",
    }

    console.log("[v0] Staff API - Starting GET request")

    // Dynamic import to avoid module loading issues
    const { createClient } = await import("@/lib/supabase/server")

    let supabase
    try {
      supabase = await createClient()
      console.log("[v0] Staff API - Supabase client created")
    } catch (error) {
      console.error("[v0] Staff API - Supabase client error:", error)
      return NextResponse.json(
        { success: false, error: "Database connection failed", data: [] },
        { status: 500, headers },
      )
    }

    // Get authenticated user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      console.error("[v0] Staff API - Auth error:", authError)
      return NextResponse.json({ success: false, error: "Authentication required", data: [] }, { status: 401, headers })
    }

    console.log("[v0] Staff API - User authenticated:", user.id)

    // Simple query without complex joins
    const { data: staff, error: staffError } = await supabase
      .from("user_profiles")
      .select("*")
      .order("created_at", { ascending: false })

    if (staffError) {
      console.error("[v0] Staff API - Query error:", staffError)
      return NextResponse.json({ success: false, error: "Failed to fetch staff", data: [] }, { status: 500, headers })
    }

    console.log("[v0] Staff API - Fetched", staff?.length || 0, "staff members")

    // Get departments separately to avoid join issues
    const { data: departments } = await supabase.from("departments").select("*")

    const { data: locations } = await supabase
      .from("geofence_locations")
      .select("id, name, address")
      .eq("is_active", true)

    // Enrich staff data with department info and location info
    const enrichedStaff = (staff || []).map((member) => ({
      ...member,
      departments: departments?.find((dept) => dept.id === member.department_id) || null,
      assigned_location: locations?.find((loc) => loc.id === member.assigned_location_id) || null,
    }))

    console.log("[v0] Staff API - Returning success response")
    return NextResponse.json(
      {
        success: true,
        data: enrichedStaff,
        message: "Staff fetched successfully",
      },
      { status: 200, headers },
    )
  } catch (error) {
    console.error("[v0] Staff API - Unexpected error:", error)
    return NextResponse.json(
      {
        success: false,
        error: "Internal server error",
        data: [],
        details: error instanceof Error ? error.message : "Unknown error",
      },
      {
        status: 500,
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": "no-cache",
        },
      },
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const headers = {
      "Content-Type": "application/json",
      "Cache-Control": "no-cache",
    }

    console.log("[v0] Staff API - Starting POST request")

    const { createClient } = await import("@/lib/supabase/server")
    const supabase = await createClient()

    // Get authenticated user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ success: false, error: "Authentication required" }, { status: 401, headers })
    }

    // Check admin permissions
    const { data: profile } = await supabase.from("user_profiles").select("role").eq("id", user.id).single()

    if (!profile || profile.role !== "admin") {
      return NextResponse.json({ success: false, error: "Admin access required" }, { status: 403, headers })
    }

    const body = await request.json()
    const { email, first_name, last_name, employee_id, department_id, position, role, assigned_location_id } = body

    // Create user profile
    const { data: newProfile, error: insertError } = await supabase
      .from("user_profiles")
      .insert({
        id: crypto.randomUUID(),
        email,
        first_name,
        last_name,
        employee_id,
        department_id: department_id || null,
        position: position || null,
        role: role || "staff",
        assigned_location_id: assigned_location_id && assigned_location_id !== "none" ? assigned_location_id : null,
        is_active: false,
        created_at: new Date().toISOString(),
      })
      .select()
      .single()

    if (insertError) {
      console.error("[v0] Staff API - Insert error:", insertError)
      return NextResponse.json({ success: false, error: "Failed to create staff member" }, { status: 400, headers })
    }

    console.log("[v0] Staff API - Staff member created successfully")
    return NextResponse.json(
      {
        success: true,
        data: newProfile,
        message: "Staff member created successfully",
      },
      { status: 201, headers },
    )
  } catch (error) {
    console.error("[v0] Staff API POST - Unexpected error:", error)
    return NextResponse.json(
      {
        success: false,
        error: "Internal server error",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      {
        status: 500,
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": "no-cache",
        },
      },
    )
  }
}
