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

    const { searchParams } = new URL(request.url)
    const action = searchParams.get("action")
    const userId = searchParams.get("user_id")
    const startDate = searchParams.get("start_date")
    const endDate = searchParams.get("end_date")

    let auditQuery = supabase.from("audit_logs").select("*").order("created_at", { ascending: false })

    // Apply filters
    if (action && action !== "all") {
      auditQuery = auditQuery.eq("action", action)
    }
    if (userId) {
      auditQuery = auditQuery.eq("user_id", userId)
    }
    if (startDate) {
      auditQuery = auditQuery.gte("created_at", startDate)
    }
    if (endDate) {
      auditQuery = auditQuery.lte("created_at", endDate)
    }

    const { data: auditLogs, error: auditError } = await auditQuery

    if (auditError) {
      console.error("Audit logs export error:", auditError)
      return NextResponse.json({ error: "Failed to fetch audit logs" }, { status: 500 })
    }

    const userIds = [...new Set(auditLogs.map((log) => log.user_id).filter(Boolean))]
    const { data: userProfiles } = await supabase
      .from("user_profiles")
      .select("id, first_name, last_name, employee_id, email")
      .in("id", userIds)

    const userLookup = new Map()
    userProfiles?.forEach((user) => {
      userLookup.set(user.id, user)
    })

    // Generate CSV content
    const csvHeaders = ["Date/Time", "User Name", "Employee ID", "Email", "Action", "Table", "IP Address", "User Agent"]

    const csvRows = auditLogs.map((log) => {
      const userProfile = userLookup.get(log.user_id)
      return [
        new Date(log.created_at).toISOString(),
        `${userProfile?.first_name || ""} ${userProfile?.last_name || ""}`.trim(),
        userProfile?.employee_id || "",
        userProfile?.email || "",
        log.action,
        log.table_name || "",
        log.ip_address || "",
        log.user_agent || "",
      ]
    })

    const csvContent = [csvHeaders.join(","), ...csvRows.map((row) => row.map((field) => `"${field}"`).join(","))].join(
      "\n",
    )

    // Log the export action
    await supabase.from("audit_logs").insert({
      user_id: user.id,
      action: "export_audit_logs",
      table_name: "audit_logs",
      ip_address: request.ip || null,
      user_agent: request.headers.get("user-agent"),
    })

    return new NextResponse(csvContent, {
      headers: {
        "Content-Type": "text/csv",
        "Content-Disposition": `attachment; filename="audit-logs-${new Date().toISOString().split("T")[0]}.csv"`,
      },
    })
  } catch (error) {
    console.error("Audit logs export error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
