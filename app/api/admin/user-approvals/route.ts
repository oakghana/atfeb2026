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

    // Check if user is admin
    const { data: profile } = await supabase.from("user_profiles").select("role").eq("id", user.id).single()

    if (!profile || profile.role !== "admin") {
      return NextResponse.json({ error: "Admin access required" }, { status: 403 })
    }

    // Get pending users
    const { data: pendingUsers, error } = await supabase
      .from("user_profiles")
      .select(`
        *,
        departments (name),
        regions (name)
      `)
      .eq("is_active", false)
      .order("created_at", { ascending: false })

    if (error) {
      console.error("Error fetching pending users:", error)
      return NextResponse.json({ error: "Failed to fetch pending users" }, { status: 500 })
    }

    return NextResponse.json(
      { data: pendingUsers },
      {
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": "no-cache, no-store, must-revalidate, private",
          Pragma: "no-cache",
          Expires: "0",
          "X-Content-Type-Options": "nosniff",
          "X-Frame-Options": "DENY",
        },
      },
    )
  } catch (error) {
    console.error("User approvals API error:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      {
        status: 500,
        headers: {
          "Cache-Control": "no-cache, no-store, must-revalidate",
          Pragma: "no-cache",
          Expires: "0",
        },
      },
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { userId, action } = await request.json()

    // Get authenticated user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Check if user is admin
    const { data: profile } = await supabase.from("user_profiles").select("role").eq("id", user.id).single()

    if (!profile || profile.role !== "admin") {
      return NextResponse.json({ error: "Admin access required" }, { status: 403 })
    }

    if (action === "approve") {
      // Approve user
      const { error } = await supabase.from("user_profiles").update({ is_active: true }).eq("id", userId)

      if (error) {
        console.error("Error approving user:", error)
        return NextResponse.json({ error: "Failed to approve user" }, { status: 500 })
      }

      // Log the action
      await supabase.from("audit_logs").insert({
        user_id: user.id,
        action: "user_approved",
        details: { approved_user_id: userId },
        ip_address: request.headers.get("x-forwarded-for") || null,
      })

      return NextResponse.json(
        { message: "User approved successfully" },
        {
          headers: {
            "Cache-Control": "no-cache, no-store, must-revalidate, private",
            Pragma: "no-cache",
            Expires: "0",
          },
        },
      )
    } else if (action === "reject") {
      // Reject user (delete profile)
      const { error } = await supabase.from("user_profiles").delete().eq("id", userId)

      if (error) {
        console.error("Error rejecting user:", error)
        return NextResponse.json({ error: "Failed to reject user" }, { status: 500 })
      }

      // Log the action
      await supabase.from("audit_logs").insert({
        user_id: user.id,
        action: "user_rejected",
        details: { rejected_user_id: userId },
        ip_address: request.headers.get("x-forwarded-for") || null,
      })

      return NextResponse.json(
        { message: "User rejected successfully" },
        {
          headers: {
            "Cache-Control": "no-cache, no-store, must-revalidate, private",
            Pragma: "no-cache",
            Expires: "0",
          },
        },
      )
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 })
  } catch (error) {
    console.error("User approval action error:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      {
        status: 500,
        headers: {
          "Cache-Control": "no-cache, no-store, must-revalidate",
          Pragma: "no-cache",
          Expires: "0",
        },
      },
    )
  }
}
