import { type NextRequest, NextResponse } from "next/server"

function createJsonResponse(data: any, status = 200) {
  return new NextResponse(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-cache, no-store, must-revalidate, private",
      Pragma: "no-cache",
      Expires: "0",
      "X-Content-Type-Options": "nosniff",
      "X-Frame-Options": "DENY",
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
      return createJsonResponse({ success: false, error: "Authentication required", data: [] }, 401)
    }

    console.log("[v0] Staff API - User authenticated:", user.id)

    const searchParams = request.nextUrl.searchParams
    const searchTerm = searchParams.get("search")
    const departmentFilter = searchParams.get("department")
    const roleFilter = searchParams.get("role")
    const sortBy = searchParams.get("sortBy") || "created_at"
    const sortOrder = searchParams.get("sortOrder") || "desc"

    console.log("[v0] Staff API - Filters:", { searchTerm, departmentFilter, roleFilter, sortBy, sortOrder })

    let query = supabase.from("user_profiles").select(`
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

    if (departmentFilter && departmentFilter !== "all") {
      query = query.eq("department_id", departmentFilter)
    }

    if (roleFilter && roleFilter !== "all") {
      query = query.eq("role", roleFilter)
    }

    const orderColumn = sortBy === "department" ? "department_id" : sortBy === "role" ? "role" : "created_at"
    const ascending = sortOrder === "asc"

    // Execute query
    const { data: staff, error: staffError } = await query.order(orderColumn, { ascending })

    if (staffError) {
      console.error("[v0] Staff API - Query error:", staffError)
      return createJsonResponse({ success: false, error: "Failed to fetch staff", data: [] }, 500)
    }

    let filteredStaff = staff || []
    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase()
      filteredStaff = filteredStaff.filter(
        (member) =>
          member.first_name?.toLowerCase().includes(searchLower) ||
          member.last_name?.toLowerCase().includes(searchLower) ||
          member.email?.toLowerCase().includes(searchLower) ||
          member.employee_id?.toLowerCase().includes(searchLower) ||
          `${member.first_name} ${member.last_name}`.toLowerCase().includes(searchLower),
      )
    }

    const departmentIds = [...new Set(filteredStaff?.map((s) => s.department_id).filter(Boolean))]
    const locationIds = [...new Set(filteredStaff?.map((s) => s.assigned_location_id).filter(Boolean))]

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
      filteredStaff?.map((staffMember) => ({
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

    let supabase, adminSupabase
    try {
      const supabaseModule = await import("@/lib/supabase/server")
      supabase = await supabaseModule.createClient()

      // Create admin client with service role key
      const { createClient } = await import("@supabase/supabase-js")
      const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL
      const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

      if (!supabaseUrl || !serviceRoleKey) {
        throw new Error("Missing Supabase admin credentials")
      }

      adminSupabase = createClient(supabaseUrl, serviceRoleKey, {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      })

      console.log("[v0] Staff API - Admin client created successfully")
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
      return createJsonResponse({ success: false, error: "Authentication required" }, 401)
    }

    const { data: profile } = await supabase.from("user_profiles").select("role").eq("id", user.id).single()

    if (!profile || (profile.role !== "admin" && profile.role !== "it-admin" && profile.role !== "regional_manager")) {
      return createJsonResponse({ success: false, error: "Admin, IT-Admin, or Regional Manageror Regional Manager access required" }, 403)
    }

    const body = await request.json()
    const { email, first_name, last_name, employee_id, department_id, position, role, assigned_location_id, password } =
      body

    if (profile.role === "it-admin" && (role === "admin" || role === "it-admin")) {
      console.error("[v0] Staff API - IT-Admin tried to create admin/it-admin user")
      return createJsonResponse(
        {
          success: false,
          error: "IT-Admin users cannot create Admin or IT-Admin accounts",
          details: "You can only create: Staff, Department Head, NSP, Intern, or Contract users",
        },
        403,
      )
    }

    if ((role === "admin" || role === "regional_manager") && profile.role !== "admin") {
      console.error("[v0] Staff API - Non-admin tried to create admin or regional_manager user")
      return createJsonResponse(
        {
          success: false,
          error: "Only administrators can create Admin or Regional Manager accounts",
          details: "You can only create: Staff, Department Head, IT-Admin, NSP, Intern, or Contract users",
        },
        403,
      )
    }

    const { data: existingAuthUser } = await adminSupabase.auth.admin.listUsers()
    const userExists = existingAuthUser.users.find((u) => u.email === email)

    if (userExists) {
      console.log("[v0] Staff API - User with email already exists:", email)
      return createJsonResponse(
        {
          success: false,
          error: "User with this email already exists",
          details: "Please use a different email address",
        },
        400,
      )
    }

    const { data: authUser, error: authCreateError } = await adminSupabase.auth.admin.createUser({
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
      console.error("[v0] Staff API - Auth user creation error:", authCreateError.message)
      return createJsonResponse(
        {
          success: false,
          error: "Failed to create user account",
          details: authCreateError.message,
        },
        400,
      )
    }

    console.log("[v0] Staff API - Auth user created successfully:", authUser.user.id)

    const { data: existingProfile } = await adminSupabase
      .from("user_profiles")
      .select("id")
      .eq("id", authUser.user.id)
      .single()

    let newProfile, insertError

    if (existingProfile) {
      console.log("[v0] Staff API - Updating existing profile:", authUser.user.id)
      // Update existing profile
      const { data, error } = await adminSupabase
        .from("user_profiles")
        .update({
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
        .eq("id", authUser.user.id)
        .select(`
          *,
          departments:department_id(id, name, code),
          geofence_locations:assigned_location_id(id, name, address)
        `)
        .single()

      newProfile = data
      insertError = error
    } else {
      console.log("[v0] Staff API - Creating new profile:", authUser.user.id)
      // Insert new profile
      const { data, error } = await adminSupabase
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

      newProfile = data
      insertError = error
    }

    if (insertError) {
      console.error("[v0] Staff API - Profile insert/update error:", insertError)
      // Clean up auth user if profile creation fails
      await adminSupabase.auth.admin.deleteUser(authUser.user.id)
      return createJsonResponse(
        {
          success: false,
          error: "Failed to create staff profile",
          details: insertError.message,
        },
        400,
      )
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
