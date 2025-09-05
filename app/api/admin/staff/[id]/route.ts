import { createClient } from "@/lib/supabase/server"
import { type NextRequest, NextResponse } from "next/server"

export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
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

    // Check if user has admin or department_head role
    const { data: profile } = await supabase.from("user_profiles").select("role").eq("id", user.id).single()

    if (!profile || !["admin", "department_head"].includes(profile.role)) {
      return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 })
    }

    const body = await request.json()
    const { first_name, last_name, employee_id, department_id, position, role, is_active, assigned_location_id } = body

    // Update user profile
    const { data: updatedProfile, error: updateError } = await supabase
      .from("user_profiles")
      .update({
        first_name,
        last_name,
        employee_id,
        department_id,
        position,
        role,
        is_active,
        assigned_location_id: assigned_location_id && assigned_location_id !== "none" ? assigned_location_id : null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", params.id)
      .select("*")
      .single()

    if (updateError) {
      console.error("Update error:", updateError)
      return NextResponse.json({ error: "Failed to update staff member" }, { status: 500 })
    }

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
    console.error("Update staff error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
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
