import { createAdminClient } from "@/lib/supabase/server"
import { type NextRequest, NextResponse } from "next/server"

console.log("[v0] check-in-outside-request route module loaded")

export async function POST(request: NextRequest) {
  console.log("[v0] POST handler invoked for check-in-outside-request")
  
  try {
    console.log("[v0] Off-premises check-in API called")
    
    const body = await request.json()
    console.log("[v0] Request body received:", { location: body.current_location?.name, userId: body.user_id })
    
    const { current_location, device_info, user_id, reason, request_type, action, mode } = body

    // Normalize request type: accept `request_type`, `action`, or `mode` (legacy)
    const normalizedRequestType = (request_type || action || mode || 'checkin').toString().toLowerCase()
    const allowedTypes = ['checkin','checkout']
    const finalRequestType = allowedTypes.includes(normalizedRequestType) ? normalizedRequestType : 'checkin'

    if (!current_location) {
      console.error("[v0] Missing current_location")
      return NextResponse.json(
        { error: "Current location is required" },
        { status: 400 }
      )
    }

    if (!user_id) {
      console.error("[v0] Missing user_id")
      return NextResponse.json(
        { error: "User ID is required" },
        { status: 400 }
      )
    }

    console.log("[v0] Creating admin client...")
    const supabase = await createAdminClient()
    console.log("[v0] Admin client created")

    // Get user's direct manager (department head or regional manager they report to)
    const { data: userProfile, error: userProfileError } = await supabase
      .from("user_profiles")
      .select("id, department_id, role, first_name, last_name, email")
      .eq("id", user_id)
      .maybeSingle()

    console.log("[v0] User profile query result:", { userProfile, userProfileError, user_id })

    if (userProfileError) {
      console.error("[v0] Error querying user_profiles:", userProfileError)
      return NextResponse.json({ error: userProfileError.message }, { status: 500 })
    }

    if (!userProfile) {
      console.error("[v0] User profile not found for user_id:", user_id)
      return NextResponse.json(
        { error: "User profile not found" },
        { status: 404 }
      )
    }

    // Get ALL managers (admins, regional managers, department heads) - no department/location filtering
    console.log("[v0] Looking for all managers (admin, regional_manager, department_head)...")
    const { data: allManagers } = await supabase
      .from("user_profiles")
      .select("id, email, first_name, last_name, role")
      .in("role", ["admin", "regional_manager", "department_head"])
      .eq("is_active", true)
    
    console.log("[v0] Managers found:", { count: allManagers?.length || 0 })

    if (!allManagers || allManagers.length === 0) {
      console.error("[v0] No managers found in the system")
      return NextResponse.json(
        {
          success: false,
          error: "Cannot submit off-premises request: No managers found in the system. Please contact HR.",
          requiresManualApproval: true,
        },
        { status: 400 }
      )
    }

    const managers = allManagers

    // Store the off-premises check-in request for manager approval
    console.log("[v0] Inserting pending check-in:", {
      user_id,
      location_name: current_location.name,
      status: "pending",
    })

    // Try inserting with `reason` column if it exists; fall back if DB doesn't have that column yet
    let requestRecord: any = null
    try {
      const insertRes = await supabase
        .from("pending_offpremises_checkins")
        .insert({
          user_id,
          current_location_name: current_location.name,
          latitude: current_location.latitude,
          longitude: current_location.longitude,
          accuracy: current_location.accuracy,
          device_info: device_info,
          request_type: finalRequestType,
          google_maps_name: current_location.display_name || current_location.name,
          reason: reason || null,
          status: "pending",
        })
        .select()
        .single()

      requestRecord = insertRes.data
      if (insertRes.error) throw insertRes.error
    } catch (err: any) {
      // If column `reason` OR `request_type` is missing (older schemas), or if
      // PostgREST schema cache hasn't picked up the new column (PGRST204), retry
      const msg = (err?.message || "").toString().toLowerCase()
      const missingReason = msg.includes("column pending_offpremises_checkins.reason does not exist") || err?.code === '42703' || err?.code === 'PGRST204' || msg.includes("schema cache") && msg.includes("reason")
      const missingRequestType = msg.includes("column pending_offpremises_checkins.request_type does not exist") || err?.code === '42703' || err?.code === 'PGRST204' || msg.includes("schema cache") && msg.includes("request_type")

      if (missingReason || missingRequestType) {
        console.warn('[v0] Database missing columns or schema stale; retrying insert without reason/request_type')
        const payload: any = {
          user_id,
          current_location_name: current_location.name,
          latitude: current_location.latitude,
          longitude: current_location.longitude,
          accuracy: current_location.accuracy,
          device_info: device_info,
          google_maps_name: current_location.display_name || current_location.name,
          status: 'pending',
        }

        // only include reason/request_type if DB likely supports them
        if (!missingReason && reason) payload.reason = reason
        if (!missingRequestType && request_type) payload.request_type = request_type

        const { data: retryRecord, error: retryError } = await supabase
          .from('pending_offpremises_checkins')
          .insert(payload)
          .select()
          .single()

        if (retryError) {
          console.error('[v0] Failed retrying insert without reason/request_type:', retryError)
          return NextResponse.json({ error: 'Failed to process request: ' + retryError.message }, { status: 500 })
        }
        requestRecord = retryRecord
      } else {
        console.error('[v0] Failed to store pending check-in:', err)
        return NextResponse.json({ error: 'Failed to process request: ' + (err?.message || String(err)) }, { status: 500 })
      }
    }

    console.log('[v0] Request stored successfully:', requestRecord.id)

    // Send notifications to managers
    const managerNotifications = managers.map((manager: any) => ({
      user_id: manager.id,
      type: "offpremises_checkin_request",
      title: "Off-Premises Check-In Request",
      message: `${userProfile.first_name} ${userProfile.last_name} is requesting to check-in from outside their assigned location: ${current_location.display_name || current_location.name}. Reason: ${reason || 'Not provided'}. Please review and approve or deny.`,
      data: {
        request_id: requestRecord.id,
        staff_user_id: user_id,
        staff_name: `${userProfile.first_name} ${userProfile.last_name}`,
        location_name: current_location.name,
        google_maps_name: current_location.display_name || current_location.name,
        coordinates: `${current_location.latitude}, ${current_location.longitude}`,
        reason: reason || 'Not provided',
      },
      is_read: false,
    }))

    const { error: notificationError } = await supabase
      .from("staff_notifications")
      .insert(managerNotifications)

    if (notificationError) {
      console.warn("[v0] Failed to send notifications:", notificationError)
      // Don't fail the request if notifications fail
    }

    return NextResponse.json(
      {
        success: true,
        message: "Your off-premises check-in request has been sent to your managers for approval",
        request_id: requestRecord.id,
        pending_approval: true,
      },
      { status: 200 }
    )
  } catch (error: any) {
    // normalize error to string message so we never return an empty object
    const message =
      (error && (error.message || String(error))) ||
      "Failed to process off-premises request"

    console.error("[v0] Off-premises check-in request error:", {
      message,
      code: error?.code,
      name: error?.name,
      stack: error?.stack?.split('\n').slice(0, 3).join('\n'),
    })
    return NextResponse.json(
      { error: message },
      { status: 500 }
    )
  }
}
