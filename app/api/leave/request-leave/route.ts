import { createClient } from "@/lib/supabase/server"
import { NextRequest, NextResponse } from "next/server"

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Handle FormData for file uploads
    const formData = await request.formData()
    const start_date = formData.get("start_date") as string
    const end_date = formData.get("end_date") as string
    const reason = formData.get("reason") as string
    const leave_type = formData.get("leave_type") as string
    const document = formData.get("document") as File | null

    if (!start_date || !end_date || !reason) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
    }

    let document_url = null

    // Handle file upload if provided
    if (document) {
      const fileExt = document.name.split('.').pop()
      const fileName = `${user.id}_${Date.now()}.${fileExt}`
      
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('leave-documents')
        .upload(fileName, document)

      if (uploadError) {
        console.error("File upload error:", uploadError)
        return NextResponse.json({ error: "Failed to upload document" }, { status: 500 })
      }

      document_url = uploadData.path
    }

    // Determine creator role to decide auto-approval
    const { data: profile } = await supabase
      .from("user_profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle()

    const autoApproveRoles = ["admin", "regional_manager", "department_head"]
    const shouldAutoApprove = profile && autoApproveRoles.includes(profile.role)

    // Create leave request (status depends on role)
    const { data: leaveRequest, error: requestError } = await supabase
      .from("leave_requests")
      .insert({
        user_id: user.id,
        start_date,
        end_date,
        reason,
        leave_type,
        status: shouldAutoApprove ? "approved" : "pending",
        approved_by: shouldAutoApprove ? user.id : null,
        approved_at: shouldAutoApprove ? new Date().toISOString() : null,
        document_url,
      })
      .select()
      .single()

    if (requestError) {
      return NextResponse.json({ error: requestError.message }, { status: 400 })
    }

    // Create notification for the leave request
    const { error: notificationError } = await supabase
      .from("leave_notifications")
      .insert({
        leave_request_id: leaveRequest.id,
        user_id: user.id,
        notification_type: shouldAutoApprove ? "leave_approved" : "leave_request",
        status: shouldAutoApprove ? "approved" : "pending",
      })

    if (notificationError) {
      console.warn("Failed to create leave notification:", notificationError.message)
    }

    // If auto-approved, also populate per-day leave_status rows (trigger only handles updates)
    if (shouldAutoApprove) {
      try {
        const start = new Date(start_date)
        const end = new Date(end_date)
        const dates: string[] = []
        for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
          dates.push(new Date(d).toISOString().split("T")[0])
        }

        const rows = dates.map((dt) => ({
          user_id: user.id,
          date: dt,
          status: "on_leave",
          leave_request_id: leaveRequest.id,
        }))

        // Upsert to avoid conflicts
        const { error: leaveStatusError } = await supabase.from("leave_status").upsert(rows)
        if (leaveStatusError) {
          console.error("Failed to populate leave_status for auto-approved request:", leaveStatusError)
        }
      } catch (e) {
        console.error("Error populating leave_status for auto-approved request:", e)
      }
    }

    return NextResponse.json(
      {
        message: "Leave request submitted successfully",
        leaveRequest,
      },
      { status: 201 }
    )
  } catch (error) {
    console.error("Error creating leave request:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
