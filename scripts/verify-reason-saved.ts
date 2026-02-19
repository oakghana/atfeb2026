import { createClient } from "@supabase/supabase-js"

async function verifyLatestSave() {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!supabaseUrl || !supabaseKey) {
      console.error("[v0] Missing Supabase credentials")
      return
    }

    const supabase = createClient(supabaseUrl, supabaseKey)

    // Fetch the latest request
    const { data: latestRequest, error } = await supabase
      .from("pending_offpremises_checkins")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(1)
      .single()

    if (error) {
      console.error("[v0] Error:", error)
      return
    }

    console.log("\n✅ VERIFICATION - Latest Off-Premises Request")
    console.log("=============================================")
    console.log(`ID: ${latestRequest.id}`)
    console.log(`User ID: ${latestRequest.user_id}`)
    console.log(`Location: ${latestRequest.current_location_name}`)
    console.log(`Reason: ${latestRequest.reason || "NOT SAVED"}`)
    console.log(`Status: ${latestRequest.status}`)
    console.log(`Created: ${new Date(latestRequest.created_at).toLocaleString()}`)
    console.log(`Device Info: ${latestRequest.device_info}`)
    console.log("=============================================\n")

    if (latestRequest.reason === "testing a new test") {
      console.log("✅ SUCCESS: Your 'testing a new test' request IS now saved with the reason!")
    } else {
      console.log("⚠️  NOTE: The latest request reason is:", latestRequest.reason)
    }
  } catch (error) {
    console.error("[v0] Error:", error)
  }
}

verifyLatestSave()
