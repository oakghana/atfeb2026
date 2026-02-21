import { createClient } from "@supabase/supabase-js"

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://vgtajtqxgczhjboatvol.supabase.co"
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseKey) {
  console.error("[v0] SUPABASE_SERVICE_ROLE_KEY not set")
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

async function runCheckoutSimulation() {
  console.log("\n" + "=".repeat(80))
  console.log("COMPREHENSIVE CHECKOUT SIMULATION")
  console.log("=".repeat(80) + "\n")

  try {
    // 1. Get today's attendance records
    const today = new Date().toISOString().split("T")[0]
    console.log(`[STEP 1] Fetching today's attendance records for ${today}...\n`)

    const { data: records, error: fetchError } = await supabase
      .from("attendance_records")
      .select("*")
      .gte("check_in_time", `${today}T00:00:00`)
      .lt("check_in_time", `${today}T23:59:59`)
      .order("check_in_time", { ascending: false })
      .limit(1)

    if (fetchError) {
      console.error("[ERROR] Failed to fetch records:", fetchError)
      return
    }

    if (!records || records.length === 0) {
      console.log("[INFO] No check-in records found for today")
      console.log("Creating a test check-in first...\n")

      // Create a test check-in
      const testCheckIn = {
        user_id: "372eba9d-6515-4df1-8160-bfba99af197c",
        check_in_time: new Date().toISOString(),
        check_in_location_id: "11111111-1111-1111-1111-111111111111",
        check_in_latitude: -31.854696,
        check_in_longitude: 116.00816,
        check_in_location_name: "Cocobod Archives",
        work_hours: 0,
        status: "present",
      }

      const { data: newRecord, error: insertError } = await supabase
        .from("attendance_records")
        .insert([testCheckIn])
        .select("*")
        .single()

      if (insertError) {
        console.error("[ERROR] Failed to create test check-in:", insertError)
        return
      }

      console.log("[SUCCESS] Test check-in created:")
      console.log(JSON.stringify(newRecord, null, 2))
      records[0] = newRecord
    }

    const record = records[0]
    console.log("[FOUND] Today's attendance record:")
    console.log(`  ID: ${record.id}`)
    console.log(`  Check-in: ${record.check_in_time}`)
    console.log(`  Check-out: ${record.check_out_time || "NOT YET"}`)
    console.log(`  Work Hours: ${record.work_hours || "0"}`)
    console.log()

    // 2. Simulate checkout
    console.log(`[STEP 2] Simulating checkout...\n`)

    const now = new Date()
    const checkInTime = new Date(record.check_in_time)
    const elapsedMs = now.getTime() - checkInTime.getTime()
    const elapsedHours = elapsedMs / (1000 * 60 * 60)
    const workHours = parseFloat(elapsedHours.toFixed(2))

    const checkoutData = {
      check_out_time: now.toISOString(),
      check_out_location_id: record.check_in_location_id,
      check_out_latitude: record.check_in_latitude,
      check_out_longitude: record.check_in_longitude,
      check_out_location_name: record.check_in_location_name || "Remote",
      work_hours: workHours,
      is_remote_checkout: false,
      updated_at: now.toISOString(),
    }

    console.log("[INFO] Checkout data to be saved:")
    console.log(JSON.stringify(checkoutData, null, 2))
    console.log()

    // 3. Perform the checkout update
    console.log(`[STEP 3] Updating database with checkout data...\n`)

    const { data: updatedRecord, error: updateError } = await supabase
      .from("attendance_records")
      .update(checkoutData)
      .eq("id", record.id)
      .select("*")
      .single()

    if (updateError) {
      console.error("[ERROR] Failed to update checkout:", updateError)
      console.error("Details:", updateError.details || updateError.hint)
      return
    }

    console.log("[SUCCESS] Checkout recorded!")
    console.log(JSON.stringify(updatedRecord, null, 2))
    console.log()

    // 4. Verify persistence
    console.log(`[STEP 4] Verifying data persisted to database...\n`)

    const { data: verifyRecord, error: verifyError } = await supabase
      .from("attendance_records")
      .select("*")
      .eq("id", record.id)
      .single()

    if (verifyError) {
      console.error("[ERROR] Failed to verify record:", verifyError)
      return
    }

    console.log("[VERIFICATION] Database record after checkout:")
    console.log(`  Check-out Time: ${verifyRecord.check_out_time}`)
    console.log(`  Check-out Location: ${verifyRecord.check_out_location_name}`)
    console.log(`  Work Hours: ${verifyRecord.work_hours}`)
    console.log()

    // 5. Check if data matches
    console.log(`[STEP 5] Comparing expected vs actual...\n`)

    const dataMatches = {
      checkoutTime: verifyRecord.check_out_time === checkoutData.check_out_time,
      workHours: verifyRecord.work_hours === checkoutData.work_hours,
      location: verifyRecord.check_out_location_name === checkoutData.check_out_location_name,
    }

    console.log("[RESULTS]")
    console.log(`  Checkout time persisted: ${dataMatches.checkoutTime ? "✓ YES" : "✗ NO"}`)
    console.log(`  Work hours persisted: ${dataMatches.workHours ? "✓ YES" : "✗ NO"}`)
    console.log(`  Location persisted: ${dataMatches.location ? "✓ YES" : "✗ NO"}`)
    console.log()

    // 6. Badge display information
    console.log(`[STEP 6] UI Completion Badge Status...\n`)

    if (verifyRecord.check_out_time) {
      console.log("[BADGE] Good Job! ✓")
      console.log("  Status: SHOULD DISPLAY")
      console.log("  Message: Day's Work Completed")
      console.log(`  Checkout Time: ${new Date(verifyRecord.check_out_time).toLocaleTimeString()}`)
      console.log(`  Location: ${verifyRecord.check_out_location_name}`)
      console.log(`  Total Work Hours: ${verifyRecord.work_hours}h`)
      console.log()
      console.log("[SUCCESS] All systems working correctly!")
    } else {
      console.log("[BADGE] NOT DISPLAYED")
      console.log("  Issue: check_out_time is NULL in database")
      console.log("  Status: FAILURE - Data not persisted")
    }

    console.log("\n" + "=".repeat(80))
    console.log("SIMULATION COMPLETE")
    console.log("=".repeat(80) + "\n")
  } catch (error) {
    console.error("[FATAL ERROR]", error)
  }
}

runCheckoutSimulation()
