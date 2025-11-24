import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"

export async function POST(request: Request) {
  try {
    const supabase = await createClient()

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { data: profile } = await supabase.from("user_profiles").select("*").eq("id", user.id).single()

    if (!profile || !["admin", "department_head"].includes(profile.role)) {
      return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 })
    }

    const body = await request.json()
    const { recipient_ids, message, warning_type } = body

    if (!recipient_ids || recipient_ids.length === 0) {
      return NextResponse.json({ error: "No recipients specified" }, { status: 400 })
    }

    if (!message || !message.trim()) {
      return NextResponse.json({ error: "Message is required" }, { status: 400 })
    }

    const { data: recipients, error: fetchError } = await supabase
      .from("user_profiles")
      .select("id, first_name, last_name")
      .in("id", recipient_ids)

    if (fetchError) {
      console.error("[v0] Error fetching recipients:", fetchError)
      return NextResponse.json({ error: "Failed to fetch recipient details" }, { status: 500 })
    }

    const senderLabel = profile.role === "admin" ? "Management of QCC" : "Department Head"

    const warnings = (recipients || []).map((recipient) => {
      // Replace [STAFF_NAME] placeholder with recipient's first name
      const personalizedMessage = message.trim().replace(/\[STAFF_NAME\]/g, recipient.first_name)

      return {
        recipient_id: recipient.id,
        sender_id: user.id,
        sender_role: profile.role,
        sender_label: senderLabel,
        subject: `Attendance Notice - ${warning_type === "daily_absence" ? "Daily" : "Weekly"} Check-in Issue`,
        message: personalizedMessage,
        warning_type: warning_type || "attendance_issue",
        is_read: false,
        attendance_date: new Date().toISOString().split("T")[0],
        department_id: profile.department_id,
      }
    })

    const { data, error } = await supabase.from("staff_warnings").insert(warnings).select()

    if (error) {
      console.error("[v0] Failed to send warnings:", error)
      return NextResponse.json({ error: "Failed to send warnings" }, { status: 500 })
    }

    await supabase.from("audit_logs").insert({
      user_id: user.id,
      action: "send_staff_warnings",
      table_name: "staff_warnings",
      new_values: {
        recipients: recipient_ids.length,
        warning_type,
        sender_role: profile.role,
        timestamp: new Date().toISOString(),
      },
    })

    return NextResponse.json({
      success: true,
      sent: data.length,
      message: `Successfully sent warnings to ${data.length} staff member(s)`,
    })
  } catch (error) {
    console.error("[v0] Send warnings error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
