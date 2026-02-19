import { createClient } from '@supabase/supabase-js'

async function verifyOffPremisesRequests() {
  console.log('[v0] Starting verification of off-premises requests...\n')

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !supabaseKey) {
    console.error('[v0] ERROR: Missing Supabase credentials')
    process.exit(1)
  }

  const supabase = createClient(supabaseUrl, supabaseKey)

  try {
    // Get ALL off-premises requests
    console.log('[v0] Fetching all off-premises requests from database...')
    const { data: allRequests, error: fetchError } = await supabase
      .from('pending_offpremises_checkins')
      .select('id, user_id, status, created_at, current_location_name, google_maps_name')
      .order('created_at', { ascending: false })

    if (fetchError) {
      console.error('[v0] ERROR fetching requests:', fetchError.message)
      process.exit(1)
    }

    console.log(`\n[v0] ✅ Found ${allRequests?.length || 0} total requests in database\n`)

    if (!allRequests || allRequests.length === 0) {
      console.log('[v0] No requests found in pending_offpremises_checkins table')
      process.exit(0)
    }

    // Group by status
    const pending = allRequests.filter(r => r.status === 'pending')
    const approved = allRequests.filter(r => r.status === 'approved')
    const rejected = allRequests.filter(r => r.status === 'rejected')

    console.log('[v0] REQUEST SUMMARY:')
    console.log(`    Pending:  ${pending.length}`)
    console.log(`    Approved: ${approved.length}`)
    console.log(`    Rejected: ${rejected.length}\n`)

    console.log('[v0] LATEST 3 REQUESTS:')
    allRequests.slice(0, 3).forEach((req, idx) => {
      console.log(`\n    [${idx + 1}] ID: ${req.id.substring(0, 8)}...`)
      console.log(`        Status: ${req.status}`)
      console.log(`        Created: ${new Date(req.created_at).toLocaleString()}`)
      console.log(`        Location: ${req.current_location_name}`)
    })

    console.log('\n[v0] ✅ Verification complete!')
  } catch (error) {
    console.error('[v0] ERROR:', error instanceof Error ? error.message : String(error))
    process.exit(1)
  }
}

verifyOffPremisesRequests()
