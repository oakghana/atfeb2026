import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"

export async function PUT(request: Request) {
  try {
    const supabase = await createClient()

    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Check if user is admin
    const { data: profile } = await supabase
      .from("user_profiles")
      .select("role")
      .eq("id", user.id)
      .single()

    if (profile?.role !== "admin") {
      return NextResponse.json({ error: "Forbidden - Admin access required" }, { status: 403 })
    }

    const settings = await request.json()

    // Validate settings
    for (const setting of settings) {
      if (setting.check_in_radius_meters < 50 || setting.check_in_radius_meters > 5000) {
        return NextResponse.json(
          { error: `Invalid check-in radius for ${setting.device_type}. Must be between 50 and 5000 meters.` },
          { status: 400 },
        )
      }
      if (setting.check_out_radius_meters < 50 || setting.check_out_radius_meters > 5000) {
        return NextResponse.json(
          { error: `Invalid check-out radius for ${setting.device_type}. Must be between 50 and 5000 meters.` },
          { status: 400 },
        )
      }
    }

    // Update each setting
    for (const setting of settings) {
      const { error } = await supabase
        .from("device_radius_settings")
        .update({
          check_in_radius_meters: setting.check_in_radius_meters,
          check_out_radius_meters: setting.check_out_radius_meters,
        })
        .eq("device_type", setting.device_type)

      if (error) {
        console.error("[v0] Error updating device radius setting:", error)
        throw error
      }
    }

    console.log("[v0] Device radius settings updated by admin:", user.email)

    return NextResponse.json({
      success: true,
      message: "Device radius settings updated successfully",
    })
  } catch (error) {
    console.error("[v0] Error in device radius settings API:", error)
    return NextResponse.json({ error: "Failed to update device radius settings" }, { status: 500 })
  }
}
