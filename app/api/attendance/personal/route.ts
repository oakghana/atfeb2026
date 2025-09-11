import { type NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"

export async function GET(request: NextRequest) {
  try {
    const cookieStore = cookies()
    const supabase = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value
        },
      },
    })

    // Get current user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const startDate = searchParams.get("startDate")
    const endDate = searchParams.get("endDate")
    const status = searchParams.get("status")

    // Build query for attendance records
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
        check_in_location:geofence_locations!check_in_location_id(name, address),
        check_out_location:geofence_locations!check_out_location_id(name, address)
      `)
      .eq("user_id", user.id)
      .order("check_in_time", { ascending: false })

    // Apply date filters
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
      console.error("Error fetching attendance records:", recordsError)
      return NextResponse.json({ error: "Failed to fetch attendance records" }, { status: 500 })
    }

    // Calculate summary statistics
    const summary = {
      totalDays: records?.length || 0,
      presentDays: records?.filter((r) => r.status === "present").length || 0,
      absentDays: records?.filter((r) => r.status === "absent").length || 0,
      lateDays: records?.filter((r) => r.status === "late").length || 0,
      totalHours: records?.reduce((sum, r) => sum + (r.work_hours || 0), 0) || 0,
      averageHours: 0,
      statusCounts: {},
      monthlyStats: {},
    }

    // Calculate average hours
    const workingDays = records?.filter((r) => r.work_hours && r.work_hours > 0).length || 0
    summary.averageHours = workingDays > 0 ? summary.totalHours / workingDays : 0

    // Calculate status counts
    records?.forEach((record) => {
      const status = record.status || "unknown"
      summary.statusCounts[status] = (summary.statusCounts[status] || 0) + 1
    })

    // Calculate monthly stats
    records?.forEach((record) => {
      const month = new Date(record.check_in_time).toISOString().slice(0, 7) // YYYY-MM
      if (!summary.monthlyStats[month]) {
        summary.monthlyStats[month] = { days: 0, hours: 0 }
      }
      summary.monthlyStats[month].days += 1
      summary.monthlyStats[month].hours += record.work_hours || 0
    })

    return NextResponse.json({
      records: records || [],
      summary,
    })
  } catch (error) {
    console.error("Error in personal attendance API:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
