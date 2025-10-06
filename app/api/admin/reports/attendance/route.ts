import { createClient } from "@/lib/supabase/server"
import { type NextRequest, NextResponse } from "next/server"

export async function GET(request: NextRequest) {
  try {
    console.log("[v0] Reports API - Starting request")
    const supabase = await createClient()

    // Get authenticated user and check role
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      console.error("[v0] Reports API - Auth error:", authError)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    console.log("[v0] Reports API - User authenticated:", user.id)

    const { data: profile } = await supabase
      .from("user_profiles")
      .select("role, department_id")
      .eq("id", user.id)
      .single()

    if (!profile || !["admin", "department_head", "staff"].includes(profile.role)) {
      console.error("[v0] Reports API - Insufficient permissions:", profile?.role)
      return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 })
    }

    console.log("[v0] Reports API - User role:", profile.role)

    // Get query parameters
    const { searchParams } = new URL(request.url)
    const startDate =
      searchParams.get("start_date") || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0]
    const endDate = searchParams.get("end_date") || new Date().toISOString().split("T")[0]
    const departmentId = searchParams.get("department_id")
    const userId = searchParams.get("user_id")
    const locationId = searchParams.get("location_id")
    const districtId = searchParams.get("district_id")

    console.log("[v0] Reports API - Filters:", {
      startDate,
      endDate,
      departmentId,
      userId,
      locationId,
      districtId,
    })

    let query = supabase
      .from("attendance_records")
      .select(`
        *,
        check_in_location:geofence_locations!check_in_location_id (
          name,
          address,
          district_id
        ),
        check_out_location:geofence_locations!check_out_location_id (
          name,
          address,
          district_id
        )
      `)
      .gte("check_in_time", `${startDate}T00:00:00`)
      .lte("check_in_time", `${endDate}T23:59:59`)

    if (profile.role === "staff") {
      query = query.eq("user_id", user.id)
    } else if (userId) {
      query = query.eq("user_id", userId)
    }

    if (locationId) {
      query = query.eq("check_in_location_id", locationId)
    }

    const { data: attendanceRecords, error } = await query.order("check_in_time", { ascending: false })

    if (error) {
      console.error("[v0] Reports API - Attendance query error:", error)
      return NextResponse.json({ error: "Failed to fetch attendance report" }, { status: 500 })
    }

    console.log("[v0] Reports API - Found", attendanceRecords.length, "attendance records")

    const userIds = [...new Set(attendanceRecords.map((record) => record.user_id))]

    const { data: userProfiles } = await supabase
      .from("user_profiles")
      .select(`
        id,
        first_name,
        last_name,
        employee_id,
        department_id,
        assigned_location_id,
        departments (
          name,
          code
        ),
        assigned_location:geofence_locations!assigned_location_id (
          name,
          address,
          district_id,
          districts (
            id,
            name
          )
        )
      `)
      .in("id", userIds)

    const userMap = new Map(userProfiles?.map((user) => [user.id, user]) || [])

    let filteredRecords = attendanceRecords

    if (profile.role === "department_head") {
      // Department heads can only see records from their department
      filteredRecords = attendanceRecords.filter((record) => {
        const user = userMap.get(record.user_id)
        return user?.department_id === profile.department_id
      })
    } else if (profile.role === "staff") {
      // Staff can only see their own records (already filtered in query above)
      filteredRecords = attendanceRecords
    } else if (departmentId) {
      // Admins can filter by specific department
      filteredRecords = attendanceRecords.filter((record) => {
        const user = userMap.get(record.user_id)
        return user?.department_id === departmentId
      })
    }

    if (districtId) {
      filteredRecords = filteredRecords.filter((record) => {
        const user = userMap.get(record.user_id)
        // Check if user's assigned location is in the selected district
        return (
          user?.assigned_location?.district_id === districtId ||
          // Or if the check-in location is in the selected district
          record.check_in_location?.district_id === districtId
        )
      })
    }

    console.log("[v0] Reports API - After filtering:", filteredRecords.length, "records")

    const enrichedRecords = filteredRecords.map((record) => {
      const userProfile = userMap.get(record.user_id)

      // Determine if check-in/check-out was outside assigned location
      const isCheckInOutsideLocation =
        userProfile?.assigned_location_id && record.check_in_location_id !== userProfile.assigned_location_id

      const isCheckOutOutsideLocation =
        userProfile?.assigned_location_id &&
        record.check_out_location_id &&
        record.check_out_location_id !== userProfile.assigned_location_id

      return {
        ...record,
        user_profiles: userProfile || null,
        is_check_in_outside_location: isCheckInOutsideLocation,
        is_check_out_outside_location: isCheckOutOutsideLocation,
        // Keep backward compatibility
        geofence_locations: record.check_in_location,
      }
    })

    // Calculate summary statistics
    const totalRecords = enrichedRecords.length
    const totalWorkHours = enrichedRecords.reduce((sum, record) => sum + (record.work_hours || 0), 0)
    const averageWorkHours = totalRecords > 0 ? totalWorkHours / totalRecords : 0

    // Group by status
    const statusCounts = enrichedRecords.reduce(
      (acc, record) => {
        acc[record.status] = (acc[record.status] || 0) + 1
        return acc
      },
      {} as Record<string, number>,
    )

    // Group by department
    const departmentStats = enrichedRecords.reduce(
      (acc, record) => {
        const deptName = record.user_profiles?.departments?.name || "Unknown"
        if (!acc[deptName]) {
          acc[deptName] = { count: 0, totalHours: 0 }
        }
        acc[deptName].count += 1
        acc[deptName].totalHours += record.work_hours || 0
        return acc
      },
      {} as Record<string, { count: number; totalHours: number }>,
    )

    console.log("[v0] Reports API - Returning", totalRecords, "records with summary")

    return NextResponse.json(
      {
        success: true,
        data: {
          records: enrichedRecords,
          summary: {
            totalRecords,
            totalWorkHours: Math.round(totalWorkHours * 100) / 100,
            averageWorkHours: Math.round(averageWorkHours * 100) / 100,
            statusCounts,
            departmentStats,
          },
        },
      },
      {
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": "no-cache, no-store, must-revalidate, private",
          Pragma: "no-cache",
          Expires: "0",
          "X-Content-Type-Options": "nosniff",
          "X-Frame-Options": "DENY",
        },
      },
    )
  } catch (error) {
    console.error("[v0] Reports API - Unexpected error:", error)
    return NextResponse.json(
      {
        success: false,
        error: "Internal server error",
        message: error instanceof Error ? error.message : "Unknown error",
      },
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
