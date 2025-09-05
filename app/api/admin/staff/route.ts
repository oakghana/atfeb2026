import { type NextRequest, NextResponse } from "next/server"

function createJsonResponse(data: any, status = 200) {
  return new NextResponse(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-cache",
    },
  })
}

export async function GET(request: NextRequest) {
  try {
    console.log("[v0] Staff API - Starting GET request")

    const startTime = Date.now()

    let createClient
    try {
      const supabaseModule = await import("@/lib/supabase/server")
      createClient = supabaseModule.createClient
    } catch (importError) {
      console.error("[v0] Staff API - Import error:", importError)
      return createJsonResponse(
        {
          success: false,
          error: "Server configuration error",
          data: [],
        },
        500,
      )
    }

    let supabase
    try {
      supabase = await createClient()
    } catch (clientError) {
      console.error("[v0] Staff API - Client creation error:", clientError)
      return createJsonResponse(
        {
          success: false,
          error: "Database connection error",
          data: [],
        },
        500,
      )
    }

    // Get authenticated user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      console.error("[v0] Staff API - Auth error:", authError)
      return createJsonResponse({ success: false, error: "Authentication required", data: [] }, { status: 401 })
    }

    console.log("[v0] Staff API - User authenticated:", user.id)

    const { data: staff, error: staffError } = await supabase
      .from("user_profiles")
      .select(`
        id,
        employee_id,
        first_name,
        last_name,
        email,
        phone,
        department_id,
        position,
        role,
        hire_date,
        is_active,
        assigned_location_id,
        profile_image_url,
        created_at,
        updated_at
      `)
      .order("created_at", { ascending: false })

    if (staffError) {
      console.error("[v0] Staff API - Query error:", staffError)
      return createJsonResponse({ success: false, error: "Failed to fetch staff", data: [] }, { status: 500 })
    }

    const departmentIds = [...new Set(staff?.map((s) => s.department_id).filter(Boolean))]
    const locationIds = [...new Set(staff?.map((s) => s.assigned_location_id).filter(Boolean))]

    const [departmentsResult, locationsResult] = await Promise.all([
      departmentIds.length > 0
        ? supabase.from("departments").select("id, name, code").in("id", departmentIds)
        : { data: [], error: null },
      locationIds.length > 0
        ? supabase.from("geofence_locations").select("id, name, address").in("id", locationIds)
        : { data: [], error: null },
    ])

    const departmentsMap = new Map(departmentsResult.data?.map((d) => [d.id, d]) || [])
    const locationsMap = new Map(locationsResult.data?.map((l) => [l.id, l]) || [])

    const enrichedStaff =
      staff?.map((staffMember) => ({
        ...staffMember,
        departments: staffMember.department_id ? departmentsMap.get(staffMember.department_id) || null : null,
        geofence_locations: staffMember.assigned_location_id
          ? locationsMap.get(staffMember.assigned_location_id) || null
          : null,
      })) || []

    console.log("[v0] Staff API - Fetched", enrichedStaff.length, "staff members")
    console.log("[v0] Staff API - Response time:", Date.now() - startTime, "ms")

    return createJsonResponse({
      success: true,
      data: enrichedStaff,
      message: "Staff fetched successfully",
    })
  } catch (error) {
    console.error("[v0] Staff API - Unexpected error:", error)
    return createJsonResponse(
      {
        success: false,
        error: "Internal server error",
        data: [],
        details: error instanceof Error ? error.message : "Unknown error",
      },
      500,
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    console.log("[v0] Staff API - Starting POST request")

    let createClient
    try {
      const supabaseModule = await import("@/lib/supabase/server")
      createClient = supabaseModule.createClient
    } catch (importError) {
      console.error("[v0] Staff API POST - Import error:", importError)
      return createJsonResponse(
        {
          success: false,
          error: "Server configuration error",
        },
        500,
      )
    }

    let supabase
    try {
      supabase = await createClient()
    } catch (clientError) {
      console.error("[v0] Staff API POST - Client creation error:", clientError)
      return createJsonResponse(
        {
          success: false,
          error: "Database connection error",
        },
        500,
      )
    }

    // Get authenticated user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return createJsonResponse({ success: false, error: "Authentication required" }, { status: 401 })
    }

    // Check admin permissions
    const { data: profile } = await supabase.from("user_profiles").select("role").eq("id", user.id).single()

    if (!profile || profile.role !== "admin") {
      return createJsonResponse({ success: false, error: "Admin access required" }, { status: 403 })
    }

    const body = await request.json()
    const { email, first_name, last_name, employee_id, department_id, position, role, assigned_location_id, password } =
      body

    const { data: authUser, error: authCreateError } = await supabase.auth.admin.createUser({
      email,
      password: password || "TempPassword123!", // Default password if not provided
      email_confirm: true, // Auto-confirm email for admin-created users
      user_metadata: {
        first_name,
        last_name,
        employee_id,
      },
    })

    if (authCreateError) {
      console.error("[v0] Staff API - Auth user creation error:", authCreateError)
      return createJsonResponse({ success: false, error: "Failed to create user account" }, { status: 400 })
    }

    const { data: newProfile, error: insertError } = await supabase
      .from("user_profiles")
      .insert({
        id: authUser.user.id, // Use the auth user ID
        email,
        first_name,
        last_name,
        employee_id,
        department_id: department_id || null,
        assigned_location_id: assigned_location_id || null,
        position: position || null,
        role: role || "staff",
        is_active: true,
      })
      .select(`
        *,
        departments:department_id(id, name, code),
        geofence_locations:assigned_location_id(id, name, address)
      `)
      .single()

    if (insertError) {
      console.error("[v0] Staff API - Profile insert error:", insertError)
      // Clean up auth user if profile creation fails
      await supabase.auth.admin.deleteUser(authUser.user.id)
      return createJsonResponse({ success: false, error: "Failed to create staff profile" }, { status: 400 })
    }

    console.log("[v0] Staff API - Staff member created successfully")
    return createJsonResponse(
      {
        success: true,
        data: newProfile,
        message: "Staff member created successfully",
      },
      201,
    )
  } catch (error) {
    console.error("[v0] Staff API POST - Unexpected error:", error)
    return createJsonResponse(
      {
        success: false,
        error: "Internal server error",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      500,
    )
  }
}

export async function OPTIONS() {
  return createJsonResponse({ message: "Method allowed" })
}
