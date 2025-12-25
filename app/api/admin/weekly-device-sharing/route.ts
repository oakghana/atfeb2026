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

    // Get user profile to check role and department
    const { data: profile } = await supabase
      .from("user_profiles")
      .select("role, department_id")
      .eq("id", user.id)
      .single()

    if (!profile || (profile.role !== "admin" && profile.role !== "department_head")) {
      return NextResponse.json({ error: "Forbidden: Admin or Department Head access required" }, { status: 403 })
    }

    // Get device sessions from the last 7 days
    const sevenDaysAgo = new Date()
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)

    const { data: deviceSessions, error: sessionsError } = await supabase
      .from("device_sessions")
      .select(
        `
        device_id,
        ip_address,
        user_id,
        created_at,
        user_profiles!inner (
          id,
          first_name,
          last_name,
          email,
          department_id,
          departments (
            name
          )
        )
      `,
      )
      .gte("created_at", sevenDaysAgo.toISOString())
      .order("created_at", { ascending: false })

    if (sessionsError) {
      console.error("Error fetching device sessions:", sessionsError)
      return NextResponse.json({ error: "Failed to fetch device sessions" }, { status: 500 })
    }

    const deviceMap = new Map<
      string,
      {
        device_id: string
        ip_address: string | null
        users: Set<string>
        userDetails: Array<{
          user_id: string
          first_name: string
          last_name: string
          email: string
          department_name: string
          last_used: string
        }>
      }
    >()

    for (const session of deviceSessions || []) {
      const key = session.device_id || session.ip_address
      if (!key) continue

      // Filter by department for department heads
      if (profile.role === "department_head") {
        if (session.user_profiles.department_id !== profile.department_id) {
          continue
        }
      }

      if (!deviceMap.has(key)) {
        deviceMap.set(key, {
          device_id: session.device_id,
          ip_address: session.ip_address,
          users: new Set(),
          userDetails: [],
        })
      }

      const device = deviceMap.get(key)!
      if (!device.users.has(session.user_id)) {
        device.users.add(session.user_id)
        device.userDetails.push({
          user_id: session.user_id,
          first_name: session.user_profiles.first_name,
          last_name: session.user_profiles.last_name,
          email: session.user_profiles.email,
          department_name: session.user_profiles.departments?.name || "Unknown",
          last_used: session.created_at,
        })
      }
    }

    const sharedDevices = Array.from(deviceMap.values())
      .filter((device) => device.users.size > 1)
      .map((device) => ({
        device_id: device.device_id,
        ip_address: device.ip_address,
        user_count: device.users.size,
        risk_level: device.users.size >= 5 ? "critical" : device.users.size >= 3 ? "high" : "medium",
        users: device.userDetails,
        first_detected: device.userDetails.reduce(
          (earliest, user) => (user.last_used < earliest ? user.last_used : earliest),
          device.userDetails[0].last_used,
        ),
        last_detected: device.userDetails.reduce(
          (latest, user) => (user.last_used > latest ? user.last_used : latest),
          device.userDetails[0].last_used,
        ),
      }))
      .sort((a, b) => b.user_count - a.user_count)

    return NextResponse.json({ data: sharedDevices })
  } catch (error) {
    console.error("Weekly device sharing error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
