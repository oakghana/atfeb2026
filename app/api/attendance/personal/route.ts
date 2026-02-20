import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export async function GET(request: NextRequest) {
  try {
    console.log("[v0] Personal attendance API - Starting request")
    const supabase = await createClient()

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()
    if (authError || !user) {
      console.log("[v0] Personal attendance API - Auth error:", authError)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    console.log("[v0] Personal attendance API - User authenticated:", user.id)

    const { searchParams } = new URL(request.url)
    const startDate = searchParams.get("startDate")
    const endDate = searchParams.get("endDate")
    const status = searchParams.get("status")

    console.log("[v0] Personal attendance API - Query params:", { startDate, endDate, status })

    let query = supabase
      .from("attendance_records")
      .select(`
        id,
        check_in_time,
        check_out_time,
        status,
        work_hours,
        notes,
        check_in_method,
        check_out_method,
        check_in_location_name,
        check_out_location_name,
        is_remote_location,
        check_in_latitude,
        check_in_longitude,
        check_out_latitude,
        check_out_longitude,
        check_in_location_id,
        check_out_location_id,
        approval_status,
        supervisor_approval_remarks,
        on_official_duty_outside_premises,
        off_premises_request_id
      `)
      .eq("user_id", user.id)
      .order("check_in_time", { ascending: false })

    if (startDate) {
      query = query.gte("check_in_time", startDate)
    }
    if (endDate) {
      query = query.lte("check_in_time", endDate + "T23:59:59")
    }
    if (status && status !== "all") {
      query = query.eq("status", status)
    }

    const { data: records, error: recordsError } = await query

    if (recordsError) {
      console.error("[v0] Personal attendance API - Records error:", recordsError)
      return NextResponse.json({ error: "Failed to fetch attendance records" }, { status: 500 })
    }

    console.log("[v0] Personal attendance API - Found records:", records?.length)

    const locationIds = new Set()
    records?.forEach((record) => {
      if (record.check_in_location_id) locationIds.add(record.check_in_location_id)
      if (record.check_out_location_id) locationIds.add(record.check_out_location_id)
    })

    const locationMap = {}
    if (locationIds.size > 0) {
      const { data: locations } = await supabase
        .from("geofence_locations")
        .select("id, name, address")
        .in("id", Array.from(locationIds))

      locations?.forEach((loc) => {
        locationMap[loc.id] = { name: loc.name, address: loc.address }
      })
    }

    const enhancedRecords = records?.map((record) => ({
      ...record,
      check_in_location: record.check_in_location_name
        ? { name: record.check_in_location_name }
        : locationMap[record.check_in_location_id] || null,
      check_out_location: record.check_out_location_name
        ? { name: record.check_out_location_name }
        : locationMap[record.check_out_location_id] || null,
    }))

    const summary = {
      totalDays: enhancedRecords?.length || 0,
      presentDays: enhancedRecords?.filter((r) => r.status === "present").length || 0,
      absentDays: enhancedRecords?.filter((r) => r.status === "absent").length || 0,
      lateDays: enhancedRecords?.filter((r) => r.status === "late").length || 0,
      totalHours: enhancedRecords?.reduce((sum, r) => sum + (r.work_hours || 0), 0) || 0,
      averageHours: 0,
      statusCounts: {},
      monthlyStats: {},
    }

    const workingDays = enhancedRecords?.filter((r) => r.work_hours && r.work_hours > 0).length || 0
    summary.averageHours = workingDays > 0 ? summary.totalHours / workingDays : 0

    enhancedRecords?.forEach((record) => {
      const status = record.status || "unknown"
      summary.statusCounts[status] = (summary.statusCounts[status] || 0) + 1
    })

    enhancedRecords?.forEach((record) => {
      const month = new Date(record.check_in_time).toISOString().slice(0, 7) // YYYY-MM
      if (!summary.monthlyStats[month]) {
        summary.monthlyStats[month] = { days: 0, hours: 0 }
      }
      summary.monthlyStats[month].days += 1
      summary.monthlyStats[month].hours += record.work_hours || 0
    })

    console.log("[v0] Personal attendance API - Returning data with summary:", summary)

    return NextResponse.json(
      {
        records: enhancedRecords || [],
        summary,
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
    console.error("[v0] Personal attendance API - Unexpected error:", error)
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
