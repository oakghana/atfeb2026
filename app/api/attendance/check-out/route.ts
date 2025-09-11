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
    const { latitude, longitude, location_id, qr_code_used, qr_timestamp } = body

    if (!qr_code_used && (!latitude || !longitude)) {
      return NextResponse.json({ error: "Location coordinates are required for GPS check-out" }, { status: 400 })
    }

    // Find today's attendance record
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
      .single()

    if (findError || !attendanceRecord) {
      return NextResponse.json({ error: "No check-in record found for today" }, { status: 400 })
    }

    if (attendanceRecord.check_out_time) {
      return NextResponse.json({ error: "Already checked out today" }, { status: 400 })
    }

    const { data: checkoutLocationData, error: checkoutLocationError } = await supabase
      .from("geofence_locations")
      .select("name, address, district_id, districts(name)")
      .eq("id", location_id)
      .single()

    if (checkoutLocationError) {
      console.error("Checkout location lookup error:", checkoutLocationError)
    }

    // Calculate work hours
    const checkInTime = new Date(attendanceRecord.check_in_time)
    const checkOutTime = new Date()
    const workHours = (checkOutTime.getTime() - checkInTime.getTime()) / (1000 * 60 * 60)

    const checkoutData = {
      check_out_time: checkOutTime.toISOString(),
      check_out_location_id: location_id,
      work_hours: Math.round(workHours * 100) / 100, // Round to 2 decimal places
      updated_at: new Date().toISOString(),
      check_out_method: qr_code_used ? "qr_code" : "gps",
      check_out_location_name: checkoutLocationData?.name || null,
    }

    // Add GPS coordinates only if available
    if (latitude && longitude) {
      checkoutData.check_out_latitude = latitude
      checkoutData.check_out_longitude = longitude
    }

    // Add QR code timestamp if used
    if (qr_code_used && qr_timestamp) {
      checkoutData.qr_check_out_timestamp = qr_timestamp
    }

    const isDifferentLocation = attendanceRecord.check_in_location_id !== location_id

    // Update attendance record
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
      console.error("Update error:", updateError)
      return NextResponse.json({ error: "Failed to record check-out" }, { status: 500 })
    }

    await supabase.from("audit_logs").insert({
      user_id: user.id,
      action: "check_out",
      table_name: "attendance_records",
      record_id: attendanceRecord.id,
      old_values: attendanceRecord,
      new_values: {
        ...updatedRecord,
        checkout_location_name: checkoutLocationData?.name,
        checkout_district_name: checkoutLocationData?.districts?.name,
        check_out_method: checkoutData.check_out_method,
        different_checkout_location: isDifferentLocation,
        work_hours_calculated: workHours,
      },
      ip_address: request.ip || null,
      user_agent: request.headers.get("user-agent"),
    })

    const locationMessage = isDifferentLocation
      ? `Checked out at ${checkoutLocationData?.name} (different from check-in location: ${attendanceRecord.geofence_locations?.name})`
      : `Checked out at ${checkoutLocationData?.name}`

    return NextResponse.json({
      success: true,
      data: {
        ...updatedRecord,
        location_tracking: {
          check_in_location: attendanceRecord.geofence_locations?.name,
          check_out_location: checkoutLocationData?.name,
          different_locations: isDifferentLocation,
          check_out_method: checkoutData.check_out_method,
          work_hours: workHours,
        },
      },
      message: `Successfully checked out. ${locationMessage}. Work hours: ${workHours.toFixed(2)}`,
    })
  } catch (error) {
    console.error("Check-out error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
