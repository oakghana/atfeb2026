import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"
import { calculateDistance } from "@/lib/geolocation"

export async function POST(request: Request) {
  try {
    console.log("[v0] QR check-in API called")

    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      console.log("[v0] No authenticated user")
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    console.log("[v0] QR check-in request body:", body)

    const { location_id, qr_timestamp, device_info, userLatitude, userLongitude } = body

    if (!location_id) {
      return NextResponse.json({ error: "Location ID is required" }, { status: 400 })
    }

    if (userLatitude === undefined || userLongitude === undefined) {
      return NextResponse.json(
        {
          error: "GPS location is required for QR code check-in",
          message: "Please enable location services to use QR code check-in",
        },
        { status: 400 },
      )
    }

    const { data: location, error: locationError } = await supabase
      .from("geofence_locations")
      .select("*")
      .eq("id", location_id)
      .eq("is_active", true)
      .maybeSingle()

    if (locationError || !location) {
      console.log("[v0] Location not found or inactive:", locationError)
      return NextResponse.json({ error: "Invalid or inactive location" }, { status: 400 })
    }

    const distance = calculateDistance(userLatitude, userLongitude, location.latitude, location.longitude)

    console.log("[v0] QR scan distance from location:", distance, "meters")

    const QR_PROXIMITY_LIMIT = 40 // 40 meters for QR code check-in

    if (distance > QR_PROXIMITY_LIMIT) {
      console.log("[v0] User too far from location for QR check-in:", distance, "meters")
      return NextResponse.json(
        {
          error: "Too far from location",
          message: `You must be within ${QR_PROXIMITY_LIMIT} meters of ${location.name} to use QR code check-in. You are currently ${Math.round(distance)} meters away.`,
          distance: Math.round(distance),
          requiredDistance: QR_PROXIMITY_LIMIT,
          locationName: location.name,
        },
        { status: 403 },
      )
    }

    console.log("[v0] Location verified via QR code - within 40m proximity:", location.name)

    const now = new Date()
    const today = now.toISOString().split("T")[0]

    const { data: existingAttendance, error: attendanceError } = await supabase
      .from("attendance_records")
      .select("*")
      .eq("user_id", user.id)
      .gte("check_in_time", `${today}T00:00:00Z`)
      .lt("check_in_time", `${today}T23:59:59Z`)
      .maybeSingle()

    if (attendanceError) {
      console.error("[v0] Error checking existing attendance:", attendanceError)
    }

    let missedCheckoutWarning = null

    if (existingAttendance && !existingAttendance.check_out_time) {
      const checkInDate = new Date(existingAttendance.check_in_time).toISOString().split("T")[0]

      if (checkInDate !== today) {
        console.log("[v0] Found unclosed attendance from previous day, auto-closing...")

        const previousDayEnd = new Date(`${checkInDate}T23:59:59Z`)
        const checkInTime = new Date(existingAttendance.check_in_time)
        const workHours = (previousDayEnd.getTime() - checkInTime.getTime()) / (1000 * 60 * 60)

        await supabase
          .from("attendance_records")
          .update({
            check_out_time: previousDayEnd.toISOString(),
            work_hours: workHours,
            auto_checkout: true,
            notes: "Auto checked out at 11:59 PM (missed checkout)",
          })
          .eq("id", existingAttendance.id)

        missedCheckoutWarning = {
          message:
            "You did not check out yesterday. Your previous day's attendance has been automatically closed at 11:59 PM.",
          previousDate: checkInDate,
          autoCheckoutTime: previousDayEnd.toISOString(),
        }

        console.log("[v0] Previous day auto-closed successfully")
      } else {
        return NextResponse.json({ error: "Already checked in today" }, { status: 400 })
      }
    } else if (existingAttendance && existingAttendance.check_out_time) {
      return NextResponse.json({ error: "Already completed attendance for today" }, { status: 400 })
    }

    const { data: attendance, error: insertError } = await supabase
      .from("attendance_records")
      .insert({
        user_id: user.id,
        check_in_location_id: location.id,
        check_in_location_name: location.name,
        check_in_time: now.toISOString(),
        check_in_method: "qr_code",
        check_in_accuracy: Math.round(distance), // Distance from location when QR scanned
        check_in_browser: device_info?.browser || "qr_scanner",
        status: "present",
        notes: qr_timestamp
          ? `QR code scanned at ${new Date(qr_timestamp).toLocaleString()} - ${Math.round(distance)}m from location`
          : `QR code check-in - ${Math.round(distance)}m from location`,
      })
      .select()
      .single()

    if (insertError) {
      console.error("[v0] Failed to create attendance record:", insertError)
      return NextResponse.json({ error: "Failed to record attendance" }, { status: 500 })
    }

    console.log("[v0] Attendance record created via QR code (within 40m):", attendance.id)

    if (device_info) {
      await supabase.from("device_sessions").insert({
        user_id: user.id,
        attendance_record_id: attendance.id,
        device_info: device_info,
        session_start: now.toISOString(),
      })
    }

    await supabase.from("audit_logs").insert({
      user_id: user.id,
      action: "qr_check_in",
      table_name: "attendance_records",
      record_id: attendance.id,
      new_values: {
        location: location.name,
        check_in_method: "qr_code",
        timestamp: now.toISOString(),
        distance_meters: Math.round(distance),
      },
    })

    console.log("[v0] QR check-in completed successfully - verified within 40m")

    return NextResponse.json({
      success: true,
      message: `Successfully checked in at ${location.name} using QR code`,
      data: {
        attendance,
        location_tracking: {
          location_name: location.name,
          check_in_method: "qr_code",
          distance_meters: Math.round(distance),
          proximity_verified: true,
        },
      },
      missedCheckoutWarning,
    })
  } catch (error) {
    console.error("[v0] QR check-in error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
