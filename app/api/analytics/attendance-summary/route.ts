import { createClient } from "@/lib/supabase/server"
import { NextRequest, NextResponse } from "next/server"
import { calculateAttendancePercentage, isDateOnLeave } from "@/lib/analytics/leave-analytics"

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const searchParams = request.nextUrl.searchParams
    const monthParam = searchParams.get("month")
    const yearParam = searchParams.get("year")

    const now = new Date()
    const month = monthParam ? parseInt(monthParam) : now.getMonth()
    const year = yearParam ? parseInt(yearParam) : now.getFullYear()

    // Get first and last day of month
    const firstDay = new Date(year, month, 1)
    const lastDay = new Date(year, month + 1, 0)

    // Get user profile with leave info
    const { data: userProfile } = await supabase
      .from("user_profiles")
      .select("leave_status, leave_start_date, leave_end_date")
      .eq("id", user.id)
      .single()

    // Count total working days (excluding weekends)
    let workingDaysCount = 0
    const currentDate = new Date(firstDay)
    while (currentDate <= lastDay) {
      const dayOfWeek = currentDate.getDay()
      // Skip weekends (0 = Sunday, 6 = Saturday)
      if (dayOfWeek !== 0 && dayOfWeek !== 6) {
        workingDaysCount++
      }
      currentDate.setDate(currentDate.getDate() + 1)
    }

    // Get attendance records for the month
    const { data: attendanceRecords } = await supabase
      .from("attendance_records")
      .select("check_in_time")
      .eq("user_id", user.id)
      .gte("check_in_time", firstDay.toISOString())
      .lte("check_in_time", lastDay.toISOString())

    // Count present days
    const presentDays = new Set(
      attendanceRecords?.map((r) => new Date(r.check_in_time).toISOString().split("T")[0]) || []
    ).size

    // Count leave days in the month
    let leaveDays = 0
    if (userProfile?.leave_status === "active" && userProfile?.leave_start_date && userProfile?.leave_end_date) {
      const leaveStart = new Date(userProfile.leave_start_date)
      const leaveEnd = new Date(userProfile.leave_end_date)

      currentDate.setDate(1)
      while (currentDate <= lastDay) {
        const dayOfWeek = currentDate.getDay()
        // Only count weekdays
        if (dayOfWeek !== 0 && dayOfWeek !== 6) {
          if (isDateOnLeave(currentDate, userProfile.leave_start_date, userProfile.leave_end_date, userProfile.leave_status)) {
            leaveDays++
          }
        }
        currentDate.setDate(currentDate.getDate() + 1)
      }
    }

    // Calculate absent days
    const absentDays = workingDaysCount - presentDays - leaveDays

    // Calculate attendance summary
    const summary = calculateAttendancePercentage({
      totalDays: workingDaysCount,
      presentDays,
      absentDays,
      leaveDays,
    })

    return NextResponse.json({
      success: true,
      data: {
        month,
        year,
        summary,
        details: {
          totalWorkingDays: workingDaysCount,
          presentDays,
          absentDays,
          leaveDays,
          percentage: summary.attendancePercentage,
        },
      },
    })
  } catch (error) {
    console.error("[v0] Attendance summary error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
