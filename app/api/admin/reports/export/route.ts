import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import * as XLSX from "xlsx"
import jsPDF from "jspdf"
import "jspdf-autotable"

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Check admin role
    const { data: profile } = await supabase.from("user_profiles").select("role").eq("id", user.id).single()

    if (!profile || !["admin", "department_head"].includes(profile.role)) {
      return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 })
    }

    const { format, filters } = await request.json()
    const { startDate, endDate, locationId, districtId, reportType } = filters

    // Build query based on report type
    let query = supabase.from("attendance_records").select(`
        *,
        user_profiles!inner(
          first_name,
          last_name,
          employee_id,
          departments(name),
          districts(name)
        ),
        geofence_locations(name, address)
      `)

    if (startDate) {
      query = query.gte("check_in_time", startDate)
    }
    if (endDate) {
      query = query.lte("check_in_time", endDate)
    }
    if (locationId) {
      query = query.eq("location_id", locationId)
    }

    const { data: attendanceData, error } = await query.order("check_in_time", { ascending: false })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Process data for export
    const exportData =
      attendanceData?.map((record) => ({
        "Employee ID": record.user_profiles.employee_id,
        Name: `${record.user_profiles.first_name} ${record.user_profiles.last_name}`,
        Department: record.user_profiles.departments?.name || "N/A",
        District: record.user_profiles.districts?.name || "N/A",
        Location: record.geofence_locations?.name || "N/A",
        "Check In": new Date(record.check_in_time).toLocaleString(),
        "Check Out": record.check_out_time ? new Date(record.check_out_time).toLocaleString() : "Not checked out",
        Status: record.status,
        "Work Hours": record.work_hours || "0",
        Date: new Date(record.check_in_time).toLocaleDateString(),
      })) || []

    if (format === "excel") {
      // Generate Excel file
      const worksheet = XLSX.utils.json_to_sheet(exportData)
      const workbook = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(workbook, worksheet, "Attendance Report")

      const excelBuffer = XLSX.write(workbook, { bookType: "xlsx", type: "buffer" })

      return new NextResponse(excelBuffer, {
        headers: {
          "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          "Content-Disposition": `attachment; filename="attendance-report-${new Date().toISOString().split("T")[0]}.xlsx"`,
        },
      })
    } else if (format === "pdf") {
      // Generate PDF file
      const doc = new jsPDF()

      // Add title
      doc.setFontSize(16)
      doc.text("QCC Attendance Report", 20, 20)
      doc.setFontSize(10)
      doc.text(`Generated on: ${new Date().toLocaleDateString()}`, 20, 30)

      // Add table
      const tableData = exportData.map((row) => Object.values(row))
      const tableHeaders = Object.keys(exportData[0] || {})

      doc.autoTable({
        head: [tableHeaders],
        body: tableData,
        startY: 40,
        styles: { fontSize: 8 },
        headStyles: { fillColor: [41, 128, 185] },
      })

      const pdfBuffer = doc.output("arraybuffer")

      return new NextResponse(pdfBuffer, {
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `attachment; filename="attendance-report-${new Date().toISOString().split("T")[0]}.pdf"`,
        },
      })
    }

    return NextResponse.json({ error: "Invalid format" }, { status: 400 })
  } catch (error) {
    console.error("Export error:", error)
    return NextResponse.json({ error: "Export failed" }, { status: 500 })
  }
}
