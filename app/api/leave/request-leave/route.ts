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

    // Create leave request
    const { data: leaveRequest, error: requestError } = await supabase
      .from("leave_requests")
      .insert({
        user_id: user.id,
        start_date,
        end_date,
        reason,
        leave_type,
        status: "pending",
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
        notification_type: "leave_request",
        status: "pending",
      })

    if (notificationError) {
      return NextResponse.json({ error: notificationError.message }, { status: 400 })
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
