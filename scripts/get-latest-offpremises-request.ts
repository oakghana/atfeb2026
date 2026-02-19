import { createAdminClient } from "@/lib/supabase/server"

async function getLatestOffPremisesRequest() {
  try {
    const adminClient = await createAdminClient()

    // Get the current authenticated user
    // Since this is a server script, we'll fetch all requests and let you identify your own
    const { data: allRequests, error } = await adminClient
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
    console.log("[v0] Latest Off-Premises Check-in Request:")
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
      console.log(`Approved At: ${new Date(latestRequest.approved_at).toLocaleString()}`)
      console.log(`Approved By ID: ${latestRequest.approved_by_id}`)
    } else {
      console.log("Approved At: Not approved yet")
    }
    
    console.log(`Rejection Reason: ${latestRequest.rejection_reason || "None"}`)
    console.log(`Device Info: ${latestRequest.device_info}`)
    console.log("=====================================")

    return { request: latestRequest }
  } catch (error) {
    console.error("[v0] Script error:", error)
    return { error: error instanceof Error ? error.message : String(error) }
  }
}

getLatestOffPremisesRequest()
