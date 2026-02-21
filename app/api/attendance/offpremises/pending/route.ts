import { createClient, createAdminClient } from "@/lib/supabase/server"
import { type NextRequest, NextResponse } from "next/server"

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const statusFilter = searchParams.get("status") || "all"
    const supabase = await createClient()

    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Use admin client to bypass RLS for profile and data queries
    const adminClient = await createAdminClient()

    // Get user profile to verify permissions
    const { data: managerProfile, error: profileError } = await adminClient
      .from("user_profiles")
      .select("id, role, department_id, assigned_location_id")
      .eq("id", user.id)
      .maybeSingle()

    if (profileError) {
      console.error("[v0] Error fetching manager profile:", profileError)
      return NextResponse.json(
        { error: "Failed to fetch user profile", details: profileError.message },
        { status: 500 }
      )
    }

    if (!managerProfile) {
      return NextResponse.json(
        { error: "User profile not found" },
        { status: 404 }
      )
    }

    if (!["department_head", "regional_manager", "admin"].includes(managerProfile.role)) {
      // Staff members can only see their own pending requests
      let query = adminClient
        .from("pending_offpremises_checkins")
        .select(
          `
          id,
          user_id,
          current_location_name,
          latitude,
          longitude,
          accuracy,
          device_info,
          created_at,
          status,
          approved_by_id,
          approved_at,
          rejection_reason,
          google_maps_name,
          user_profiles!pending_offpremises_checkins_user_id_fkey (
            id,
            first_name,
            last_name,
            email,
            employee_id,
            department_id,
            position,
            assigned_location_id
          )
        `
        )
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })

      // Apply status filter if not "all"
      if (statusFilter !== "all") {
        query = query.eq("status", statusFilter)
      }

      const { data: staffRequests, error } = await query

      if (error) {
        console.error("[v0] Failed to fetch staff off-premises requests:", error)
        // Fallback if column doesn't exist
        if (error.code === '42703' && error.message?.includes('does not exist')) {
          console.warn('[v0] Column missing from pending_offpremises_checkins; returning empty array')
          return NextResponse.json({
            requests: [],
            count: 0,
          })
        }
        return NextResponse.json(
          { error: "Failed to fetch requests", details: error.message },
          { status: 500 }
        )
      }

      return NextResponse.json({
        requests: staffRequests || [],
        count: staffRequests?.length || 0,
      })
    }

    // Build query using admin client to bypass RLS
    // NOTE: request_type column may not exist on all databases, use fallback select
    let fallbackQuery = adminClient
      .from('pending_offpremises_checkins')
      .select(`
        id,
        user_id,
        current_location_name,
        latitude,
        longitude,
        accuracy,
        device_info,
        created_at,
        status,
        approved_by_id,
        approved_at,
        rejection_reason,
        google_maps_name,
        user_profiles!pending_offpremises_checkins_user_id_fkey (
          id,
          first_name,
          last_name,
          email,
          employee_id,
          department_id,
          position,
          assigned_location_id
        )
      `)
      .order('created_at', { ascending: false })

    // if non-admin manager, restrict to own department or assigned location
    if (managerProfile.role !== 'admin') {
      const deptId = managerProfile.department_id
      const locId = managerProfile.assigned_location_id
      if (deptId || locId) {
        // use PostgREST `or` to combine conditions with proper formatting
        const conditions: string[] = []
        if (deptId) conditions.push(`(user_profiles.department_id.eq.${deptId})`)
        if (locId) conditions.push(`(user_profiles.assigned_location_id.eq.${locId})`)
        if (conditions.length > 0) {
          fallbackQuery = fallbackQuery.or(conditions.join(','))
        }
      }
    }

    // Apply status filter
    if (statusFilter !== 'all') {
      fallbackQuery = fallbackQuery.eq('status', statusFilter)
    }

    const fallbackRes = await fallbackQuery
    if (fallbackRes.error) {
      console.error('[v0] Failed to fetch off-premises requests:', fallbackRes.error)
      // Gracefully handle missing columns
      if (fallbackRes.error.code === '42703') {
        console.warn('[v0] Column missing from pending_offpremises_checkins table; returning empty array')
        return NextResponse.json({
          requests: [],
          count: 0,
        })
      }
      return NextResponse.json({ error: 'Failed to fetch requests', details: fallbackRes.error.message }, { status: 500 })
    }

    return NextResponse.json({
      requests: fallbackRes.data || [],
      count: fallbackRes.data?.length || 0,
    })
  } catch (error) {
    console.error("[v0] Error in pending requests endpoint:", error)
    return NextResponse.json(
      { error: "Internal server error", details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    )
  }
}
