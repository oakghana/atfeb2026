import { createClient } from "@supabase/supabase-js"

async function fixOffPremisesWorkflow() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !supabaseKey) {
    console.error("[v0] Missing Supabase credentials")
    return
  }

  const supabase = createClient(supabaseUrl, supabaseKey)

  try {
    console.log("[v0] Checking pending_offpremises_checkins table...")
    
    // Get all requests
    const { data: allRequests, error } = await supabase
      .from("pending_offpremises_checkins")
      .select("id, status, created_at, approved_at, rejection_reason")
      .order("created_at", { ascending: false })
    
    if (error) {
      console.error("[v0] Error querying requests:", error)
      return
    }

    console.log(`\n[v0] Total requests in database: ${allRequests?.length || 0}`)
    
    if (allRequests) {
      const statusCounts = {
        pending: allRequests.filter(r => r.status === 'pending').length,
        approved: allRequests.filter(r => r.status === 'approved').length,
        rejected: allRequests.filter(r => r.status === 'rejected').length,
      }
      
      console.log("[v0] Status breakdown:")
      console.log(`   - Pending: ${statusCounts.pending}`)
      console.log(`   - Approved: ${statusCounts.approved}`)
      console.log(`   - Rejected: ${statusCounts.rejected}`)
      
      console.log("\n[v0] Latest 3 requests:")
      allRequests.slice(0, 3).forEach(req => {
        console.log(`   ID: ${req.id}`)
        console.log(`   Status: ${req.status}`)
        console.log(`   Created: ${req.created_at}`)
        console.log(`   Approved At: ${req.approved_at || 'Not approved'}`)
        console.log(`   Rejection Reason: ${req.rejection_reason || 'None'}`)
        console.log("   ---")
      })

      // Find requests that were rejected immediately (within 1 second) - these are likely auto-rejected
      const autoRejected = allRequests.filter(req => {
        if (req.status !== 'rejected' || !req.approved_at) return false
        const createdTime = new Date(req.created_at).getTime()
        const approvedTime = new Date(req.approved_at).getTime()
        const timeDiff = approvedTime - createdTime
        return timeDiff < 1000 // Less than 1 second = likely auto-rejected
      })

      if (autoRejected.length > 0) {
        console.log(`\n[v0] Found ${autoRejected.length} possibly auto-rejected requests (rejected within 1 second)`)
        console.log("[v0] These should be reset to 'pending' for proper manager review")
        
        // Reset them to pending
        const { error: resetError } = await supabase
          .from("pending_offpremises_checkins")
          .update({
            status: "pending",
            approved_by_id: null,
            approved_at: null,
            rejection_reason: null,
          })
          .in("id", autoRejected.map(r => r.id))

        if (resetError) {
          console.error("[v0] Error resetting requests:", resetError)
        } else {
          console.log("[v0] Successfully reset auto-rejected requests to pending status")
        }
      }
    }

  } catch (error) {
    console.error("[v0] Error:", error)
  }
}

fixOffPremisesWorkflow()
