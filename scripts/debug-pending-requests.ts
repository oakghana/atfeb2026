import { createClient } from "@supabase/supabase-js"

async function debugPendingRequests() {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!supabaseUrl || !supabaseKey) {
      console.error("[v0] Missing Supabase credentials")
      return
    }

    const supabase = createClient(supabaseUrl, supabaseKey)

    // Check ALL records in the table
    console.log("\n📊 CHECKING ALL pending_offpremises_checkins RECORDS")
    console.log("========================================================")
    
    const { data: allRecords, error: allError } = await supabase
      .from("pending_offpremises_checkins")
      .select("id, user_id, current_location_name, status, reason, created_at")
      .order("created_at", { ascending: false })

    if (allError) {
      console.error("[v0] Error fetching all records:", allError)
      return
    }

    console.log(`Total records in table: ${allRecords?.length || 0}`)
    if (allRecords && allRecords.length > 0) {
      console.log("\nLast 5 records:")
      allRecords.slice(0, 5).forEach((record, index) => {
        console.log(`\n${index + 1}. Status: ${record.status} | Reason: ${record.reason || "NULL"}`)
        console.log(`   Created: ${new Date(record.created_at).toLocaleString()}`)
        console.log(`   Location: ${record.current_location_name}`)
      })
    }

    // Check specifically for PENDING status
    console.log("\n\n📋 CHECKING PENDING STATUS ONLY")
    console.log("========================================================")
    
    const { data: pendingOnly, error: pendingError } = await supabase
      .from("pending_offpremises_checkins")
      .select("id, user_id, current_location_name, status, reason, created_at")
      .eq("status", "pending")
      .order("created_at", { ascending: false })

    if (pendingError) {
      console.error("[v0] Error fetching pending records:", pendingError)
      return
    }

    console.log(`Records with status='pending': ${pendingOnly?.length || 0}`)
    if (pendingOnly && pendingOnly.length > 0) {
      pendingOnly.slice(0, 3).forEach((record, index) => {
        console.log(`\n${index + 1}. Reason: ${record.reason || "NOT PROVIDED"}`)
        console.log(`   Created: ${new Date(record.created_at).toLocaleString()}`)
      })
    } else {
      console.log("❌ NO PENDING REQUESTS FOUND IN DATABASE")
    }

    // Check the very latest record
    console.log("\n\n🆕 LATEST RECORD (regardless of status)")
    console.log("========================================================")
    
    const { data: latest, error: latestError } = await supabase
      .from("pending_offpremises_checkins")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(1)
      .single()

    if (latestError) {
      console.error("[v0] Error fetching latest:", latestError)
    } else if (latest) {
      console.log(`Status: ${latest.status}`)
      console.log(`Reason: ${latest.reason || "NULL"}`)
      console.log(`Created: ${new Date(latest.created_at).toLocaleString()}`)
      console.log(`\nFull record:`, JSON.stringify(latest, null, 2))
    }
  } catch (error) {
    console.error("[v0] Script error:", error)
  }
}

debugPendingRequests()
