import { createAdminClient } from "@/lib/supabase/server"
import { type NextRequest, NextResponse } from "next/server"

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { user_id, checkout_location, device_info } = body

    if (!user_id) {
      return NextResponse.json({ error: "User ID is required" }, { status: 400 })
    }

    const supabase = await createAdminClient()
    const today = new Date().toISOString().split('T')[0]

    // Get today's attendance record for this user
    const { data: attendanceRecord, error: fetchError } = await supabase
      .from("attendance_records")
      .select("*")
      .eq("user_id", user_id)
      .eq("attendance_date", today)
      .order("check_in_time", { ascending: false })
      .limit(1)
      .single()

    if (fetchError || !attendanceRecord) {
      console.error("[v0] No attendance record found for off-premises checkout")
      return NextResponse.json(
        { error: "No check-in found for today. Please check-in first." },
        { status: 400 }
      )
    }

    // Verify this is an approved off-premises check-in
    if (attendanceRecord.approval_status !== "approved_offpremises") {
      return NextResponse.json(
        {
          error: "This off-premises check-in is not approved yet, or you have already checked out.",
          status: attendanceRecord.approval_status,
        },
        { status: 403 }
      )
    }

    // Verify not already checked out
    if (attendanceRecord.check_out_time) {
      return NextResponse.json(
        { error: "You have already checked out today." },
        { status: 400 }
      )
    }

    // Calculate work hours
    const checkInTime = new Date(attendanceRecord.check_in_time)
    const checkOutTime = new Date()
    const workHours = (checkOutTime.getTime() - checkInTime.getTime()) / (1000 * 60 * 60)

    // Update attendance record with checkout details
    const { error: updateError } = await supabase
      .from("attendance_records")
      .update({
        check_out_time: checkOutTime.toISOString(),
        check_out_latitude: checkout_location?.latitude || null,
        check_out_longitude: checkout_location?.longitude || null,
        check_out_location_name: checkout_location?.name || "Off-Premises",
        work_hours: parseFloat(workHours.toFixed(2)),
        approval_status: "approved_offpremises", // Maintain status
        supervisor_approval_remarks: `${attendanceRecord.supervisor_approval_remarks}\nChecked out from ${checkout_location?.name || 'off-premises location'} at ${checkOutTime.toLocaleTimeString()}`,
      })
      .eq("id", attendanceRecord.id)

    if (updateError) {
      console.error("[v0] Failed to update checkout:", updateError)
      return NextResponse.json(
        { error: "Failed to process checkout" },
        { status: 500 }
      )
    }

    return NextResponse.json(
      {
        success: true,
        message: "Off-premises check-out recorded successfully",
        checkout_time: checkOutTime.toISOString(),
        work_hours: parseFloat(workHours.toFixed(2)),
      },
      { status: 200 }
    )
  } catch (error: any) {
    console.error("[v0] Off-premises checkout error:", error)
    return NextResponse.json(
      { error: error.message || "Failed to process checkout" },
      { status: 500 }
    )
  }
}
