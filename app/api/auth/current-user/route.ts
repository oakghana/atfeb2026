import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"

export async function GET() {
  console.log("[v0] Fetching current user role...")
  try {
    const supabase = await createClient()

    // Get current user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      console.error("[v0] Auth error or no user:", authError)
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 })
    }

    console.log("[v0] User authenticated:", user.id)

    // Get user profile
    const { data: profile, error: profileError } = await supabase
      .from("user_profiles")
      .select("id, first_name, last_name, email, role, department_id")
      .eq("id", user.id)
      .single()

    if (profileError || !profile) {
      console.error("[v0] Profile error:", profileError)
      return NextResponse.json({ success: false, error: "Profile not found" }, { status: 404 })
    }

    console.log("[v0] Current user role:", profile.role)

    return NextResponse.json({
      success: true,
      user: {
        id: profile.id,
        first_name: profile.first_name,
        last_name: profile.last_name,
        email: profile.email,
        role: profile.role,
        department_id: profile.department_id,
      },
    })
  } catch (error) {
    console.error("[v0] Error fetching current user:", error)
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 })
  }
}
