import { createClient } from "@/lib/supabase/server"
import { type NextRequest, NextResponse } from "next/server"
import { randomUUID } from "crypto"

function createJSONResponse(data: any, status = 200) {
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
    console.log("[v0] Staff API - GET request received")

    let supabase
    let clientError
    try {
      supabase = await createClient()
      console.log("[v0] Staff API - Supabase client created successfully")
    } catch (error) {
      clientError = error
      console.error("[v0] Staff API - Failed to create Supabase client:", clientError)
      return createJSONResponse({ error: "Database connection failed" }, 500)
    }

    if (!supabase) {
      console.error("[v0] Staff API - Supabase client is null")
      return createJSONResponse({ error: "Database client initialization failed" }, 500)
    }

    // Get authenticated user and check admin role
    console.log("[v0] Staff API - Checking user authentication")
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError) {
      console.error("[v0] Staff API - Auth error:", authError)
      return createJSONResponse({ error: "Authentication failed" }, 401)
    }

    if (!user) {
      console.log("[v0] Staff API - No authenticated user")
      return createJSONResponse({ error: "No authenticated user" }, 401)
    }

    console.log("[v0] Staff API - User authenticated:", user.id)

    // Check if user has admin or department_head role
    console.log("[v0] Staff API - Checking user permissions")
    const { data: profile, error: profileFetchError } = await supabase
      .from("user_profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle()

    if (profileFetchError) {
      console.error("[v0] Staff API - Profile fetch error:", profileFetchError)
      return createJSONResponse({ error: "Failed to fetch user profile" }, 500)
    }

    if (!profile) {
      console.log("[v0] Staff API - No user profile found")
      return createJSONResponse({ error: "User profile not found" }, 404)
    }

    console.log("[v0] Staff API - User role:", profile.role)

    if (!["admin", "department_head"].includes(profile.role)) {
      console.log("[v0] Staff API - Insufficient permissions for role:", profile.role)
      return createJSONResponse({ error: "Insufficient permissions" }, 403)
    }

    // Get search parameters
    const { searchParams } = new URL(request.url)
    const page = Number.parseInt(searchParams.get("page") || "1")
    const limit = Number.parseInt(searchParams.get("limit") || "10")
    const search = searchParams.get("search") || ""
    const department = searchParams.get("department") || ""
    const roleParam = searchParams.get("role") || ""

    console.log("[v0] Staff API - Query params:", { page, limit, search, department, roleParam })

    console.log("[v0] Staff API - Building query")
    let query = supabase.from("user_profiles").select("*")

    // Apply filters
    if (search) {
      query = query.or(
        `first_name.ilike.%${search}%,last_name.ilike.%${search}%,employee_id.ilike.%${search}%,email.ilike.%${search}%`,
      )
      console.log("[v0] Staff API - Applied search filter:", search)
    }

    if (department) {
      query = query.eq("department_id", department)
      console.log("[v0] Staff API - Applied department filter:", department)
    }

    if (roleParam) {
      query = query.eq("role", roleParam)
      console.log("[v0] Staff API - Applied role filter:", roleParam)
    }

    console.log("[v0] Staff API - Fetching total count")
    const { count, error: countError } = await supabase
      .from("user_profiles")
      .select("*", { count: "exact", head: true })

    if (countError) {
      console.error("[v0] Staff API - Count query error:", countError)
      return createJSONResponse({ error: "Failed to count staff records" }, 500)
    }

    console.log("[v0] Staff API - Total count:", count)

    // Apply pagination
    const offset = (page - 1) * limit
    query = query.range(offset, offset + limit - 1).order("created_at", { ascending: false })

    console.log("[v0] Staff API - Executing main query with pagination:", { offset, limit })
    const { data: staff, error: staffError } = await query

    if (staffError) {
      console.error("[v0] Staff fetch error:", staffError)
      return createJSONResponse(
        {
          error: "Failed to fetch staff",
          details: staffError.message,
          code: staffError.code,
        },
        500,
      )
    }

    console.log("[v0] Staff API - Successfully fetched", staff?.length, "records")

    console.log("[v0] Staff API - Enriching staff data with departments")
    const staffWithDepartments = await Promise.all(
      (staff || []).map(async (member, index) => {
        if (member.department_id) {
          console.log(`[v0] Staff API - Fetching department for staff ${index + 1}:`, member.department_id)
          const { data: dept, error: deptError } = await supabase
            .from("departments")
            .select("name, code")
            .eq("id", member.department_id)
            .maybeSingle()

          if (deptError) {
            console.error(`[v0] Staff API - Department fetch error for ${member.department_id}:`, deptError)
          }

          return {
            ...member,
            departments: dept,
          }
        }
        return {
          ...member,
          departments: null,
        }
      }),
    )

    console.log("[v0] Staff API - Returning enriched data")
    return createJSONResponse({
      success: true,
      data: staffWithDepartments,
      pagination: {
        page,
        limit,
        total: count || 0,
        pages: Math.ceil((count || 0) / limit),
      },
    })
  } catch (error) {
    console.error("[v0] Staff API unexpected error:", error)
    console.error("[v0] Staff API error stack:", error instanceof Error ? error.stack : "No stack trace")
    return createJSONResponse(
      {
        error: "Internal server error",
        details: error instanceof Error ? error.message : "Unknown error",
        timestamp: new Date().toISOString(),
      },
      500,
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()

    // Get authenticated user and check admin role
    console.log("[v0] Staff API - Checking user authentication")
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError) {
      console.error("[v0] Staff API - Auth error:", authError)
      return createJSONResponse({ error: "Authentication failed" }, 401)
    }

    if (!user) {
      console.log("[v0] Staff API - No authenticated user")
      return createJSONResponse({ error: "No authenticated user" }, 401)
    }

    console.log("[v0] Staff API - User authenticated:", user.id)

    // Check if user has admin role
    console.log("[v0] Staff API - Checking user permissions")
    const { data: profile, error: profileFetchError } = await supabase
      .from("user_profiles")
      .select("role")
      .eq("id", user.id)
      .single()

    if (profileFetchError) {
      console.error("[v0] Staff API - Profile fetch error:", profileFetchError)
      return createJSONResponse({ error: "Failed to fetch user profile" }, 500)
    }

    if (!profile || profile.role !== "admin") {
      console.log("[v0] Staff API - Insufficient permissions for role:", profile.role)
      return createJSONResponse({ error: "Insufficient permissions" }, 403)
    }

    const body = await request.json()
    const { email, password, first_name, last_name, employee_id, department_id, position, role } = body

    // Generate a UUID for the new user
    const userId = randomUUID()

    // Insert user profile directly
    console.log("[v0] Staff API - Inserting new user profile")
    const { data: newProfile, error: insertProfileError } = await supabase
      .from("user_profiles")
      .insert({
        id: userId,
        email,
        first_name,
        last_name,
        employee_id,
        department_id: department_id || null,
        position,
        role: role || "staff",
        is_active: false, // Inactive until they sign up
        is_approved: true, // Pre-approved by admin
        created_at: new Date().toISOString(),
      })
      .select()
      .single()

    if (insertProfileError) {
      console.error("Profile creation error:", insertProfileError)
      return createJSONResponse({ error: "Failed to create user profile" }, 400)
    }

    console.log("[v0] Staff API - New user profile created:", newProfile)

    // Log the action
    console.log("[v0] Staff API - Logging create staff action")
    await supabase.from("audit_logs").insert({
      user_id: user.id,
      action: "create_staff",
      details: `Created staff profile for ${email}`,
      ip_address: request.headers.get("x-forwarded-for") || "unknown",
    })

    console.log("[v0] Staff API - Staff member created successfully")
    return createJSONResponse({
      success: true,
      data: newProfile,
      message: "Staff member created successfully. They need to sign up with their email to activate their account.",
    })
  } catch (error) {
    console.error("Create staff error:", error)
    console.error("[v0] Staff API POST error stack:", error instanceof Error ? error.stack : "No stack trace")
    return createJSONResponse(
      {
        error: "Internal server error",
        details: error instanceof Error ? error.message : "Unknown error",
        timestamp: new Date().toISOString(),
      },
      500,
    )
  }
}

export async function OPTIONS() {
  return createJSONResponse({ message: "Method OPTIONS allowed" }, 200)
}
