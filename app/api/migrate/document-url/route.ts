import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"

export async function POST() {
  try {
    const supabase = await createClient()

    // Try to insert a test record with document_url to see if the column exists
    const { error: testError } = await supabase
      .from("leave_requests")
      .insert({
        user_id: "00000000-0000-0000-0000-000000000000", // dummy id
        start_date: "2024-01-01",
        end_date: "2024-01-01",
        reason: "Test migration",
        document_url: "test",
        status: "pending"
      })

    if (testError) {
      // If the error is about document_url column not existing, we need to add it
      if (testError.message.includes("column") && testError.message.includes("document_url")) {
        // Since we can't directly alter tables through the API, we'll return an instruction
        return NextResponse.json({
          error: "document_url column does not exist",
          message: "Please run the migration script manually in Supabase SQL Editor: ALTER TABLE leave_requests ADD COLUMN document_url TEXT;",
          sql: "ALTER TABLE leave_requests ADD COLUMN document_url TEXT;"
        }, { status: 400 })
      }
      // If it's a different error (like foreign key constraint), the column exists
      if (testError.message.includes("foreign key") || testError.message.includes("violates")) {
        return NextResponse.json({ message: "document_url column already exists" })
      }
      throw testError
    }

    // If no error, the column exists, clean up the test record
    await supabase
      .from("leave_requests")
      .delete()
      .eq("user_id", "00000000-0000-0000-0000-000000000000")
      .eq("reason", "Test migration")

    return NextResponse.json({ message: "document_url column exists" })
  } catch (error) {
    console.error("Migration check error:", error)
    return NextResponse.json({ error: "Migration check failed" }, { status: 500 })
  }
}