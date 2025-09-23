import { createClient } from "@/lib/supabase/server"
import { type NextRequest, NextResponse } from "next/server"

export async function POST(request: NextRequest) {
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

    const body = await request.json()
    const { latitude, longitude, location_id, device_info, qr_code_used, qr_timestamp } = body

    if (!qr_code_used && (!latitude || !longitude)) {
      return NextResponse.json({ error: "Location coordinates are required for GPS check-in" }, { status: 400 })
    }

    // Check if user already checked in today
    const today = new Date().toISOString().split("T")[0]
    const { data: existingRecord } = await supabase
      .from("attendance_records")
      .select("*")
      .eq("user_id", user.id)
      .gte("check_in_time", `${today}T00:00:00`)
      .lt("check_in_time", `${today}T23:59:59`)
      .single()

    if (existingRecord && existingRecord.check_in_time) {
      return NextResponse.json({ error: "Already checked in today" }, { status: 400 })
    }

    const { data: locationData, error: locationError } = await supabase
      .from("geofence_locations")
      .select("name, address, district_id")
      .eq("id", location_id)
      .single()

    if (locationError) {
      console.error("Location lookup error:", locationError)
    }

    // Get district name separately if needed
    let districtName = null
    if (locationData?.district_id) {
      const { data: district } = await supabase
        .from("districts")
        .select("name")
        .eq("id", locationData.district_id)
        .single()
      districtName = district?.name
    }

    // Create or update device session
    let deviceSessionId = null
    if (device_info) {
      const { data: deviceSession, error: deviceError } = await supabase
        .from("device_sessions")
        .upsert(
          {
            user_id: user.id,
            device_id: device_info.device_id,
            device_name: device_info.device_name,
            device_type: device_info.device_type,
            browser_info: device_info.browser_info,
            ip_address: request.ip || null,
            is_active: true,
            last_activity: new Date().toISOString(),
          },
          { onConflict: "user_id,device_id" },
        )
        .select("id")
        .single()

      if (!deviceError && deviceSession) {
        deviceSessionId = deviceSession.id
      }
    }

    const attendanceData = {
      user_id: user.id,
      check_in_time: new Date().toISOString(),
      check_in_location_id: location_id,
      device_session_id: deviceSessionId,
      status: "present",
      check_in_method: qr_code_used ? "qr_code" : "gps",
      check_in_location_name: locationData?.name || null,
      is_remote_location: false, // Will be calculated based on user's assigned location
    }

    // Add GPS coordinates only if available
    if (latitude && longitude) {
      attendanceData.check_in_latitude = latitude
      attendanceData.check_in_longitude = longitude
    }

    // Add QR code timestamp if used
    if (qr_code_used && qr_timestamp) {
      attendanceData.qr_check_in_timestamp = qr_timestamp
    }

    const { data: userProfile } = await supabase
      .from("user_profiles")
      .select("assigned_location_id")
      .eq("id", user.id)
      .single()

    if (userProfile?.assigned_location_id && userProfile.assigned_location_id !== location_id) {
      attendanceData.is_remote_location = true
    }

    const { data: attendanceRecord, error: attendanceError } = await supabase
      .from("attendance_records")
      .insert(attendanceData)
      .select("*")
      .single()

    if (attendanceError) {
      console.error("Attendance error:", attendanceError)
      return NextResponse.json(
        { error: "Failed to record attendance" },
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

    await supabase.from("audit_logs").insert({
      user_id: user.id,
      action: "check_in",
      table_name: "attendance_records",
      record_id: attendanceRecord.id,
      new_values: {
        ...attendanceRecord,
        location_name: locationData?.name,
        district_name: districtName,
        check_in_method: attendanceData.check_in_method,
        is_remote_location: attendanceData.is_remote_location,
      },
      ip_address: request.ip || null,
      user_agent: request.headers.get("user-agent"),
    })

    return NextResponse.json(
      {
        success: true,
        data: {
          ...attendanceRecord,
          location_tracking: {
            location_name: locationData?.name,
            district_name: districtName,
            is_remote_location: attendanceData.is_remote_location,
            check_in_method: attendanceData.check_in_method,
          },
        },
        message: attendanceData.is_remote_location
          ? `Successfully checked in at ${locationData?.name} (different from your assigned location)`
          : `Successfully checked in at ${locationData?.name}`,
      },
      {
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": "no-cache, no-store, must-revalidate, private",
          Pragma: "no-cache",
          Expires: "0",
          "X-Content-Type-Options": "nosniff",
        },
      },
    )
  } catch (error) {
    console.error("Check-in error:", error)
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
