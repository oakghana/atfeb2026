import { createClient } from "@/lib/supabase/server"
import { type NextRequest, NextResponse } from "next/server"

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()

    // Get authenticated user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Check if user has admin or department_head role
    const { data: profile } = await supabase.from("user_profiles").select("role").eq("id", user.id).single()

    if (!profile || !["admin", "department_head", "staff"].includes(profile.role)) {
      return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 })
    }

    // Get all active departments
    const { data: departments, error } = await supabase
      .from("departments")
      .select(`
        id,
        name,
        code,
        description,
        is_active,
        created_at
      `)
      .eq("is_active", true)
      .order("name")

    if (error) {
      console.error("Departments fetch error:", error)
      return NextResponse.json({ error: "Failed to fetch departments" }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      data: departments || [],
    })
  } catch (error) {
    console.error("Departments API error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
