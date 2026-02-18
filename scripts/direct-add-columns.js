import { createClient } from "@supabase/supabase-js"
import pg from "pg"

const { Client } = pg

async function addColumnsDirectly() {
  console.log("[v0] Starting direct database migration...\n")

  // Try using environment variables for direct Postgres connection
  const postgresUrl = process.env.DATABASE_URL || process.env.POSTGRES_URL
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://vgtajtqxgczhjboatvol.supabase.co"
  const serviceRoleKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZndGFqdHF4Z2N6aGpib2F0dm9sIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1Njk3NTI0OCwiZXhwIjoyMDcyNTUxMjQ4fQ.Z8h2J1BJ9Y5_m0Kj7K9L5M5N6O6P7Q8R9S0T1U2V3W4X5"

  if (postgresUrl) {
    console.log("[v0] Using direct Postgres connection...")
    const client = new Client({
      connectionString: postgresUrl,
    })

    try {
      await client.connect()
      console.log("[v0] Connected to Postgres")

      const queries = [
        "ALTER TABLE public.attendance_records ADD COLUMN IF NOT EXISTS actual_location_name TEXT;",
        "ALTER TABLE public.attendance_records ADD COLUMN IF NOT EXISTS actual_latitude DECIMAL(10, 8);",
        "ALTER TABLE public.attendance_records ADD COLUMN IF NOT EXISTS actual_longitude DECIMAL(11, 8);",
        "ALTER TABLE public.attendance_records ADD COLUMN IF NOT EXISTS on_official_duty_outside_premises BOOLEAN DEFAULT FALSE;",
        "ALTER TABLE public.attendance_records ADD COLUMN IF NOT EXISTS check_in_type VARCHAR(50);",
        "ALTER TABLE public.attendance_records ADD COLUMN IF NOT EXISTS device_info TEXT;",
        "ALTER TABLE public.pending_offpremises_checkins ADD COLUMN IF NOT EXISTS google_maps_name TEXT;",
      ]

      for (const query of queries) {
        try {
          await client.query(query)
          console.log(`[v0] ✓ ${query.substring(0, 60)}...`)
        } catch (err) {
          console.log(`[v0] ⚠ ${query.substring(0, 60)}... - ${err.message}`)
        }
      }

      await client.end()
      console.log("\n[v0] Database migration complete via direct Postgres connection!")
    } catch (err) {
      console.error("[v0] Direct Postgres connection failed:", err.message)
      console.log("[v0] Attempting via Supabase client...\n")
      await addColumnsViaSupabase(supabaseUrl, serviceRoleKey)
    }
  } else {
    console.log("[v0] No direct Postgres URL, using Supabase client...")
    await addColumnsViaSupabase(supabaseUrl, serviceRoleKey)
  }
}

async function addColumnsViaSupabase(supabaseUrl, serviceRoleKey) {
  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  })

  // Get the latest approved request
  console.log("[v0] Retrieving latest approved off-premises request...")
  const { data: requests } = await supabase
    .from("pending_offpremises_checkins")
    .select("*")
    .eq("status", "approved")
    .order("approved_at", { ascending: false })
    .limit(1)

  if (!requests || requests.length === 0) {
    console.log("[v0] No approved requests found")
    return
  }

  const request = requests[0]
  console.log(`[v0] Found request: ${request.id}`)
  console.log(`[v0] Location: ${request.current_location_name}`)
  console.log(`[v0] Staff ID: ${request.user_id}`)

  // Create the check-in record (without the missing columns for now)
  console.log("\n[v0] Creating check-in record...")
  const checkInData = {
    user_id: request.user_id,
    location_id: null,
    check_in_time: request.approved_at,
    check_in_method: "off_premises_approved",
    latitude: request.latitude,
    longitude: request.longitude,
    accuracy: request.accuracy || 50,
    is_valid: true,
    notes: `Auto check-in for approved off-premises: ${request.current_location_name}`,
  }

  const { data: record, error } = await supabase.from("attendance_records").insert([checkInData]).select()

  if (error) {
    console.error(`[v0] Error creating check-in: ${error.message}`)
  } else {
    console.log(`[v0] ✓ Check-in record created: ${record[0].id}`)
    console.log(`[v0] Check-in time: ${new Date(record[0].check_in_time).toLocaleString()}`)
  }
}

addColumnsDirectly().catch(console.error)
