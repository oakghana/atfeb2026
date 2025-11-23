import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  try {
    const supabase = await createClient()
    const { id } = params
    const body = await request.json()

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 })
    }

    // Update notification
    const { error } = await supabase
      .from("staff_notifications")
      .update({
        is_read: body.is_read,
        read_at: body.is_read ? new Date().toISOString() : null,
      })
      .eq("id", id)
      .eq("recipient_id", user.id) // Ensure user can only update their own notifications

    if (error) {
      console.error("[v0] Error updating notification:", error)
      return NextResponse.json({ success: false, error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("[v0] Exception in notification update API:", error)
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 })
  }
}
