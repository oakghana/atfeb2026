import { createClient } from "@/lib/supabase/server"
import { type NextRequest, NextResponse } from "next/server"

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { email, userId } = await request.json()

    // Verify admin access
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Check if user is admin
    const { data: profile, error: profileError } = await supabase
      .from("user_profiles")
      .select("role")
      .eq("id", user.id)
      .single()

    if (profileError || profile?.role !== "admin") {
      return NextResponse.json({ error: "Admin access required" }, { status: 403 })
    }

    // Get user details for audit log
    const { data: targetUser, error: userError } = await supabase
      .from("user_profiles")
      .select("first_name, last_name, employee_id")
      .eq("email", email)
      .single()

    if (userError || !targetUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 })
    }

    // Send password reset email using Supabase Admin API
    const { error: resetError } = await supabase.auth.admin.inviteUserByEmail(email, {
      redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/auth/reset-password`,
    })

    if (resetError) {
      console.error("Password reset error:", resetError)
      return NextResponse.json({ error: "Failed to send reset email" }, { status: 500 })
    }

    // Log the password reset action
    await supabase.from("audit_logs").insert({
      user_id: user.id,
      action: "password_reset_initiated",
      table_name: "auth.users",
      record_id: userId || email,
      old_values: {},
      new_values: { target_email: email },
      ip_address: request.headers.get("x-forwarded-for") || "unknown",
      user_agent: request.headers.get("user-agent") || "unknown",
    })

    return NextResponse.json({
      success: true,
      message: `Password reset email sent to ${email}`,
    })
  } catch (error) {
    console.error("Password reset error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
