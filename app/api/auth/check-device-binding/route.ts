import { createClient } from "@/lib/supabase/server"
import { type NextRequest, NextResponse } from "next/server"

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const { device_id, device_info } = body

    if (!device_id) {
      return NextResponse.json({ error: "Device ID is required" }, { status: 400 })
    }

    const getValidIpAddress = () => {
      const possibleIps = [
        request.ip,
        request.headers.get("x-forwarded-for")?.split(",")[0]?.trim(),
        request.headers.get("x-real-ip"),
        request.headers.get("cf-connecting-ip"),
      ]

      for (const ip of possibleIps) {
        if (ip && ip !== "unknown" && ip !== "::1" && ip !== "127.0.0.1") {
          if (/^(\d{1,3}\.){3}\d{1,3}$/.test(ip) || /^([0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$/.test(ip)) {
            return ip
          }
        }
      }
      return null
    }

    const ipAddress = getValidIpAddress()

    try {
      const { data: existingBinding, error: bindingError } = await supabase
        .from("device_user_bindings")
        .select("user_id, user_profiles!inner(first_name, last_name, email, department_id)")
        .eq("device_id", device_id)
        .eq("is_active", true)
        .maybeSingle()

      if (bindingError) {
        if (
          bindingError.code === "PGRST205" ||
          bindingError.code === "42P01" ||
          bindingError.message?.includes("Could not find the table") ||
          bindingError.message?.includes("does not exist")
        ) {
          console.log("[v0] Device binding tables not created yet, skipping device security check")
          return NextResponse.json({
            allowed: true,
            violation: false,
            message: "Device verification skipped - tables not initialized",
          })
        }
        console.error("[v0] Error checking device binding:", bindingError)
        return NextResponse.json({
          allowed: true,
          violation: false,
          message: "Device verification temporarily unavailable",
        })
      }

      if (existingBinding && existingBinding.user_id !== user.id) {
        console.log("[v0] Device binding violation detected:", {
          device_id,
          attempted_user: user.id,
          bound_user: existingBinding.user_id,
        })

        try {
          await supabase.from("device_security_violations").insert({
            device_id,
            ip_address: ipAddress,
            attempted_user_id: user.id,
            bound_user_id: existingBinding.user_id,
            violation_type: "login_attempt",
            device_info: device_info || null,
          })

          const { data: currentUserProfile } = await supabase
            .from("user_profiles")
            .select("first_name, last_name, email, department_id")
            .eq("id", user.id)
            .single()

          if (currentUserProfile?.department_id) {
            const { data: deptHead } = await supabase
              .from("user_profiles")
              .select("id")
              .eq("department_id", currentUserProfile.department_id)
              .eq("role", "department_head")
              .eq("is_active", true)
              .maybeSingle()

            if (deptHead) {
              await supabase.from("staff_notifications").insert({
                recipient_id: deptHead.id,
                sender_id: user.id,
                sender_role: "system",
                sender_label: "Security Alert",
                notification_type: "security_violation",
                message: `Security Alert: ${currentUserProfile.first_name} ${currentUserProfile.last_name} (${currentUserProfile.email}) attempted to login using a device already registered to ${existingBinding.user_profiles.first_name} ${existingBinding.user_profiles.last_name}. This may indicate device sharing or unauthorized access. Please investigate.`,
                is_read: false,
              })
            }
          }
        } catch (notificationError) {
          console.error("[v0] Failed to log violation or send notification:", notificationError)
        }

        return NextResponse.json({
          allowed: false,
          violation: true,
          message: `This device is already registered to another staff member. Each device can only be used by one person. Please contact your supervisor or IT department.`,
          bound_to_email: existingBinding.user_profiles.email,
        })
      }

      // Detect concurrent active device sessions for this user (other devices)
      let concurrentSessions: any[] = []
      try {
        const { data: otherSessions, error: sessionsError } = await supabase
          .from("device_sessions")
          .select("id, device_name, device_type, device_id, ip_address, last_activity")
          .eq("user_id", user.id)
          .eq("is_active", true)
          .neq("device_id", device_id)
          .limit(10)

        if (!sessionsError && Array.isArray(otherSessions) && otherSessions.length > 0) {
          concurrentSessions = otherSessions
        }
      } catch (sessionErr) {
        console.log('[v0] Could not check concurrent device sessions:', sessionErr)
      }

      if (!existingBinding) {
        try {
          await supabase.from("device_user_bindings").insert({
            device_id,
            ip_address: ipAddress,
            user_id: user.id,
            device_info: device_info || null,
            is_active: true,
            last_seen_at: new Date().toISOString(),
          })
        } catch (insertError) {
          console.log("[v0] Could not create device binding, table may not exist:", insertError)
        }
      } else {
        try {
          await supabase
            .from("device_user_bindings")
            .update({
              ip_address: ipAddress,
              last_seen_at: new Date().toISOString(),
              device_info: device_info || null,
            })
            .eq("device_id", device_id)
            .eq("user_id", user.id)
        } catch (updateError) {
          console.log("[v0] Could not update device binding:", updateError)
        }
      }

      return NextResponse.json({
        allowed: true,
        violation: false,
        concurrent: concurrentSessions.length > 0,
        sessions: concurrentSessions,
        message: "Device verified successfully",
      })
    } catch (dbError: any) {
      console.log("[v0] Database error during device binding check, allowing login:", dbError?.message)
      return NextResponse.json({
        allowed: true,
        violation: false,
        message: "Device verification skipped - proceeding with login",
      })
    }
  } catch (error) {
    console.error("[v0] Device binding check error:", error)
    return NextResponse.json({
      allowed: true,
      violation: false,
      message: "Device verification error - proceeding with login",
    })
  }
}
