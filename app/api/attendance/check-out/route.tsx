import { createClient, createAdminClient } from "@/lib/supabase/server"
import { type NextRequest, NextResponse } from "next/server"
import { validateCheckoutLocation, type LocationData } from "@/lib/geolocation"
import { requiresEarlyCheckoutReason, canCheckOutAtTime, getCheckOutDeadline } from "@/lib/attendance-utils"

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
    const { latitude, longitude, location_id, qr_code_used, qr_timestamp, early_checkout_reason } = body

    if (!qr_code_used && (!latitude || !longitude)) {
      return NextResponse.json({ error: "Location coordinates are required for GPS check-out" }, { status: 400 })
    }

    const now = new Date()
    const today = new Date().toISOString().split("T")[0]

    // OPTIMIZATION: Parallelize database queries
    const [
      { data: userProfile },
      { data: attendanceRecord, error: findError },
    ] = await Promise.all([
      supabase
        .from("user_profiles")
        .select("leave_status, leave_end_date")
        .eq("id", user.id)
        .maybeSingle(),
      supabase
        .from("attendance_records")
        .select("*")
        .eq("user_id", user.id)
        .gte("check_in_time", `${today}T00:00:00`)
        .lt("check_in_time", `${today}T23:59:59`)
        .maybeSingle(),
    ])

    // Prefer per-day `leave_status` table for accurate leave checks for today
    const { data: onLeave } = await supabase
      .from("leave_status")
      .select("date, leave_request_id")
      .eq("user_id", user.id)
      .eq("date", today)
      .eq("status", "on_leave")
      .maybeSingle()

    if (onLeave) {
      let startDate: string | null = null
      let endDate: string | null = null
      if (onLeave.leave_request_id) {
        const { data: lr } = await supabase
          .from("leave_requests")
          .select("start_date, end_date")
          .eq("id", onLeave.leave_request_id)
          .maybeSingle()
        if (lr) {
          startDate = lr.start_date
          endDate = lr.end_date
        }
      }

      return NextResponse.json(
        {
          error: `You are currently on approved leave${startDate && endDate ? ` from ${new Date(startDate).toLocaleDateString()} to ${new Date(endDate).toLocaleDateString()}` : ""}. You cannot check out during this period.`,
        },
        { status: 403 },
      )
    }

    // Fallback: respect legacy `user_profiles.leave_status` if present
    if (userProfile && userProfile.leave_status && userProfile.leave_status !== "active") {
      const leaveType = userProfile.leave_status === "on_leave" ? "on leave" : "on sick leave"
      const endDate = userProfile.leave_end_date
        ? new Date(userProfile.leave_end_date).toLocaleDateString()
        : "unspecified"

      return NextResponse.json(
        {
          error: `You are currently marked as ${leaveType} until ${endDate}. You cannot check out during your leave period.`,
        },
        { status: 403 },
      )
    }

    if (findError || !attendanceRecord) {
      return NextResponse.json({ error: "No check-in record found for today" }, { status: 400 })
    }

    if (attendanceRecord.check_out_time) {
      // Log this as a security violation - attempt to check out twice
      const deviceId = request.headers.get("x-device-id") || "unknown"
      const ipAddress = request.ip || request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || null

      await supabase
        .from("device_security_violations")
        .insert({
          device_id: deviceId,
          ip_address: ipAddress,
          attempted_user_id: user.id,
          bound_user_id: user.id,
          violation_type: "double_checkout_attempt",
          device_info: {
            userAgent: request.headers.get("user-agent"),
            timestamp: new Date().toISOString(),
          },
        })
        .catch((err) => {
          // Ignore if table doesn't exist yet
          if (err.code !== "PGRST205") {
            console.error("[v0] Failed to log checkout violation:", err)
          }
        })

      return NextResponse.json(
        {
          error: `DUPLICATE CHECK-OUT BLOCKED: You have already checked out today at ${new Date(attendanceRecord.check_out_time).toLocaleTimeString()}. Only one check-out per day is allowed. This attempt has been logged as a security violation.`,
        },
        { status: 400 },
      )
    }

    // CHECK TIME RESTRICTION: Check if check-out is after 6 PM (18:00)
    const timeRestrictCheckData = { 
      departments: userProfile?.departments, 
      role: userProfile?.role 
    }
    const canCheckOut = canCheckOutAtTime(now, timeRestrictCheckData?.departments, timeRestrictCheckData?.role)
    
    // determine bypass if remote checkout (either originally off-premises OR currently out-of-range)
    const isOffPremisesCheckedIn = !!attendanceRecord.on_official_duty_outside_premises || !!attendanceRecord.is_remote_location
    const isOutOfRange = !checkoutLocationData
    const bypassTimeRules = isOffPremisesCheckedIn || isOutOfRange

    if (!canCheckOut && !bypassTimeRules) {
      // Create a notification for users trying to check out after 6 PM
      await supabase
        .from("staff_notifications")
        .insert({
          user_id: user.id,
          title: "Check-out Time Exceeded",
          message: `You attempted to check out after ${getCheckOutDeadline()}. Check-outs are only allowed until ${getCheckOutDeadline()} unless you are in an exempt department (Operational/Security).`,
          type: "warning",
          is_read: false,
        })
        .catch(() => {}) // Silently fail if notification table doesn't exist

      return NextResponse.json({
        error: `Check-out is only allowed before ${getCheckOutDeadline()}. Your department/role does not have exceptions for late check-outs.`,
        checkOutBlocked: true,
        currentTime: now.toLocaleTimeString(),
        deadline: getCheckOutDeadline(),
        notification: "Your attempt to check out after hours has been recorded."
      }, { status: 403 })
    }

    // Enhanced device sharing detection for checkout
    const device_info = body.device_info
    let deviceSharingWarning = null
    
    if (device_info?.device_id) {
      const getValidIpAddress = () => {
        const possibleIps = [
          request.ip,
          request.headers.get("x-forwarded-for")?.split(",")[0]?.trim(),
          request.headers.get("x-real-ip"),
        ]
        for (const ip of possibleIps) {
          if (ip && ip !== "unknown" && ip !== "::1" && ip !== "127.0.0.1") {
            return ip
          }
        }
        return null
      }

      const ipAddress = getValidIpAddress()
      const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString()
      
      console.log("[v0] Checkout - Enhanced device sharing check:", {
        deviceId: device_info.device_id,
        ipAddress: ipAddress,
        userId: user.id
      })
      
      // OPTIMIZATION: Parallelize device sharing checks
      const [
        { data: recentDeviceSession },
        { data: ipSession }
      ] = await Promise.all([
        supabase
          .from("device_sessions")
          .select("user_id, last_activity, ip_address, device_id")
          .eq("device_id", device_info.device_id)
          .neq("user_id", user.id)
          .gte("last_activity", twoHoursAgo)
          .order("last_activity", { ascending: false })
          .limit(1)
          .maybeSingle(),
        ipAddress ? supabase
          .from("device_sessions")
          .select("user_id, last_activity, ip_address, device_id")
          .eq("ip_address", ipAddress)
          .neq("user_id", user.id)
          .neq("device_id", device_info.device_id)
          .gte("last_activity", twoHoursAgo)
          .order("last_activity", { ascending: false })
          .limit(1)
          .maybeSingle()
          : Promise.resolve({ data: null })
      ])
      
      let ipSharingSession = ipSession
      
      // Process device sharing warnings
      if (recentDeviceSession) {
        const { data: previousUserProfile } = await supabase
          .from("user_profiles")
          .select("first_name, last_name, employee_id")
          .eq("id", recentDeviceSession.user_id)
          .single()

        if (previousUserProfile) {
          const previousUserName = `${previousUserProfile.first_name} ${previousUserProfile.last_name}`
          const timeSinceLastUse = Math.round((Date.now() - new Date(recentDeviceSession.last_activity).getTime()) / (1000 * 60))
          
          deviceSharingWarning = {
            type: "device_sharing",
            message: `Device sharing detected during checkout: ${device_info.device_type} (${device_info.device_name}, MAC ${device_info.device_id}) was used by ${previousUserName} (${previousUserProfile.employee_id}) ${timeSinceLastUse} min ago.`,
            deviceDetails: {
              mac_address: device_info.device_id,
              device_type: device_info.device_type,
              device_name: device_info.device_name
            }
          }

          console.warn(`[v0] ⚠️ CHECKOUT - Device Sharing: ${device_info.device_type} (${device_info.device_name}, MAC ${device_info.device_id}) used by ${previousUserName}`)

          await supabase.from("audit_logs").insert({
            user_id: user.id,
            action: "checkout_device_sharing_detected",
            table_name: "device_sessions",
            record_id: device_info.device_id,
            new_values: {
              current_user: user.id,
              previous_user: recentDeviceSession.user_id,
              previous_user_name: previousUserName,
              time_since_last_use_minutes: timeSinceLastUse,
              device_mac_address: device_info.device_id,
              device_type: device_info.device_type,
              device_name: device_info.device_name,
              current_ip: ipAddress,
              previous_ip: recentDeviceSession.ip_address,
              detection_method: "device_fingerprint",
              browser_info: device_info.browser_info
            },
            ip_address: ipAddress || null,
            user_agent: request.headers.get("user-agent"),
          })
        }
      } else if (ipSharingSession) {
        const { data: ipSharerProfile } = await supabase
          .from("user_profiles")
          .select("first_name, last_name, employee_id")
          .eq("id", ipSharingSession.user_id)
          .single()

        if (ipSharerProfile) {
          const sharerName = `${ipSharerProfile.first_name} ${ipSharerProfile.last_name}`
          const timeSinceLastUse = Math.round((Date.now() - new Date(ipSharingSession.last_activity).getTime()) / (1000 * 60))
          
          deviceSharingWarning = {
            type: "ip_sharing",
            message: `IP sharing detected during checkout: Network ${ipAddress} was used by ${sharerName} (${ipSharerProfile.employee_id}) ${timeSinceLastUse} min ago. Current device: ${device_info.device_type} (${device_info.device_name}, MAC ${device_info.device_id}).`,
            deviceDetails: {
              mac_address: device_info.device_id,
              device_type: device_info.device_type,
              device_name: device_info.device_name
            }
          }

          console.warn(`[v0] ⚠️ CHECKOUT - IP Sharing: Current ${device_info.device_type} (${device_info.device_name}, MAC ${device_info.device_id}) | Previous MAC: ${ipSharingSession.device_id}`)

          await supabase.from("audit_logs").insert({
            user_id: user.id,
            action: "checkout_ip_sharing_detected",
            table_name: "device_sessions",
            record_id: ipAddress || "unknown",
            new_values: {
              current_user: user.id,
              previous_user: ipSharingSession.user_id,
              previous_user_name: sharerName,
              time_since_last_use_minutes: timeSinceLastUse,
              current_device_mac: device_info.device_id,
              current_device_type: device_info.device_type,
              current_device_name: device_info.device_name,
              previous_device_mac: ipSharingSession.device_id,
              shared_ip: ipAddress,
              detection_method: "ip_address",
              browser_info: device_info.browser_info
            },
            ip_address: ipAddress || null,
            user_agent: request.headers.get("user-agent"),
          })
        }
      }
    }

    const checkInDate = new Date(attendanceRecord.check_in_time).toISOString().split("T")[0]
    const currentDate = now.toISOString().split("T")[0]

    if (checkInDate !== currentDate) {
      return NextResponse.json(
        {
          error:
            "Check-out must be done before 11:59 PM on the same day. The system has switched to check-in mode for the new day.",
          requiresNewCheckIn: true,
        },
        { status: 400 },
      )
    }

    const { data: qccLocations, error: locationsError } = await supabase
      .from("geofence_locations")
      .select("id, name, address, latitude, longitude, radius_meters, district_id")
      .eq("is_active", true)

    if (locationsError || !qccLocations || qccLocations.length === 0) {
      return NextResponse.json({ error: "No active QCC locations found" }, { status: 400 })
    }

    // OPTIMIZATION: Parallelize settings fetches
    const [
      { data: settingsData },
      { data: deviceRadiusSettings },
    ] = await Promise.all([
      supabase.from("system_settings").select("geo_settings").maybeSingle(),
      supabase
        .from("device_radius_settings")
        .select("device_type, check_out_radius_meters")
        .eq("is_active", true),
    ])

    // Get device type from request headers (sent by client)
    const deviceType = request.headers.get("x-device-type") || "desktop"
    
    // Find the checkout radius for this device type, default to 1000m if not found
    let deviceCheckOutRadius = 1000
    if (deviceRadiusSettings && deviceRadiusSettings.length > 0) {
      const deviceRadiusSetting = deviceRadiusSettings.find((s: any) => s.device_type === deviceType)
      if (deviceRadiusSetting) {
        deviceCheckOutRadius = deviceRadiusSetting.check_out_radius_meters
      }
    }

    console.log("[v0] Checkout - Device radius settings:", {
      deviceType,
      checkOutRadius: deviceCheckOutRadius,
      foundSettings: deviceRadiusSettings?.length || 0,
    })

    let checkoutLocationData = null

    // Determine whether this attendance record was created from an approved off-premises request
    const isAttendanceOffPremises = !!attendanceRecord.on_official_duty_outside_premises || !!attendanceRecord.is_remote_location

    if (!qr_code_used && latitude && longitude) {
      const userLocation: LocationData = {
        latitude,
        longitude,
        accuracy: 10,
      }

      // If the staff was checked-in via approved off-premises, skip strict geofence validation
      if (!isAttendanceOffPremises) {
        const validation = validateCheckoutLocation(userLocation, qccLocations, deviceCheckOutRadius)

        if (!validation.canCheckOut) {
          return NextResponse.json(
            {
              error: `You are currently out of range. Check-out requires being within range of your assigned QCC location. ${validation.message}`,
            },
            { status: 400 },
          )
        }

        checkoutLocationData = validation.nearestLocation
      } else {
        // off-premises checked-in — treat this as remote checkout (no geofence enforcement)
        checkoutLocationData = null
      }
    } else if (location_id) {
      const { data: locationData, error: locationError } = await supabase
        .from("geofence_locations")
        .select("id, name, address, district_id, districts(name)")
        .eq("id", location_id)
        .single()

      if (!locationError && locationData) {
        checkoutLocationData = locationData
      }
    }

    // (already determined earlier for time-restriction logic)
    // If staff was checked in via an APPROVED off‑premises request, allow remote checkout

    if (!checkoutLocationData && !isOffPremisesCheckedIn) {
      // user is out of range and not already flagged remote; allow remote checkout
      // immediately rather than blocking
      console.log("[v0] Out-of-range checkout allowed (remote)")
    }

    const checkInTime = new Date(attendanceRecord.check_in_time)
    const checkOutTime = new Date()
    const workHours = (checkOutTime.getTime() - checkInTime.getTime()) / (1000 * 60 * 60)

    // determine remote checkout status: anything outside a known location is treated
    // as a remote/off-premises checkout.  Approved off-premises check-ins are also
    // included, though the first condition already covers them.
    const willBeRemoteCheckout = !checkoutLocationData || isOffPremisesCheckedIn

    // Get user's assigned location with working hours configuration
    const { data: userProfileData } = await supabase
      .from("user_profiles")
      .select(`
        role,
        departments(code, name),
        assigned_location_id,
        assigned_location:geofence_locations!user_profiles_assigned_location_id_fkey (
          id,
          name,
          check_out_end_time,
          require_early_checkout_reason
        )
      `)
      .eq("id", user.id)
      .maybeSingle()

    // Get location-specific checkout end time (default to 17:00 if not set)
    const checkOutEndTime = userProfileData?.assigned_location?.check_out_end_time || "17:00"
    const requireEarlyCheckoutReason = userProfileData?.assigned_location?.require_early_checkout_reason ?? true
    const effectiveRequireEarlyCheckoutReason = requiresEarlyCheckoutReason(checkOutTime, requireEarlyCheckoutReason, userProfileData?.role)
    
    // Parse checkout end time (HH:MM format)
    const [endHour, endMinute] = checkOutEndTime.split(":").map(Number)
    const checkoutEndTimeMinutes = endHour * 60 + (endMinute || 0)
    const currentTimeMinutes = checkOutTime.getHours() * 60 + checkOutTime.getMinutes()
    
    const isEarlyCheckout = currentTimeMinutes < checkoutEndTimeMinutes
    
    // determine weekend status for logging and warnings
    const isWeekend = checkOutTime.getDay() === 0 || checkOutTime.getDay() === 6
    
    let earlyCheckoutWarning = null

    console.log("[v0] API Checkout validation:", {
      userId: user.id,
      assignedLocation: userProfileData?.assigned_location?.name || "Unknown",
      checkOutEndTime,
      currentTime: `${checkOutTime.getHours()}:${checkOutTime.getMinutes().toString().padStart(2, '0')}`,
      isEarlyCheckout,
      requireEarlyCheckoutReason,
      isWeekend,
    })

    // Only mark earlyCheckoutWarning when the location requires a reason AND it's NOT a weekend
    if (isEarlyCheckout && effectiveRequireEarlyCheckoutReason && !isWeekend) {
      earlyCheckoutWarning = {
        message: `Early checkout detected at ${checkOutTime.toLocaleTimeString()}. Standard work hours end at ${checkOutEndTime}.`,
        checkoutTime: checkOutTime.toISOString(),
        standardEndTime: checkOutEndTime,
      }
      // Require early checkout reason
      if (!early_checkout_reason || early_checkout_reason.trim().length === 0) {
        return NextResponse.json({
          error: "Early checkout reason is required when checking out before standard end time",
          requiresEarlyCheckoutReason: true,
          checkoutTime: checkOutTime.toLocaleTimeString(),
          standardEndTime: checkOutEndTime,
        }, { status: 400 })
      }
    }

    const checkoutData: Record<string, any> = {
      check_out_time: checkOutTime.toISOString(),
      check_out_location_id: checkoutLocationData?.id || null,
      work_hours: Math.round(workHours * 100) / 100,
      updated_at: new Date().toISOString(),
      check_out_method: willBeRemoteCheckout ? "remote_offpremises" : (qr_code_used ? "qr_code" : "gps"),
      check_out_location_name: checkoutLocationData?.name || (willBeRemoteCheckout ? "Off‑Premises (approved)" : "Unknown Location"),
      // mark remote checkout if user was approved off‑premises and not within a QCC location
      is_remote_checkout: willBeRemoteCheckout || false,
    }

    if (latitude && longitude) {
      checkoutData.check_out_latitude = latitude
      checkoutData.check_out_longitude = longitude
    }

    if (qr_code_used && qr_timestamp) {
      checkoutData.qr_check_out_timestamp = qr_timestamp
    }

    if (early_checkout_reason) {
      checkoutData.early_checkout_reason = early_checkout_reason
    }

    // Use admin client for UPDATE to bypass RLS policies
    let adminSupabase
    try {
      adminSupabase = await createAdminClient()
      console.log("[v0] Admin client created successfully for checkout")
    } catch (adminClientError) {
      console.error("[v0] Admin client creation failed, will use regular client:", adminClientError)
      // Fallback: use regular client - the RLS policy should allow updating own record
      adminSupabase = null
    }

    // CRITICAL: Always use admin client for checkout updates
    // The regular client with ANON key cannot bypass RLS to update check_out_time
    let adminSupabase
    try {
      adminSupabase = await createAdminClient()
      if (!adminSupabase) {
        throw new Error("Admin client creation returned null/undefined")
      }
      console.log("[v0] Admin client created successfully for checkout")
    } catch (adminClientError) {
      console.error("[v0] CRITICAL: Failed to create admin client for checkout:", adminClientError)
      console.error("[v0] SUPABASE_SERVICE_ROLE_KEY available:", !!process.env.SUPABASE_SERVICE_ROLE_KEY)
      // Do NOT fallback to regular client for checkout - it won't work due to RLS
      return NextResponse.json(
        {
          error: "Critical: Unable to initialize checkout - database access denied",
          details: process.env.NODE_ENV !== "production" ? adminClientError instanceof Error ? adminClientError.message : String(adminClientError) : undefined,
        },
        { status: 500 },
      )
    }

    const { error: updateError, data: updateData } = await adminSupabase
      .from("attendance_records")
      .update(checkoutData)
      .eq("id", attendanceRecord.id)
      .select("*")
      .single()

    console.log("[v0] Checkout update result:", { 
      error: updateError, 
      hasData: !!updateData, 
      id: attendanceRecord.id,
      checkoutTimeInResponse: updateData?.check_out_time
    })

    if (updateError) {
      console.error("[v0] Update error:", updateError)

      const devDetails = process.env.NODE_ENV === "production" ? undefined : {
        message: updateError.message,
        code: updateError.code,
        details: updateError.details || updateError.hint || null,
      }

      return NextResponse.json({ error: "Failed to record check-out", dbError: devDetails }, { status: 500 })
    }

    console.log("[v0] Checkout update successful for attendance record:", attendanceRecord.id)

    // Use the updated record from the response if available, otherwise fetch it
    let updatedRecord = updateData
    
    if (!updatedRecord) {
      const { data: fetchedRecord, error: fetchError } = await supabase
        .from("attendance_records")
        .select("*")
        .eq("id", attendanceRecord.id)
        .single()

      if (fetchError) {
        console.error("[v0] Fetch error after update:", fetchError)
        // Still consider this a success since the update happened
        return NextResponse.json({
          success: true,
          earlyCheckoutWarning,
          deviceSharingWarning,
          data: { ...checkoutData, id: attendanceRecord.id },
          message: `Successfully checked out. Work hours: ${(Math.round(checkoutData.work_hours * 100) / 100).toFixed(2)}`,
        })
      }
      
      updatedRecord = fetchedRecord
    }

    try {
      await supabase.from("audit_logs").insert({
        user_id: user.id,
        action: "check_out",
        table_name: "attendance_records",
        record_id: attendanceRecord.id,
        old_values: attendanceRecord,
        new_values: updatedRecord,
        ip_address: request.ip || null,
        user_agent: request.headers.get("user-agent"),
      })
    } catch (auditError) {
      console.error("[v0] Audit log error (non-critical):", auditError)
    }

    return NextResponse.json({
      success: true,
      earlyCheckoutWarning,
      deviceSharingWarning,
      data: updatedRecord,
      message: `Successfully checked out at ${checkoutLocationData?.name}. Work hours: ${workHours.toFixed(2)}`,
    })
  } catch (error) {
    console.error("[v0] Check-out error:", error)
    return NextResponse.json(
      { error: `Internal server error: ${error instanceof Error ? error.message : "Unknown error"}` },
      { status: 500 },
    )
  }
}
