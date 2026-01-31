import { createClient } from "@/lib/supabase/server"
import { type NextRequest, NextResponse } from "next/server"
import { getDeviceInfo } from "@/lib/device-info"

export async function POST(request: NextRequest) {
  const startTime = performance.now()

  try {
    const supabase = await createClient()

    // Get user (should be cached by middleware)
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const { location_id, latitude, longitude, accuracy, device_info, location_name, is_remote_location } = body

    // Check today's attendance in parallel
    const today = new Date().toISOString().split("T")[0]
    const { data: existingRecord } = await supabase
      .from("attendance_records")
      .select("id, check_in_time")
      .eq("user_id", user.id)
      .gte("check_in_time", `${today}T00:00:00`)
      .lt("check_in_time", `${today}T23:59:59`)
      .maybeSingle()

    if (existingRecord?.check_in_time) {
      const checkInTime = new Date(existingRecord.check_in_time).toLocaleTimeString("en-US", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: true,
      })

      return NextResponse.json(
        {
          error: "You have already checked in today",
          message: `You checked in at ${checkInTime}`,
          timestamp: existingRecord.check_in_time,
          type: "duplicate_checkin",
        },
        { status: 400 }
      )
    }

    // Insert attendance record (optimized query)
    const { data: record, error: insertError } = await supabase
      .from("attendance_records")
      .insert({
        user_id: user.id,
        check_in_time: new Date().toISOString(),
        check_in_location_id: location_id,
        check_in_location_name: location_name,
        latitude,
        longitude,
        accuracy,
        device_info,
        is_remote_location: is_remote_location || false,
      })
      .select("id, check_in_time")
      .single()

    if (insertError) {
      console.error("[v0] Check-in insertion error:", insertError)
      return NextResponse.json(
        { error: "Failed to record check-in" },
        { status: 500 }
      )
    }

    const elapsedTime = performance.now() - startTime

    return NextResponse.json({
      success: true,
      message: "Checked in successfully",
      data: record,
      performanceMetrics: {
        elapsedMs: Math.round(elapsedTime),
      },
    })
  } catch (error) {
    console.error("[v0] Fast check-in error:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}

export const config = {
  api: {
    bodyParser: {
      sizeLimit: "1mb",
    },
  },
}
