import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"

export async function POST() {
  try {
    const supabase = await createClient()

    // Check if document_url column exists by trying to select it
    const { data, error: selectError } = await supabase
      .from("leave_requests")
      .select("document_url")
      .limit(1)

    if (selectError && selectError.message.includes("column") && selectError.message.includes("document_url")) {
      // Column doesn't exist, we need to add it
      // Since we can't run DDL through Supabase client, we'll use a workaround
      // by creating a temporary function or using the REST API

      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
      const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

      if (!supabaseUrl || !supabaseKey) {
        return NextResponse.json({
          error: "Supabase configuration missing",
          message: "Please run the migration script manually in Supabase SQL Editor: ALTER TABLE leave_requests ADD COLUMN document_url TEXT;",
          sql: "ALTER TABLE leave_requests ADD COLUMN document_url TEXT;"
        }, { status: 500 })
      }

      // Try to run the migration using fetch to the Supabase REST API
      try {
        const response = await fetch(`${supabaseUrl}/rest/v1/rpc/exec_sql`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${supabaseKey}`,
            'apikey': supabaseKey
          },
          body: JSON.stringify({
            sql: 'ALTER TABLE leave_requests ADD COLUMN IF NOT EXISTS document_url TEXT;'
          })
        })

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`)
        }

        return NextResponse.json({ message: "document_url column added successfully" })
      } catch (fetchError) {
        return NextResponse.json({
          error: "Failed to run migration automatically",
          message: "Please run the migration script manually in Supabase SQL Editor: ALTER TABLE leave_requests ADD COLUMN document_url TEXT;",
          sql: "ALTER TABLE leave_requests ADD COLUMN document_url TEXT;",
          fetchError: fetchError instanceof Error ? fetchError.message : 'Unknown error'
        }, { status: 400 })
      }
    }

    return NextResponse.json({ message: "document_url column already exists" })
  } catch (error) {
    console.error("Migration check error:", error)
    return NextResponse.json({ error: "Migration check failed" }, { status: 500 })
  }
}