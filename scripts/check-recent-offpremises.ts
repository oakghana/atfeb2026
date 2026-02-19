import { createClient } from "@supabase/supabase-js"

async function checkRecentOffPremisesRequests() {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!supabaseUrl || !supabaseKey) {
      console.error("[v0] Missing Supabase credentials")
      process.exit(1)
    }

    const supabase = createClient(supabaseUrl, supabaseKey)

    // Calculate timestamp for 30 minutes ago
    const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000).toISOString()
    const now = new Date().toISOString()

    console.log("\n[v0] Checking off-premises requests from the last 30 minutes")
    console.log(`[v0] Time range: ${thirtyMinutesAgo} to ${now}`)
    console.log("=".repeat(80))

    // Fetch all requests created in the last 30 minutes
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
        status,
        created_at,
        approved_at,
        approved_by_id,
        rejection_reason,
        user_profiles!pending_offpremises_checkins_user_id_fkey (
          first_name,
          last_name,
          email,
          employee_id
        )
      `
      )
      .gte("created_at", thirtyMinutesAgo)
      .lte("created_at", now)
      .order("created_at", { ascending: false })

    if (error) {
      console.error("[v0] Error fetching requests:", error.message)
      process.exit(1)
    }

    console.log(`\n[v0] Found ${requests?.length || 0} requests in the last 30 minutes\n`)

    if (!requests || requests.length === 0) {
      console.log("[v0] No requests found in the last 30 minutes")
      process.exit(0)
    }

    // Summary by status
    const statusCounts = {
      pending: 0,
      approved: 0,
      rejected: 0,
    }

    requests.forEach((req: any) => {
      if (req.status === "pending") statusCounts.pending++
      else if (req.status === "approved") statusCounts.approved++
      else if (req.status === "rejected") statusCounts.rejected++
    })

    console.log("[v0] STATUS SUMMARY:")
    console.log(`  - Pending: ${statusCounts.pending}`)
    console.log(`  - Approved: ${statusCounts.approved}`)
    console.log(`  - Rejected: ${statusCounts.rejected}`)
    console.log("\n" + "=".repeat(80))

    // Detailed list
    console.log("\n[v0] DETAILED REQUEST LIST:\n")
    requests.forEach((req: any, index: number) => {
      const employee = req.user_profiles
        ? `${req.user_profiles.first_name} ${req.user_profiles.last_name} (${req.user_profiles.email})`
        : "Unknown"
      
      const createdTime = new Date(req.created_at).toLocaleString()
      const approvedTime = req.approved_at ? new Date(req.approved_at).toLocaleString() : "N/A"
      
      console.log(`${index + 1}. [${req.status.toUpperCase()}] Request ID: ${req.id}`)
      console.log(`   Employee: ${employee}`)
      console.log(`   Location: ${req.current_location_name}`)
      console.log(`   Coordinates: ${req.latitude}, ${req.longitude} (Accuracy: ${req.accuracy}m)`)
      console.log(`   Created: ${createdTime}`)
      
      if (req.approved_at) {
        console.log(`   Action Taken: ${approvedTime}`)
        if (req.status === "rejected" && req.rejection_reason) {
          console.log(`   Rejection Reason: ${req.rejection_reason}`)
        }
        if (req.approved_by_id) {
          console.log(`   Processed By: ${req.approved_by_id}`)
        }
      }
      console.log("")
    })

    console.log("=".repeat(80))
    console.log(`[v0] Total requests checked: ${requests.length}\n`)
  } catch (error) {
    console.error("[v0] Script error:", error)
    process.exit(1)
  }
}

checkRecentOffPremisesRequests()
