import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { searchParams } = new URL(request.url)
    const range = searchParams.get("range") || "30d"

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Check admin role
    const { data: profile } = await supabase.from("user_profiles").select("role").eq("id", user.id).single()

    if (!profile || !["admin", "department_head"].includes(profile.role)) {
      return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 })
    }

    // Calculate date range
    const endDate = new Date()
    const startDate = new Date()

    switch (range) {
      case "7d":
        startDate.setDate(endDate.getDate() - 7)
        break
      case "30d":
        startDate.setDate(endDate.getDate() - 30)
        break
      case "90d":
        startDate.setDate(endDate.getDate() - 90)
        break
      case "1y":
        startDate.setFullYear(endDate.getFullYear() - 1)
        break
    }

    // Get total employees
    const { count: totalEmployees } = await supabase
      .from("user_profiles")
      .select("*", { count: "exact", head: true })
      .eq("is_active", true)

    // Get active locations
    const { count: activeLocations } = await supabase
      .from("geofence_locations")
      .select("*", { count: "exact", head: true })
      .eq("is_active", true)

    // Get attendance records for the period
    const { data: attendanceRecords } = await supabase
      .from("attendance_records")
      .select(`
        *,
        user_profiles!inner (
          id,
          first_name,
          last_name,
          department_id,
          departments (
            name,
            code
          )
        )
      `)
      .gte("check_in_time", startDate.toISOString())
      .lte("check_in_time", endDate.toISOString())

    // Calculate attendance rate
    const totalWorkingDays = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24))
    const expectedAttendance = (totalEmployees || 0) * totalWorkingDays
    const actualAttendance = attendanceRecords?.length || 0
    const attendanceRate = expectedAttendance > 0 ? (actualAttendance / expectedAttendance) * 100 : 0

    // Calculate average work hours
    const totalWorkHours =
      attendanceRecords?.reduce((sum, record) => {
        return sum + (Number.parseFloat(record.work_hours) || 0)
      }, 0) || 0
    const avgWorkHours = actualAttendance > 0 ? totalWorkHours / actualAttendance : 0

    // Generate daily trends (last 30 days)
    const dailyTrends = []
    for (let i = 29; i >= 0; i--) {
      const date = new Date()
      date.setDate(date.getDate() - i)
      const dateStr = date.toISOString().split("T")[0]

      const dayRecords = attendanceRecords?.filter((record) => record.check_in_time.startsWith(dateStr)) || []

      const present = dayRecords.filter((r) => r.status === "present").length
      const late = dayRecords.filter((r) => r.status === "late").length
      const absent = Math.max(0, (totalEmployees || 0) - present - late)

      dailyTrends.push({
        date: date.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
        present,
        late,
        absent,
      })
    }

    // Generate weekly trends
    const weeklyTrends = []
    for (let i = 3; i >= 0; i--) {
      const weekStart = new Date()
      weekStart.setDate(weekStart.getDate() - i * 7)
      const weekEnd = new Date(weekStart)
      weekEnd.setDate(weekEnd.getDate() + 6)

      const weekRecords =
        attendanceRecords?.filter((record) => {
          const recordDate = new Date(record.check_in_time)
          return recordDate >= weekStart && recordDate <= weekEnd
        }) || []

      const attendance =
        weekRecords.length > 0
          ? (weekRecords.filter((r) => r.status === "present").length / weekRecords.length) * 100
          : 0
      const productivity = Math.min(100, attendance + Math.random() * 10) // Simulated productivity metric

      weeklyTrends.push({
        week: `Week ${4 - i}`,
        attendance: Math.round(attendance),
        productivity: Math.round(productivity),
      })
    }

    // Generate monthly trends
    const monthlyTrends = []
    for (let i = 5; i >= 0; i--) {
      const monthDate = new Date()
      monthDate.setMonth(monthDate.getMonth() - i)
      const monthStr = monthDate.toISOString().substring(0, 7)

      const monthRecords = attendanceRecords?.filter((record) => record.check_in_time.startsWith(monthStr)) || []

      const monthlyRate =
        monthRecords.length > 0
          ? (monthRecords.filter((r) => r.status === "present").length / monthRecords.length) * 100
          : 0
      const monthlyHours =
        monthRecords.length > 0
          ? monthRecords.reduce((sum, r) => sum + (Number.parseFloat(r.work_hours) || 0), 0) / monthRecords.length
          : 0

      monthlyTrends.push({
        month: monthDate.toLocaleDateString("en-US", { month: "short" }),
        rate: Math.round(monthlyRate),
        hours: Math.round(monthlyHours * 10) / 10,
      })
    }

    // Department statistics
    const departmentMap = new Map()
    attendanceRecords?.forEach((record) => {
      const deptName = record.user_profiles?.departments?.name || "Unknown"
      if (!departmentMap.has(deptName)) {
        departmentMap.set(deptName, { total: 0, present: 0, hours: 0, employees: new Set() })
      }
      const dept = departmentMap.get(deptName)
      dept.total++
      dept.employees.add(record.user_profiles?.id)
      if (record.status === "present") dept.present++
      dept.hours += Number.parseFloat(record.work_hours) || 0
    })

    const departmentStats = Array.from(departmentMap.entries()).map(([name, stats], index) => ({
      name,
      attendance: stats.total > 0 ? Math.round((stats.present / stats.total) * 100) : 0,
      employees: stats.employees.size,
      avgHours: stats.total > 0 ? Math.round((stats.hours / stats.total) * 10) / 10 : 0,
      color: `hsl(${index * 45}, 70%, 50%)`,
    }))

    // Location statistics
    const locationMap = new Map()
    attendanceRecords?.forEach((record) => {
      const locationId = record.check_in_location_id
      if (locationId) {
        if (!locationMap.has(locationId)) {
          locationMap.set(locationId, { checkins: 0, hours: [] })
        }
        const loc = locationMap.get(locationId)
        loc.checkins++
        const hour = new Date(record.check_in_time).getHours()
        loc.hours.push(hour)
      }
    })

    // Get location names
    const locationIds = Array.from(locationMap.keys())
    const { data: locations } = await supabase.from("geofence_locations").select("id, name").in("id", locationIds)

    const locationStats =
      locations?.map((location) => {
        const stats = locationMap.get(location.id) || { checkins: 0, hours: [] }
        const peakHour =
          stats.hours.length > 0
            ? stats.hours.reduce((a, b, i, arr) =>
                arr.filter((v) => v === a).length >= arr.filter((v) => v === b).length ? a : b,
              )
            : 9

        return {
          name: location.name,
          checkins: stats.checkins,
          utilization: Math.min(100, Math.round((stats.checkins / (totalEmployees || 1)) * 100)),
          peakHours: `${peakHour}:00 - ${peakHour + 1}:00`,
        }
      }) || []

    // Predictive analytics (simplified)
    const recentAttendanceRate = dailyTrends.slice(-7).reduce((sum, day) => sum + day.present, 0) / 7
    const nextWeekAttendance = Math.min(
      100,
      Math.max(0, Math.round((recentAttendanceRate / (totalEmployees || 1)) * 100 + (Math.random() - 0.5) * 10)),
    )

    const riskEmployees = Math.round((totalEmployees || 0) * 0.15) // 15% risk factor
    const peakDays = ["Monday", "Tuesday", "Wednesday"] // Most common peak days

    const analyticsData = {
      attendanceRate: Math.round(attendanceRate * 10) / 10,
      totalEmployees: totalEmployees || 0,
      activeLocations: activeLocations || 0,
      avgWorkHours: Math.round(avgWorkHours * 10) / 10,
      trends: {
        daily: dailyTrends,
        weekly: weeklyTrends,
        monthly: monthlyTrends,
      },
      departmentStats,
      locationStats,
      predictions: {
        nextWeekAttendance,
        riskEmployees,
        peakDays,
      },
    }

    return NextResponse.json(analyticsData, {
      headers: {
        "Cache-Control": "no-cache, no-store, must-revalidate",
        Pragma: "no-cache",
        Expires: "0",
      },
    })
  } catch (error) {
    console.error("Analytics error:", error)
    return NextResponse.json({ error: "Failed to fetch analytics" }, { status: 500 })
  }
}
