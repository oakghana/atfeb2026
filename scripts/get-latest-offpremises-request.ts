import { createClient } from "@supabase/supabase-js"

async function getLatestOffPremisesRequest() {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!supabaseUrl || !supabaseKey) {
      console.error("[v0] Missing Supabase credentials")
      return { error: "Missing Supabase credentials" }
    }

    const supabase = createClient(supabaseUrl, supabaseKey)

    // Fetch the latest off-premises check-in request
    const { data: allRequests, error } = await supabase
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
      .limit(1)

    if (error) {
      console.error("[v0] Error fetching requests:", error)
      return { error: error.message }
    }

    if (!allRequests || allRequests.length === 0) {
      console.log("[v0] No off-premises requests found in database")
      return { message: "No requests found" }
    }

    const latestRequest = allRequests[0]
    console.log("\n\n✅ YES - Off-premises check-in requests ARE saved in the database!")
    console.log("=====================================")
    console.log("LATEST OFF-PREMISES CHECK-IN REQUEST:")
    console.log("=====================================")
    console.log(`ID: ${latestRequest.id}`)
    console.log(
      `Employee: ${latestRequest.user_profiles?.first_name} ${latestRequest.user_profiles?.last_name}`
    )
    console.log(`Email: ${latestRequest.user_profiles?.email}`)
    console.log(`Employee ID: ${latestRequest.user_profiles?.employee_id}`)
    console.log(`Location: ${latestRequest.current_location_name}`)
    console.log(`Google Maps Name: ${latestRequest.google_maps_name || "N/A"}`)
    console.log(`Latitude: ${latestRequest.latitude}`)
    console.log(`Longitude: ${latestRequest.longitude}`)
    console.log(`Accuracy: ${latestRequest.accuracy}m`)
    console.log(`Status: ${latestRequest.status}`)
    console.log(`Created At: ${new Date(latestRequest.created_at).toLocaleString()}`)
    
    if (latestRequest.approved_at) {
      console.log(`✅ Approved At: ${new Date(latestRequest.approved_at).toLocaleString()}`)
      console.log(`Approved By ID: ${latestRequest.approved_by_id}`)
    } else {
      console.log("⏳ Approved At: Not approved yet (Status: " + latestRequest.status + ")")
    }
    
    if (latestRequest.rejection_reason) {
      console.log(`❌ Rejection Reason: ${latestRequest.rejection_reason}`)
    }
    
    console.log(`Device Info: ${latestRequest.device_info}`)
    console.log("=====================================\n\n")

    return { request: latestRequest }
  } catch (error) {
    console.error("[v0] Script error:", error)
    return { error: error instanceof Error ? error.message : String(error) }
  }
}

getLatestOffPremisesRequest()
