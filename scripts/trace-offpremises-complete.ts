import { createClient } from "@supabase/supabase-js"

/**
 * COMPREHENSIVE OFF-PREMISES REQUEST TRACE SIMULATION
 * 
 * This script traces the complete data flow of an off-premises check-in request:
 * 1. Checks if requests exist in the main table
 * 2. Checks related tables for data
 * 3. Verifies user and manager profiles
 * 4. Traces notification records
 * 5. Identifies data storage locations
 */

async function traceOffPremisesFlow() {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!supabaseUrl || !supabaseKey) {
      console.error("[v0] Missing Supabase credentials")
      process.exit(1)
    }

    const supabase = createClient(supabaseUrl, supabaseKey)

    console.log("\n" + "=".repeat(100))
    console.log("OFF-PREMISES REQUEST TRACE SIMULATION")
    console.log("=".repeat(100))

    // STEP 1: Check main table - ALL records (not just 30 min)
    console.log("\n[STEP 1] Checking pending_offpremises_checkins table (ALL records)...")
    const { data: allRequests, error: allError } = await supabase
      .from("pending_offpremises_checkins")
      .select("id, user_id, status, created_at, approved_at, rejection_reason")
      .order("created_at", { ascending: false })

    if (allError) {
      console.error("[ERROR] Failed to query pending_offpremises_checkins:", allError)
    } else {
      console.log(`[FOUND] ${allRequests?.length || 0} total records in pending_offpremises_checkins`)
      if (allRequests && allRequests.length > 0) {
        console.log("Status breakdown:")
        const statusCounts = allRequests.reduce((acc: any, r: any) => {
          acc[r.status] = (acc[r.status] || 0) + 1
          return acc
        }, {})
        console.log(JSON.stringify(statusCounts, null, 2))
      }
    }

    // STEP 2: Check for any other tables with "offpremises" or "pending" in name
    console.log("\n[STEP 2] Listing all tables to find data storage locations...")
    const { data: tables } = await supabase
      .from("information_schema.tables")
      .select("table_name")
      .eq("table_schema", "public")
      .ilike("table_name", "%offpremises%")
      .or("table_name.ilike.%pending%,table_name.ilike.%checkout%")

    console.log("[FOUND] Possible related tables:")
    if (tables) {
      tables.forEach((t: any) => console.log(`  - ${t.table_name}`))
    }

    // STEP 3: Check attendance_records table for any off-premises related data
    console.log("\n[STEP 3] Checking attendance_records table for off-premises data...")
    const { data: attendanceRecords } = await supabase
      .from("attendance_records")
      .select("id, user_id, check_in_location_name, status, created_at")
      .ilike("check_in_location_name", "%off%")
      .limit(10)

    if (attendanceRecords && attendanceRecords.length > 0) {
      console.log(`[FOUND] ${attendanceRecords.length} records with off-premises in attendance_records`)
    }

    // STEP 4: Check notifications table
    console.log("\n[STEP 4] Checking staff_notifications for off-premises requests...")
    const { data: notifications } = await supabase
      .from("staff_notifications")
      .select("id, user_id, type, data, created_at")
      .eq("type", "offpremises_checkin_request")
      .order("created_at", { ascending: false })
      .limit(5)

    if (notifications && notifications.length > 0) {
      console.log(`[FOUND] ${notifications.length} notifications for off-premises requests`)
      console.log("[NOTIFICATION DATA]")
      notifications.forEach((n: any) => {
        console.log(`  - Created: ${new Date(n.created_at).toLocaleString()}`)
        console.log(`    Data: ${JSON.stringify(n.data)}`)
      })
    } else {
      console.log("[WARNING] No notifications found - requests may not be reaching managers")
    }

    // STEP 5: Check user_profiles table
    console.log("\n[STEP 5] Checking current user...")
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      console.log(`[CURRENT USER] ${user.id}`)
      
      const { data: profile } = await supabase
        .from("user_profiles")
        .select("*")
        .eq("id", user.id)
        .single()
      
      if (profile) {
        console.log(`  Name: ${profile.first_name} ${profile.last_name}`)
        console.log(`  Email: ${profile.email}`)
        console.log(`  Role: ${profile.role}`)
        console.log(`  Department: ${profile.department_id}`)
      }
    }

    // STEP 6: Get all managers (who should receive notifications)
    console.log("\n[STEP 6] Checking managers in system...")
    const { data: managers } = await supabase
      .from("user_profiles")
      .select("id, first_name, last_name, email, role")
      .in("role", ["admin", "regional_manager", "department_head"])
      .eq("is_active", true)

    console.log(`[FOUND] ${managers?.length || 0} active managers`)
    if (managers) {
      managers.forEach((m: any) => {
        console.log(`  - ${m.first_name} ${m.last_name} (${m.role}): ${m.email}`)
      })
    }

    // STEP 7: Check browser localStorage (for client-side debugging)
    console.log("\n[STEP 7] Suggestions for verification...")
    console.log("  1. Open browser DevTools (F12)")
    console.log("  2. Go to Console tab and submit an off-premises request")
    console.log("  3. Look for [v0] logs - they'll show:")
    console.log("     - API request payload")
    console.log("     - Database insert result")
    console.log("     - Any errors with details")
    console.log("  4. Check Network tab -> see the API response")
    console.log("  5. Run this trace script again after submission")

    console.log("\n" + "=".repeat(100))
    console.log("TRACE COMPLETE - Review findings above")
    console.log("=".repeat(100) + "\n")

  } catch (error) {
    console.error("[v0] Trace error:", error)
    process.exit(1)
  }
}

traceOffPremisesFlow()
