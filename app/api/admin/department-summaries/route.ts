import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"

export const dynamic = "force-dynamic"

export async function GET(request: Request) {
  try {
    const supabase = await createClient()
    const { searchParams } = new URL(request.url)
    const period = searchParams.get("period") || "weekly" // weekly, monthly, yearly
    const departmentId = searchParams.get("departmentId")

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Get user profile to check role
    const { data: profile } = await supabase
      .from("user_profiles")
      .select("role, department_id")
      .eq("id", user.id)
      .single()

    if (!profile || (profile.role !== "admin" && profile.role !== "department_head")) {
      return NextResponse.json({ error: "Unauthorized - Admin or Department Head only" }, { status: 403 })
    }

    // Calculate date range based on period
    const today = new Date()
    let startDate: Date
    const endDate = today

    switch (period) {
      case "weekly":
        startDate = new Date(today)
        startDate.setDate(today.getDate() - today.getDay() - 6) // Last Monday
        break
      case "monthly":
        startDate = new Date(today.getFullYear(), today.getMonth(), 1)
        break
      case "yearly":
        startDate = new Date(today.getFullYear(), 0, 1)
        break
      default:
        startDate = new Date(today)
        startDate.setDate(today.getDate() - 7)
    }

    const startDateStr = startDate.toISOString().split("T")[0]
    const endDateStr = endDate.toISOString().split("T")[0]

    // Build query based on role
    let staffQuery = supabase
      .from("user_profiles")
      .select("id, first_name, last_name, email, employee_id, departments(name)")
      .eq("is_active", true)

    // Department heads only see their department
    if (profile.role === "department_head") {
      staffQuery = staffQuery.eq("department_id", profile.department_id)
    } else if (departmentId) {
      // Admins can filter by department
      staffQuery = staffQuery.eq("department_id", departmentId)
    }

    const { data: staff, error: staffError } = await staffQuery

    if (staffError) throw staffError

    // Fetch attendance for all staff
    const { data: allRecords, error: recordsError } = await supabase
      .from("attendance_records")
      .select("*")
      .in("user_id", staff?.map((s) => s.id) || [])
      .gte("check_in_time", `${startDateStr}T00:00:00`)
      .lte("check_in_time", `${endDateStr}T23:59:59`)

    if (recordsError) throw recordsError

    // Group records by user
    const recordsByUser = (allRecords || []).reduce((acc: any, record: any) => {
      if (!acc[record.user_id]) acc[record.user_id] = []
      acc[record.user_id].push(record)
      return acc
    }, {})

    // Calculate summaries for each staff member
    const summaries = staff?.map((staffMember) => {
      const records = recordsByUser[staffMember.id] || []
      const daysWorked = new Set(records.map((r: any) => r.check_in_time.split("T")[0])).size
      const totalWorkHours = records.reduce((sum: number, r: any) => sum + (r.work_hours || 0), 0)

      const standardCheckInTime = new Date(`2000-01-01T08:00:00`)
      const daysOnTime = records.filter((r: any) => {
        const checkInTime = new Date(`2000-01-01T${new Date(r.check_in_time).toTimeString().split(" ")[0]}`)
        return checkInTime <= standardCheckInTime
      }).length

      const daysLate = records.filter((r: any) => {
        const checkInTime = new Date(`2000-01-01T${new Date(r.check_in_time).toTimeString().split(" ")[0]}`)
        return checkInTime > standardCheckInTime
      }).length

      const hasCheckedOutToday = records.some((r: any) => r.check_out_time !== null)

      let expectedDays = 0
      if (period === "weekly") expectedDays = 5
      else if (period === "monthly") expectedDays = Math.floor((today.getDate() / 7) * 5)
      else expectedDays = Math.floor((new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate() / 7) * 5)

      return {
        userId: staffMember.id,
        name: `${staffMember.first_name} ${staffMember.last_name}`,
        email: staffMember.email,
        employeeId: staffMember.employee_id,
        department: staffMember.departments?.name,
        daysWorked,
        daysAbsent: Math.max(0, expectedDays - daysWorked),
        totalWorkHours: totalWorkHours.toFixed(2),
        daysOnTime,
        daysLate,
        attendanceRate: expectedDays > 0 ? ((daysWorked / expectedDays) * 100).toFixed(1) : "0.0",
        status:
          daysWorked >= expectedDays ? "excellent" : daysWorked >= expectedDays * 0.8 ? "good" : "needs attention",
        hasCheckedOutToday,
      }
    })

    return NextResponse.json({
      period,
      startDate: startDateStr,
      endDate: endDateStr,
      summaries: summaries || [],
      totalStaff: summaries?.length || 0,
    })
  } catch (error: any) {
    console.error("Error fetching department summaries:", error)
    return NextResponse.json({ error: error.message || "Failed to fetch summaries" }, { status: 500 })
  }
}
