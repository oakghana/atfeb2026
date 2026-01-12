import { createClient } from "@/lib/supabase/server"
import { type NextRequest, NextResponse } from "next/server"

export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  try {
    console.log("[v0] Fetching audit logs...")
    const supabase = await createClient()

    // Get authenticated user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      console.log("[v0] Audit logs: Unauthorized access attempt")
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Check if user is admin
    const { data: profile, error: profileError } = await supabase
      .from("user_profiles")
      .select("role")
      .eq("id", user.id)
      .single()

    if (profileError) {
      console.error("[v0] Error fetching user profile:", profileError)
      return NextResponse.json({ error: "Failed to verify user permissions" }, { status: 500 })
    }

    if (!profile || profile.role !== "admin") {
      console.log("[v0] Non-admin user attempted to access audit logs:", user.id)
      return NextResponse.json({ error: "Admin access required" }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const page = Number.parseInt(searchParams.get("page") || "1")
    const limit = Number.parseInt(searchParams.get("limit") || "50")
    const action = searchParams.get("action")
    const userId = searchParams.get("user_id")
    const startDate = searchParams.get("start_date")
    const endDate = searchParams.get("end_date")

    console.log("[v0] Audit logs query params:", { page, limit, action, userId, startDate, endDate })

    let query = supabase.from("audit_logs").select("*").order("created_at", { ascending: false })

    // Apply filters
    if (action) {
      query = query.eq("action", action)
    }
    if (userId) {
      query = query.eq("user_id", userId)
    }
    if (startDate) {
      query = query.gte("created_at", startDate)
    }
    if (endDate) {
      query = query.lte("created_at", endDate)
    }

    // Apply pagination
    const from = (page - 1) * limit
    const to = from + limit - 1
    query = query.range(from, to)

    const { data: auditLogs, error: auditError, count } = await query

    if (auditError) {
      console.error("[v0] Audit logs query error:", auditError)
      return NextResponse.json({ error: "Failed to fetch audit logs" }, { status: 500 })
    }

    console.log("[v0] Audit logs fetched successfully:", auditLogs?.length || 0, "records")

    const enrichedLogs = []
    if (auditLogs && auditLogs.length > 0) {
      for (const log of auditLogs) {
        let userDetails = null
        if (log.user_id) {
          try {
            const { data: userProfile, error: userError } = await supabase
              .from("user_profiles")
              .select("first_name, last_name, employee_id, email, role")
              .eq("id", log.user_id)
              .maybeSingle()

            if (!userError && userProfile) {
              userDetails = userProfile
            } else {
              // If user profile not found, create a placeholder
              userDetails = {
                first_name: "Unknown",
                last_name: "User",
                employee_id: "N/A",
                email: "unknown@example.com",
                role: "unknown",
              }
            }
          } catch (userFetchError) {
            console.error("[v0] Error fetching user details for log:", log.id, userFetchError)
            userDetails = {
              first_name: "Error",
              last_name: "Loading",
              employee_id: "N/A",
              email: "error@example.com",
              role: "unknown",
            }
          }
        }

        enrichedLogs.push({
          ...log,
          user_profiles: userDetails,
        })
      }
    }

    // Get total count for pagination
    const { count: totalCount } = await supabase.from("audit_logs").select("*", { count: "exact", head: true })

    console.log("[v0] Total audit logs count:", totalCount)

    return NextResponse.json(
      {
        data: enrichedLogs,
        pagination: {
          page,
          limit,
          total: totalCount || 0,
          totalPages: Math.ceil((totalCount || 0) / limit),
        },
      },
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
    console.error("[v0] Audit logs API error:", error)
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
