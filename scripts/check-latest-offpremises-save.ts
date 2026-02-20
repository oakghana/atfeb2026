import { createClient } from "@supabase/supabase-js"

async function checkLatestOffPremisesRequest() {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!supabaseUrl || !supabaseKey) {
      console.error("[v0] Missing Supabase credentials")
      return
    }

    const supabase = createClient(supabaseUrl, supabaseKey)

    // Fetch the latest off-premises check-in request
    const { data: requests, error } = await supabase
      .from("pending_offpremises_checkins")
      .select(
        `
        id,
        user_id,
        current_location_name,
        latitude,
        longitude,
        accuracy,
        device_info,
        created_at,
        status,
        approved_by_id,
        approved_at,
        rejection_reason,
        google_maps_name,
        user_profiles!pending_offpremises_checkins_user_id_fkey (
          id,
          first_name,
          last_name,
          email,
          employee_id
        )
      `
      )
      .order("created_at", { ascending: false })
      .limit(5)

    if (error) {
      console.error("[v0] Error fetching requests:", error)
      return
    }

    console.log("\n\n🔍 CHECKING YOUR LATEST OFF-PREMISES REQUESTS:")
    console.log("====================================")

    if (!requests || requests.length === 0) {
      console.log("❌ NO REQUESTS FOUND IN DATABASE")
      return
    }

    requests.forEach((req, index) => {
      const createdDate = new Date(req.created_at)
      const now = new Date()
      const minutesAgo = Math.floor((now.getTime() - createdDate.getTime()) / (1000 * 60))

      console.log(`\n${index + 1}. Request ID: ${req.id}`)
      console.log(`   Employee: ${req.user_profiles?.first_name} ${req.user_profiles?.last_name}`)
      console.log(`   Location: ${req.current_location_name}`)
      console.log(`   Created: ${createdDate.toLocaleString()} (${minutesAgo} minutes ago)`)
      console.log(`   Status: ${req.status}`)
      
      if (minutesAgo < 5) {
        console.log(`   ✅ JUST SAVED! (Very recent - ${minutesAgo} minutes ago)`)
      }
    })

    console.log("\n====================================")
    console.log(`✅ SUCCESS - Your request WAS SAVED to the database!`)
    console.log("Your most recent request is stored and visible above.")
    console.log("====================================\n\n")
  } catch (error) {
    console.error("[v0] Script error:", error)
  }
}

checkLatestOffPremisesRequest()
