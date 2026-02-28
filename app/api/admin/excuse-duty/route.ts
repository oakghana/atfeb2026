import { createClient } from "@/lib/supabase/server"
import { type NextRequest, NextResponse } from "next/server"

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

    // Check if user has admin, regional_manager, or department_head role
    if (!["admin", "regional_manager", "department_head"].includes(profile.role)) {
      console.log("[v0] HOD Excuse duty API - Insufficient permissions")
      return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 })
    }

    console.log("[v0] HOD Excuse duty API - User authorized:", profile.role)

    // Build base query for excuse documents (select only needed columns)
    let query = supabase
      .from("excuse_documents")
      .select(
        "id,document_name,document_type,file_url,excuse_reason,excuse_date,status,user_id,reviewed_by,reviewed_at,review_notes,created_at,attendance_record_id"
      )

    // Get URL parameters for filtering and pagination
    const url = new URL(request.url)
    const status = url.searchParams.get("status")
    const departmentFilter = url.searchParams.get("department")
    const docType = url.searchParams.get("document_type")
    const dateFrom = url.searchParams.get("date_from")
    const dateTo = url.searchParams.get("date_to")
    const pageParam = parseInt(url.searchParams.get("page") || "1", 10)
    const perPage = Math.min(parseInt(url.searchParams.get("per_page") || "50", 10), 200)

    if (status && status !== "all") {
      query = query.eq("status", status)
    }

    if (docType && docType !== "all") {
      query = query.eq("document_type", docType)
    }

    if (dateFrom) {
      query = query.gte("excuse_date", dateFrom)
    }
    if (dateTo) {
      query = query.lte("excuse_date", dateTo)
    }

    // If the requester is a department head, restrict the query to user_ids in their department
    if (profile.role === "department_head" && profile.department_id) {
      const { data: deptUsers } = await supabase
        .from("user_profiles")
        .select("id")
        .eq("department_id", profile.department_id)

      const userIds = (deptUsers || []).map((u: any) => u.id)
      if (userIds.length === 0) {
        // No users in department -> return empty
        return NextResponse.json({ excuseDocuments: [], userRole: profile.role, userDepartment: profile.department_id })
      }
      query = query.in("user_id", userIds)
    }

    // If admin supplied a department filter, restrict to users in that department
    if (departmentFilter && profile.role === "admin") {
      const { data: deptUsers } = await supabase
        .from("user_profiles")
        .select("id")
        .eq("department_id", departmentFilter)

      const userIds = (deptUsers || []).map((u: any) => u.id)
      if (userIds.length === 0) {
        return NextResponse.json({ excuseDocuments: [], userRole: profile.role, userDepartment: profile.department_id })
      }
      query = query.in("user_id", userIds)
    }

    // Pagination: request one extra row to determine if there is more data
    const page = Math.max(1, isNaN(pageParam) ? 1 : pageParam)
    const start = (page - 1) * perPage
    const end = start + perPage // request perPage+1 rows
    const { data: excuseDocsRaw, error } = await query.order("created_at", { ascending: false }).range(start, end)
    const excuseDocs = excuseDocsRaw || []

    if (error) {
      console.error("[v0] HOD Excuse duty API - Query error:", error)
      const detail = (error && (error as any).message) || JSON.stringify(error)
      return NextResponse.json({ error: "Failed to fetch excuse documents", details: detail }, { status: 500 })
    }

    // Batch fetch related user profiles and departments to avoid N+1 queries
    const userIds = Array.from(new Set((excuseDocs || []).map((d: any) => d.user_id).filter(Boolean)))
    const reviewerIds = Array.from(new Set((excuseDocs || []).map((d: any) => d.reviewed_by).filter(Boolean)))
    const allProfileIds = Array.from(new Set([...userIds, ...reviewerIds]))

    const profilesMap: Record<string, any> = {}
    if (allProfileIds.length > 0) {
      const { data: profiles } = await supabase
        .from("user_profiles")
        .select("id, first_name, last_name, employee_id, department_id")
        .in("id", allProfileIds)

      for (const p of profiles || []) {
        profilesMap[p.id] = p
      }
    }

    // Batch fetch departments for any department_ids found
    const deptIds = Array.from(new Set(Object.values(profilesMap).map((p: any) => p.department_id).filter(Boolean)))
    const deptMap: Record<string, any> = {}
    if (deptIds.length > 0) {
      const { data: depts } = await supabase.from("departments").select("id, name, code").in("id", deptIds)
      for (const d of depts || []) deptMap[d.id] = d
    }

    const docsWithProfiles = (excuseDocs || []).map((doc: any) => {
      const userProfile = profilesMap[doc.user_id] || null
      const reviewer = doc.reviewed_by ? profilesMap[doc.reviewed_by] || null : null
      const department = userProfile?.department_id ? deptMap[userProfile.department_id] || null : null

      return {
        ...doc,
        user_profiles: userProfile
          ? {
              ...userProfile,
              departments: department,
            }
          : null,
        reviewer: reviewer ? { first_name: reviewer.first_name, last_name: reviewer.last_name } : null,
      }
    })

    console.log("[v0] HOD Excuse duty API - Found documents:", docsWithProfiles.length)

    // Determine hasMore based on whether we requested more than perPage
    const hasMore = (excuseDocs.length || 0) > perPage
    const limitedDocs = docsWithProfiles.slice(0, perPage)

    return NextResponse.json({
      excuseDocuments: limitedDocs,
      userRole: profile.role,
      userDepartment: profile.department_id,
      pagination: {
        page,
        perPage,
        hasMore,
      },
    })
  } catch (error) {
    console.error("[v0] HOD Excuse duty API - Error:", error)
    const detail = (error && (error as any).message) || JSON.stringify(error)
    return NextResponse.json({ error: "Internal server error", details: detail }, { status: 500 })
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

    if (!["admin", "regional_manager", "department_head"].includes(profile.role)) {
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
