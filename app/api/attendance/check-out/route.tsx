import { createClient } from "@/lib/supabase/server"
import { type NextRequest, NextResponse } from "next/server"
import { validateCheckoutLocation, type LocationData } from "@/lib/geolocation"

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

    const { data: userProfile } = await supabase
      .from("user_profiles")
      .select("leave_status, leave_end_date")
      .eq("id", user.id)
      .maybeSingle()

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

    const body = await request.json()
    const { latitude, longitude, location_id, qr_code_used, qr_timestamp, early_checkout_reason } = body

    if (!qr_code_used && (!latitude || !longitude)) {
      return NextResponse.json({ error: "Location coordinates are required for GPS check-out" }, { status: 400 })
    }

    const now = new Date()
    const today = new Date().toISOString().split("T")[0]

    const { data: attendanceRecord, error: findError } = await supabase
      .from("attendance_records")
      .select(`
        *,
        geofence_locations!check_in_location_id (
          name,
          address
        )
      `)
      .eq("user_id", user.id)
      .gte("check_in_time", `${today}T00:00:00`)
      .lt("check_in_time", `${today}T23:59:59`)
      .maybeSingle()

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

    const { data: settingsData } = await supabase.from("system_settings").select("geo_settings").maybeSingle()

    const proximitySettings = {
      checkInProximityRange: settingsData?.geo_settings?.checkInProximityRange || 50,
      defaultRadius: settingsData?.geo_settings?.defaultRadius || 20,
      requireHighAccuracy: settingsData?.geo_settings?.requireHighAccuracy ?? true,
      allowManualOverride: settingsData?.geo_settings?.allowManualOverride ?? false,
    }

    let checkoutLocationData = null

    if (!qr_code_used && latitude && longitude) {
      const userLocation: LocationData = {
        latitude,
        longitude,
        accuracy: 10,
      }

      const validation = validateCheckoutLocation(userLocation, qccLocations, proximitySettings)

      if (!validation.canCheckOut) {
        return NextResponse.json(
          {
            error: `Check-out requires being within ${proximitySettings.checkInProximityRange}m of any QCC location. ${validation.message}`,
          },
          { status: 400 },
        )
      }

      checkoutLocationData = validation.nearestLocation
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

    if (!checkoutLocationData) {
      return NextResponse.json(
        {
          error: "Unable to determine check-out location. Please ensure you are within 50m of a QCC location.",
        },
        { status: 400 },
      )
    }

    const checkInTime = new Date(attendanceRecord.check_in_time)
    const checkOutTime = new Date()
    const workHours = (checkOutTime.getTime() - checkInTime.getTime()) / (1000 * 60 * 60)

    const checkOutHour = checkOutTime.getHours()
    const isEarlyCheckout = checkOutHour < 17
    let earlyCheckoutWarning = null

    if (isEarlyCheckout) {
      earlyCheckoutWarning = {
        message: `Early checkout detected at ${checkOutTime.toLocaleTimeString()}. Standard work hours end at 5:00 PM.`,
        checkoutTime: checkOutTime.toISOString(),
        standardEndTime: "17:00:00",
      }
    }

    const checkoutData: Record<string, any> = {
      check_out_time: checkOutTime.toISOString(),
      check_out_location_id: checkoutLocationData?.id || null,
      work_hours: Math.round(workHours * 100) / 100,
      updated_at: new Date().toISOString(),
      check_out_method: qr_code_used ? "qr_code" : "gps",
      check_out_location_name: checkoutLocationData?.name || "Unknown Location",
      is_remote_checkout: false,
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

    const { data: updatedRecord, error: updateError } = await supabase
      .from("attendance_records")
      .update(checkoutData)
      .eq("id", attendanceRecord.id)
      .select(`
        *,
        geofence_locations!check_in_location_id (
          name,
          address
        ),
        checkout_location:geofence_locations!check_out_location_id (
          name,
          address
        )
      `)
      .single()

    if (updateError) {
      console.error("[v0] Update error:", updateError)
      return NextResponse.json({ error: `Failed to record check-out: ${updateError.message}` }, { status: 500 })
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
