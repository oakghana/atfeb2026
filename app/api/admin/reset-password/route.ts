import { createClient } from "@supabase/supabase-js"
import { type NextRequest, NextResponse } from "next/server"

export async function POST(request: NextRequest) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

    if (!supabaseUrl || !supabaseServiceKey) {
      console.error("[v0] Admin password reset: Missing Supabase credentials")
      return NextResponse.json({ error: "Server configuration error" }, { status: 500 })
    }

    // Create admin client with service role key
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    })

    // Create regular client for user verification
    const { createClient: createRegularClient } = await import("@/lib/supabase/server")
    const supabase = await createRegularClient()

    const { userId, newPassword } = await request.json()

    console.log("[v0] Admin password reset: Received request for userId:", userId)

    if (!userId || !newPassword) {
      return NextResponse.json({ error: "User ID and new password are required" }, { status: 400 })
    }

    if (newPassword.length < 6) {
      return NextResponse.json({ error: "Password must be at least 6 characters long" }, { status: 400 })
    }

    // Verify admin access using regular client
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      console.error("[v0] Admin password reset: Auth error:", authError)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Check if user is admin
    const { data: profile, error: profileError } = await supabase
      .from("user_profiles")
      .select("role")
      .eq("id", user.id)
      .single()

    if (profileError || profile?.role !== "admin") {
      console.error("[v0] Admin password reset: Not admin:", profile?.role)
      return NextResponse.json({ error: "Admin access required" }, { status: 403 })
    }

    const { data: targetUser, error: userError } = await supabase
      .from("user_profiles")
      .select("first_name, last_name, employee_id, email")
      .eq("id", userId)
      .single()

    if (userError || !targetUser) {
      console.error("[v0] Admin password reset: User not found:", userError)
      return NextResponse.json({ error: "User not found" }, { status: 404 })
    }

    console.log("[v0] Admin password reset: Found target user:", targetUser.email)

    const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(userId, {
      password: newPassword,
    })

    if (updateError) {
      console.error("[v0] Admin password reset: Update error:", updateError)
      return NextResponse.json(
        {
          error: `Failed to update password: ${updateError.message}`,
        },
        { status: 500 },
      )
    }

    console.log("[v0] Admin password reset: Password updated successfully for:", targetUser.email)

    // Log the password reset action
    await supabase.from("audit_logs").insert({
      user_id: user.id,
      action: "admin_password_reset",
      table_name: "auth.users",
      record_id: userId,
      old_values: {},
      new_values: {
        target_user_email: targetUser.email,
        target_user_name: `${targetUser.first_name} ${targetUser.last_name}`,
      },
      ip_address: request.headers.get("x-forwarded-for") || "unknown",
      user_agent: request.headers.get("user-agent") || "unknown",
    })

    return NextResponse.json({
      success: true,
      message: `Password updated successfully for ${targetUser.first_name} ${targetUser.last_name} (${targetUser.email})`,
    })
  } catch (error) {
    console.error("[v0] Admin password reset: Unexpected error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
