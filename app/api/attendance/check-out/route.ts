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

    console.log("[v0] Check-out request:", { latitude, longitude, location_id, qr_code_used })

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
      console.log("[v0] No attendance record found:", findError)
      return NextResponse.json({ error: "No check-in record found for today" }, { status: 400 })
    }

    if (attendanceRecord.check_out_time) {
      console.log("[v0] Already checked out:", attendanceRecord.check_out_time)
      return NextResponse.json({ error: "Already checked out today" }, { status: 400 })
    }

    let checkoutLocationData = null
    let isRemoteCheckout = false

    if (location_id) {
      const { data: locationData, error: locationError } = await supabase
        .from("geofence_locations")
        .select("id, name, address, district_id, districts(name)")
        .eq("id", location_id)
        .single()

      if (!locationError && locationData) {
        checkoutLocationData = locationData
        console.log("[v0] Using provided location:", locationData.name)
      }
    }

    if (!checkoutLocationData) {
      const { data: defaultLocation } = await supabase
        .from("geofence_locations")
        .select("id, name, address, latitude, longitude, district_id, districts(name)")
        .order("id")
        .limit(1)

      if (defaultLocation && defaultLocation.length > 0) {
        checkoutLocationData = defaultLocation[0]
        isRemoteCheckout = true
        console.log("[v0] Using default location:", checkoutLocationData.name)
      }
    }

    // Calculate work hours
    const checkInTime = new Date(attendanceRecord.check_in_time)
    const checkOutTime = new Date()
    const workHours = (checkOutTime.getTime() - checkInTime.getTime()) / (1000 * 60 * 60)

    const checkoutData = {
      check_out_time: checkOutTime.toISOString(),
      check_out_location_id: checkoutLocationData?.id || null,
      work_hours: Math.round(workHours * 100) / 100,
      updated_at: new Date().toISOString(),
      check_out_method: qr_code_used ? "qr_code" : "gps",
      check_out_location_name: checkoutLocationData?.name || "Remote Location",
      is_remote_checkout: isRemoteCheckout,
    }

    // Add GPS coordinates only if available
    if (latitude && longitude) {
      checkoutData.check_out_latitude = latitude
      checkoutData.check_out_longitude = longitude
      console.log("[v0] GPS coordinates recorded")
    } else {
      console.log("[v0] No GPS coordinates available")
    }

    // Add QR code timestamp if used
    if (qr_code_used && qr_timestamp) {
      checkoutData.qr_check_out_timestamp = qr_timestamp
    }

    const isDifferentLocation = attendanceRecord.check_in_location_id !== (checkoutLocationData?.id || null)

    console.log("[v0] Updating attendance record with:", checkoutData)

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
      console.error("[v0] Update error:", updateError)
      return NextResponse.json(
        { error: `Failed to record check-out: ${updateError.message}` },
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

    console.log("[v0] Successfully updated attendance record")

    try {
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
          is_remote_checkout: isRemoteCheckout,
          work_hours_calculated: workHours,
        },
        ip_address: request.ip || null,
        user_agent: request.headers.get("user-agent"),
      })
      console.log("[v0] Audit log created successfully")
    } catch (auditError) {
      console.error("[v0] Audit log error (non-critical):", auditError)
    }

    let locationMessage = ""
    if (isRemoteCheckout) {
      locationMessage = `Checked out remotely (reference: ${checkoutLocationData?.name || "Unknown"})`
    } else if (isDifferentLocation) {
      locationMessage = `Checked out at ${checkoutLocationData?.name} (different from check-in location: ${attendanceRecord.geofence_locations?.name})`
    } else {
      locationMessage = `Checked out at ${checkoutLocationData?.name || "Unknown Location"}`
    }

    console.log("[v0] Check-out successful:", locationMessage)

    return NextResponse.json(
      {
        success: true,
        data: {
          ...updatedRecord,
          location_tracking: {
            check_in_location: attendanceRecord.geofence_locations?.name,
            check_out_location: checkoutLocationData?.name,
            different_locations: isDifferentLocation,
            is_remote_checkout: isRemoteCheckout,
            check_out_method: checkoutData.check_out_method,
            work_hours: workHours,
          },
        },
        message: `Successfully checked out. ${locationMessage}. Work hours: ${workHours.toFixed(2)}`,
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
    console.error("[v0] Check-out error:", error)
    return NextResponse.json(
      { error: `Internal server error: ${error instanceof Error ? error.message : "Unknown error"}` },
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
