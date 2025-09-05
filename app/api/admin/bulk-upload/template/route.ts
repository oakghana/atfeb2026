import { NextResponse } from "next/server"

export async function GET() {
  try {
    // Sample data with proper formats
    const sampleData = [
      {
        first_name: "John",
        last_name: "Doe",
        email: "john.doe@qccgh.com",
        phone: "+233241234567",
        employee_id: "EMP001",
        department_code: "IT",
        position: "Software Developer",
        hire_date: "2024-01-15",
      },
      {
        first_name: "Jane",
        last_name: "Smith",
        email: "jane.smith@qccgh.com",
        phone: "+233501234567",
        employee_id: "EMP002",
        department_code: "HR",
        position: "HR Manager",
        hire_date: "2024-02-01",
      },
      {
        first_name: "Michael",
        last_name: "Johnson",
        email: "michael.johnson@qccgh.com",
        phone: "+233261234567",
        employee_id: "EMP003",
        department_code: "FIN",
        position: "Accountant",
        hire_date: "2024-03-10",
      },
    ]

    // Create CSV headers
    const headers = [
      "first_name",
      "last_name",
      "email",
      "phone",
      "employee_id",
      "department_code",
      "position",
      "hire_date",
    ]

    // Create CSV content
    const csvContent = [
      headers.join(","),
      ...sampleData.map((row) => headers.map((header) => `"${row[header] || ""}"`).join(",")),
    ].join("\n")

    // Add format instructions as comments
    const instructions = `# QCC Staff Bulk Import Template
# 
# FORMAT REQUIREMENTS:
# - email: Must be valid email format (e.g., user@qccgh.com)
# - phone: Ghana format with country code (e.g., +233241234567, +233501234567, +233261234567)
# - employee_id: Unique alphanumeric code (e.g., EMP001, 1151908)
# - department_code: 2-4 letter department code (e.g., IT, HR, FIN, ADM, OPS)
# - hire_date: YYYY-MM-DD format (e.g., 2024-01-15)
# 
# NOTES:
# - All fields are optional except first_name and last_name
# - Invalid formats will be auto-corrected during import
# - Duplicate employee_ids will be auto-generated
# - Missing department codes will default to "GEN"
#
${csvContent}`

    return new NextResponse(instructions, {
      headers: {
        "Content-Type": "text/csv",
        "Content-Disposition": `attachment; filename="qcc-staff-import-template.csv"`,
      },
    })
  } catch (error) {
    console.error("Template generation error:", error)
    return NextResponse.json({ error: "Failed to generate template" }, { status: 500 })
  }
}
