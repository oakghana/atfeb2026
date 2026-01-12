import { createClient } from "@/lib/supabase/server"
import { type NextRequest, NextResponse } from "next/server"

export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  try {
    console.log("[v0] HOD Excuse duty API - Starting request")

    const supabase = await createClient()

    // Check authentication
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()
    if (authError || !user) {
      console.log("[v0] HOD Excuse duty API - Authentication failed")
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Get user profile to check role and department
    const { data: profile, error: profileError } = await supabase
      .from("user_profiles")
      .select("role, department_id, first_name, last_name")
      .eq("id", user.id)
      .single()

    if (profileError || !profile) {
      console.log("[v0] HOD Excuse duty API - Profile fetch failed")
      return NextResponse.json({ error: "Profile not found" }, { status: 404 })
    }

    // Check if user has admin or department_head role
    if (!["admin", "department_head"].includes(profile.role)) {
      console.log("[v0] HOD Excuse duty API - Insufficient permissions")
      return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 })
    }

    console.log("[v0] HOD Excuse duty API - User authorized:", profile.role)

    // Build base query without relationships
    let query = supabase.from("excuse_documents").select("*")

    // Get URL parameters for filtering
    const url = new URL(request.url)
    const status = url.searchParams.get("status")
    const department = url.searchParams.get("department")

    if (status && status !== "all") {
      query = query.eq("status", status)
    }

    const { data: excuseDocs, error } = await query.order("created_at", { ascending: false })

    if (error) {
      console.error("[v0] HOD Excuse duty API - Query error:", error.message)
      return NextResponse.json({ error: "Failed to fetch excuse documents" }, { status: 500 })
    }

    const docsWithProfiles = await Promise.all(
      (excuseDocs || []).map(async (doc) => {
        // Get user profile for the document submitter
        const { data: userProfile } = await supabase
          .from("user_profiles")
          .select("first_name, last_name, employee_id, department_id")
          .eq("id", doc.user_id)
          .single()

        // Get department info if user profile exists
        let department = null
        if (userProfile?.department_id) {
          const { data: deptData } = await supabase
            .from("departments")
            .select("name, code")
            .eq("id", userProfile.department_id)
            .single()
          department = deptData
        }

        // Get reviewer profile if document has been reviewed
        let reviewer = null
        if (doc.reviewed_by) {
          const { data: reviewerData } = await supabase
            .from("user_profiles")
            .select("first_name, last_name")
            .eq("id", doc.reviewed_by)
            .single()
          reviewer = reviewerData
        }

        return {
          ...doc,
          user_profiles: userProfile
            ? {
                ...userProfile,
                departments: department,
              }
            : null,
          reviewer,
        }
      }),
    )

    let filteredDocs = docsWithProfiles

    // If department head, only show documents from their department
    if (profile.role === "department_head" && profile.department_id) {
      filteredDocs = docsWithProfiles.filter((doc) => doc.user_profiles?.department_id === profile.department_id)
    }

    // If admin with department filter, apply it
    if (department && profile.role === "admin") {
      filteredDocs = docsWithProfiles.filter((doc) => doc.user_profiles?.department_id === department)
    }

    console.log("[v0] HOD Excuse duty API - Found documents:", filteredDocs.length)

    return NextResponse.json({
      excuseDocuments: filteredDocs,
      userRole: profile.role,
      userDepartment: profile.department_id,
    })
  } catch (error) {
    console.error("[v0] HOD Excuse duty API - Error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  try {
    console.log("[v0] HOD Excuse duty API - Starting review request")

    const supabase = await createClient()

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()
    if (authError || !user) {
      console.log("[v0] HOD Excuse duty API - Authentication failed")
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { data: profile, error: profileError } = await supabase
      .from("user_profiles")
      .select("role, department_id, first_name, last_name")
      .eq("id", user.id)
      .single()

    if (profileError || !profile) {
      console.log("[v0] HOD Excuse duty API - Profile fetch failed")
      return NextResponse.json({ error: "Profile not found" }, { status: 404 })
    }

    if (!["admin", "department_head"].includes(profile.role)) {
      console.log("[v0] HOD Excuse duty API - Insufficient permissions")
      return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 })
    }

    const body = await request.json()
    const { documentId, status, reviewNotes } = body

    if (!documentId || !status || !["approved", "rejected"].includes(status)) {
      return NextResponse.json({ error: "Invalid request data" }, { status: 400 })
    }

    const { data: excuseDoc, error: fetchError } = await supabase
      .from("excuse_documents")
      .select("*")
      .eq("id", documentId)
      .single()

    if (fetchError || !excuseDoc) {
      console.log("[v0] HOD Excuse duty API - Document not found")
      return NextResponse.json({ error: "Document not found" }, { status: 404 })
    }

    const { data: docUserProfile } = await supabase
      .from("user_profiles")
      .select("department_id, first_name, last_name, employee_id, email")
      .eq("id", excuseDoc.user_id)
      .single()

    if (!docUserProfile) {
      console.log("[v0] HOD Excuse duty API - User profile not found")
      return NextResponse.json({ error: "User profile not found" }, { status: 404 })
    }

    if (profile.role === "department_head") {
      if (profile.department_id !== docUserProfile.department_id) {
        console.log("[v0] HOD Excuse duty API - Department mismatch")
        return NextResponse.json({ error: "Cannot review documents from other departments" }, { status: 403 })
      }
    }

    const finalStatus = status === "approved" ? "hr_review" : "rejected"

    const { data: updatedDoc, error: updateError } = await supabase
      .from("excuse_documents")
      .update({
        hod_status: status,
        hod_reviewed_by: user.id,
        hod_reviewed_at: new Date().toISOString(),
        hod_review_notes: reviewNotes || null,
        final_status: finalStatus,
        // Keep old fields for backward compatibility
        status,
        reviewed_by: user.id,
        reviewed_at: new Date().toISOString(),
        review_notes: reviewNotes || null,
      })
      .eq("id", documentId)
      .select()
      .single()

    if (updateError) {
      console.error("[v0] HOD Excuse duty API - Update error:", updateError)
      return NextResponse.json({ error: "Failed to update document" }, { status: 500 })
    }

    if (status === "approved" && excuseDoc.attendance_record_id) {
      await supabase
        .from("attendance_records")
        .update({
          status: "excused_absence",
          notes: `Excuse duty approved by HOD: ${excuseDoc.document_type} - ${excuseDoc.excuse_reason}`,
        })
        .eq("id", excuseDoc.attendance_record_id)
    }

    await supabase.from("email_notifications").insert({
      user_id: excuseDoc.user_id,
      email_type: "excuse_duty_decision",
      subject: `Excuse Duty ${status === "approved" ? "Approved by HOD" : "Rejected"}`,
      body: `Your excuse duty submission has been ${status} by your Head of Department:

Date of Absence: ${new Date(excuseDoc.excuse_date).toLocaleDateString()}
Document Type: ${excuseDoc.document_type}
Reviewed By: ${profile.first_name} ${profile.last_name}
${reviewNotes ? `\nReview Notes: ${reviewNotes}` : ""}

${
  status === "approved"
    ? "Your request has been forwarded to HR for final processing. You will be notified once HR completes the review."
    : "Please contact your supervisor if you have questions about this decision."
}`,
      status: "pending",
    })

    if (status === "approved") {
      const { data: adminUsers } = await supabase
        .from("user_profiles")
        .select("id, first_name, last_name, email")
        .eq("role", "admin")

      if (adminUsers && adminUsers.length > 0) {
        const notifications = adminUsers.map((admin) => ({
          user_id: admin.id,
          email_type: "excuse_duty_hr_review",
          subject: "Excuse Duty Approved - HR Processing Required",
          body: `An excuse duty submission has been approved by the Head of Department and requires HR processing:

Staff Member: ${docUserProfile.first_name} ${docUserProfile.last_name} (${docUserProfile.employee_id})
Date of Absence: ${new Date(excuseDoc.excuse_date).toLocaleDateString()}
Document Type: ${excuseDoc.document_type}
Approved By: ${profile.first_name} ${profile.last_name}

Please log in to the HR Excuse Duty Portal to complete the final processing.`,
          status: "pending",
        }))

        await supabase.from("email_notifications").insert(notifications)
        console.log("[v0] HOD Excuse duty API - HR notifications sent")
      }
    }

    await supabase.from("audit_logs").insert({
      user_id: user.id,
      action: `excuse_duty_hod_${status}`,
      table_name: "excuse_documents",
      record_id: documentId,
      old_values: {
        hod_status: excuseDoc.hod_status,
        final_status: excuseDoc.final_status,
      },
      new_values: {
        hod_status: status,
        final_status: finalStatus,
        hod_review_notes: reviewNotes,
      },
    })

    console.log("[v0] HOD Excuse duty API - Document reviewed successfully")

    return NextResponse.json({
      success: true,
      message: `Excuse duty ${status} successfully${status === "approved" ? " and forwarded to HR" : ""}`,
      document: updatedDoc,
    })
  } catch (error) {
    console.error("[v0] HOD Excuse duty API - Error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
