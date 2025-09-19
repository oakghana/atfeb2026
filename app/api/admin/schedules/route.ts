import { createClient } from "@/lib/supabase/server"
import { type NextRequest, NextResponse } from "next/server"

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { searchParams } = new URL(request.url)
    const date = searchParams.get("date")

    // Get authenticated user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Check user role
    const { data: profile } = await supabase
      .from("user_profiles")
      .select("role, department_id")
      .eq("id", user.id)
      .single()

    if (!profile || !["admin", "department_head"].includes(profile.role)) {
      return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 })
    }

    let query = supabase.from("schedules").select(`
        *,
        user_profiles!schedules_user_id_fkey(first_name, last_name, email),
        departments!schedules_department_id_fkey(name)
      `)

    if (date) {
      query = query.lte("start_date", date).gte("end_date", date)
    }

    // Department heads can only see their department's schedules
    if (profile.role === "department_head" && profile.department_id) {
      query = query.eq("department_id", profile.department_id)
    }

    const { data: schedules, error } = await query
      .order("start_date", { ascending: true })
      .order("start_time", { ascending: true })

    if (error) {
      console.error("Database error:", error)
      return NextResponse.json({ error: "Failed to fetch schedules" }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      data: schedules || [],
    })
  } catch (error) {
    console.error("Schedules API error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const body = await request.json()

    // Get authenticated user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Check user role
    const { data: profile } = await supabase
      .from("user_profiles")
      .select("role, department_id")
      .eq("id", user.id)
      .single()

    if (!profile || !["admin", "department_head"].includes(profile.role)) {
      return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 })
    }

    const {
      title,
      description,
      start_date,
      end_date,
      start_time,
      end_time,
      user_id,
      location_id,
      schedule_type,
      is_recurring,
    } = body

    if (!title || !start_date || !start_time || !end_time) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
    }

    const scheduleData = {
      title,
      description: description || "",
      start_date,
      end_date: end_date || start_date, // Default to same day if no end date
      start_time,
      end_time,
      user_id: user_id || null, // Optional user assignment
      location_id: location_id || null, // Optional location
      schedule_type: schedule_type || "work",
      is_recurring: is_recurring || false,
      status: "active",
      created_by: user.id,
      department_id: profile.department_id,
    }

    const { data: schedule, error } = await supabase.from("schedules").insert(scheduleData).select().single()

    if (error) {
      console.error("Database error:", error)
      return NextResponse.json({ error: "Failed to create schedule" }, { status: 500 })
    }

    // Log the action
    await supabase.from("audit_logs").insert({
      user_id: user.id,
      action: "create_schedule",
      table_name: "schedules",
      record_id: schedule.id,
      new_values: schedule,
    })

    return NextResponse.json({
      success: true,
      data: schedule,
      message: "Schedule created successfully",
    })
  } catch (error) {
    console.error("Schedule creation error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
