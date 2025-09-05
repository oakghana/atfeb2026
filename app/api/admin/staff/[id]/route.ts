import { createClient } from "@/lib/supabase/server"
import { createClient as createSupabaseClient } from "@supabase/supabase-js"
import { type NextRequest, NextResponse } from "next/server"

export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    console.log("[v0] Staff update API called for ID:", params.id)

    const supabase = await createClient()

    const adminSupabase = createSupabaseClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      },
    )

    // Get authenticated user and check admin role
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      console.log("[v0] Authentication failed:", authError)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Check if user has admin or department_head role
    const { data: profile } = await supabase.from("user_profiles").select("role").eq("id", user.id).single()

    if (!profile || !["admin", "department_head"].includes(profile.role)) {
      console.log("[v0] Insufficient permissions for user:", profile?.role)
      return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 })
    }

    const body = await request.json()
    console.log("[v0] Update request body:", body)

    const {
      first_name,
      last_name,
      employee_id,
      department_id,
      position,
      role,
      is_active,
      assigned_location_id,
      email,
    } = body

    if (!first_name || !last_name || !employee_id) {
      return NextResponse.json({ error: "First name, last name, and employee ID are required" }, { status: 400 })
    }

    let locationId = null
    if (assigned_location_id && assigned_location_id !== "none") {
      // Verify location exists
      const { data: locationExists } = await supabase
        .from("geofence_locations")
        .select("id")
        .eq("id", assigned_location_id)
        .single()

      if (locationExists) {
        locationId = assigned_location_id
      } else {
        console.log("[v0] Invalid location ID provided:", assigned_location_id)
        return NextResponse.json({ error: "Invalid location selected" }, { status: 400 })
      }
    }

    console.log("[v0] Processed location ID:", locationId)

    const updateData = {
      first_name,
      last_name,
      employee_id,
      department_id: department_id || null,
      position: position || null,
      role,
      is_active,
      assigned_location_id: locationId,
      updated_at: new Date().toISOString(),
    }

    if (email) {
      try {
        console.log("[v0] Attempting to update email for user:", params.id)
        const { error: emailUpdateError } = await adminSupabase.auth.admin.updateUserById(params.id, {
          email: email,
        })

        if (emailUpdateError) {
          console.error("[v0] Email update error:", emailUpdateError)
          console.log("[v0] Email update failed, continuing with profile update")
        } else {
          updateData.email = email
          console.log("[v0] Email updated successfully")
        }
      } catch (emailError) {
        console.error("[v0] Email update exception:", emailError)
        console.log("[v0] Email update exception caught, continuing with profile update")
      }
    }

    // Update user profile
    const { data: updatedProfile, error: updateError } = await supabase
      .from("user_profiles")
      .update(updateData)
      .eq("id", params.id)
      .select(`
        *,
        departments:department_id(id, name, code),
        geofence_locations:assigned_location_id(id, name, address)
      `)
      .single()

    if (updateError) {
      console.error("[v0] Update error:", updateError)
      return NextResponse.json(
        {
          error: `Failed to update staff member: ${updateError.message}`,
          details: updateError,
        },
        { status: 500 },
      )
    }

    console.log("[v0] Staff updated successfully:", updatedProfile)

    // Log the action
    await supabase.from("audit_logs").insert({
      user_id: user.id,
      action: "update_staff",
      table_name: "user_profiles",
      record_id: params.id,
      new_values: updatedProfile,
      ip_address: request.ip || null,
      user_agent: request.headers.get("user-agent"),
    })

    return NextResponse.json({
      success: true,
      data: updatedProfile,
      message: "Staff member updated successfully",
    })
  } catch (error) {
    console.error("[v0] Update staff error:", error)
    return NextResponse.json(
      {
        error: "Internal server error",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    )
  }
}

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const supabase = await createClient()

    // Get authenticated user and check admin role
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Check if user has admin role
    const { data: profile } = await supabase.from("user_profiles").select("role").eq("id", user.id).single()

    if (!profile || profile.role !== "admin") {
      return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 })
    }

    // Deactivate instead of delete to preserve data integrity
    const { data: deactivatedProfile, error: deactivateError } = await supabase
      .from("user_profiles")
      .update({
        is_active: false,
        updated_at: new Date().toISOString(),
      })
      .eq("id", params.id)
      .select("*")
      .single()

    if (deactivateError) {
      console.error("Deactivate error:", deactivateError)
      return NextResponse.json({ error: "Failed to deactivate staff member" }, { status: 500 })
    }

    // Log the action
    await supabase.from("audit_logs").insert({
      user_id: user.id,
      action: "deactivate_staff",
      table_name: "user_profiles",
      record_id: params.id,
      new_values: deactivatedProfile,
      ip_address: request.ip || null,
      user_agent: request.headers.get("user-agent"),
    })

    return NextResponse.json({
      success: true,
      message: "Staff member deactivated successfully",
    })
  } catch (error) {
    console.error("Delete staff error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
