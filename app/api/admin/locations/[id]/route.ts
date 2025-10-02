import { createClient } from "@/lib/supabase/server"
import { type NextRequest, NextResponse } from "next/server"

export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    console.log("[v0] Location update request for ID:", params.id)

    const supabase = await createClient()

    // Get authenticated user and check admin role
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      console.log("[v0] Location update - unauthorized")
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Check if user has admin or department_head role
    const { data: profile } = await supabase.from("user_profiles").select("role").eq("id", user.id).single()

    if (!profile || !["admin", "department_head"].includes(profile.role)) {
      console.log("[v0] Location update - insufficient permissions")
      return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 })
    }

    const body = await request.json()
    console.log("[v0] Location update data:", body)

    const { name, address, latitude, longitude, radius_meters, is_active } = body

    const { data: updatedLocation, error } = await supabase
      .from("geofence_locations")
      .update({
        name,
        address,
        latitude: Number(latitude),
        longitude: Number(longitude),
        radius_meters: Number(radius_meters),
        is_active: is_active ?? true,
        updated_at: new Date().toISOString(),
      })
      .eq("id", params.id)
      .select()
      .single()

    if (error) {
      console.error("[v0] Location update error:", error)
      return NextResponse.json({ error: "Failed to update location" }, { status: 500 })
    }

    console.log("[v0] Location updated successfully:", updatedLocation)

    // Log the action
    await supabase.from("audit_logs").insert({
      user_id: user.id,
      action: "update_location",
      table_name: "geofence_locations",
      record_id: params.id,
      new_values: { name, address, latitude, longitude, radius_meters, is_active },
      ip_address: request.headers.get("x-forwarded-for") || null,
    })

    return NextResponse.json({
      success: true,
      data: updatedLocation,
      message: "Location updated successfully",
    })
  } catch (error) {
    console.error("[v0] Location update API error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
