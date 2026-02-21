import { createClient } from "@supabase/supabase-js"
import { NextResponse } from "next/server"

export async function POST(request: Request) {
  try {
    const { createClient: createRegularClient } = await import("@/lib/supabase/server")
    const supabase = await createRegularClient()

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { data: profile } = await supabase.from("user_profiles").select("id, role, email").eq("id", user.id).single()

    if (!profile || !["admin", "regional_manager", "department_head"].includes(profile.role)) {
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

    // Use an admin (service-role) Supabase client for recipient lookup so RLS does not block
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!supabaseUrl || !supabaseServiceKey) {
      console.error("[v0] Send warnings: Missing Supabase credentials")
      return NextResponse.json({ error: "Server configuration error" }, { status: 500 })
    }

    // validate recipient_ids and normalize
    const ids = Array.isArray(recipient_ids) ? Array.from(new Set(recipient_ids.map((i: any) => String(i).trim()))) : []

    if (ids.length === 0) {
      console.warn("[v0] Send warnings: invalid or empty recipient_ids", { recipient_ids })
      return NextResponse.json({ error: "Invalid recipients list" }, { status: 400 })
    }

    const { createClient: createSupabaseClient } = await import("@supabase/supabase-js")
    const supabaseAdminForLookup = createSupabaseClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })

    console.log("[v0] Send warnings: looking up recipients (count):", ids.length)

    const { data: recipients, error: fetchError } = await supabaseAdminForLookup
      .from("user_profiles")
      .select("id, first_name, last_name")
      .in("id", ids)

    if (fetchError) {
      // log full error server-side for debugging; return readable message to client
      console.error("[v0] Error fetching recipients:", fetchError)
      const msg = fetchError?.message || "Failed to fetch recipient details"
      return NextResponse.json({ error: msg }, { status: 500 })
    }

    if (!recipients || recipients.length === 0) {
      console.warn("[v0] No recipients found for provided ids", { ids })
      return NextResponse.json({ error: "Recipients not found" }, { status: 404 })
    }

    // Filter out users who are on approved leave (use RLS-aware regular client for leave_status)
    const today = new Date().toISOString().split("T")[0]
    const { data: usersOnLeave } = await supabase
      .from("leave_status")
      .select("user_id")
      .eq("status", "on_leave")
      .gte("end_date", today)
      .lte("start_date", today)

    const onLeaveUserIds = new Set((usersOnLeave || []).map(l => l.user_id))
    
    const filteredRecipients = (recipients || []).filter(r => !onLeaveUserIds.has(r.id))

    const senderLabel = profile.role === "admin" ? "Management of QCC" : profile.role === "regional_manager" ? "Regional Manager" : "Department Head"

    const warnings = (filteredRecipients || []).map((recipient) => {
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

    // reuse admin client created for recipient lookup
    const supabaseAdmin = supabaseAdminForLookup

    const { data, error } = await supabaseAdmin.from("staff_warnings").insert(warnings).select()

    if (error) {
      console.error("[v0] Failed to send warnings (insert error):", error)
      const msg = error?.message || "Failed to send warnings"
      return NextResponse.json({ error: msg }, { status: 500 })
    }

    // write audit log, but don't fail the whole request if audit logging fails
    try {
      const { error: auditErr } = await supabase.from("audit_logs").insert({
        user_id: user.id,
        action: "send_staff_warnings",
        table_name: "staff_warnings",
        new_values: {
          recipients: ids.length,
          warning_type,
          sender_role: profile.role,
          timestamp: new Date().toISOString(),
        },
      })

      if (auditErr) {
        console.error("[v0] Warning: failed to write audit log:", auditErr)
      }
    } catch (auditException) {
      console.error("[v0] Exception while writing audit log:", auditException)
    }

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
