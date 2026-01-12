import { createClient } from "@/lib/supabase/server"
import { type NextRequest, NextResponse } from "next/server"

export const dynamic = "force-dynamic"

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

    const { data: profile } = await supabase.from("user_profiles").select("role").eq("id", user.id).single()

    if (!profile || !["admin", "it-admin", "department_head"].includes(profile.role)) {
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
      departments: departments || [],
      data: departments || [],
    })
  } catch (error) {
    console.error("Departments API error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
