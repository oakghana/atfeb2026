import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://rtexohbxexspltrpvlhv.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ0ZXhvaGJ4ZXhzcGx0cnB2bGh2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Mzc0NTU2OTQsImV4cCI6MjA1MzAzMTY5NH0.k3Lnl-r3qL_I5qB79U08WQ3e6MvZKMNVwBd6FJJwC2c'

const supabase = createClient(supabaseUrl, supabaseKey)

async function main() {
  console.log('='.repeat(80))
  console.log('OFF-PREMISES CHECK-IN FLOW VERIFICATION')
  console.log('='.repeat(80))

  // 1. Get ALL pending_offpremises_checkins ordered by created_at
  console.log('\n1. CHECKING ALL OFF-PREMISES REQUESTS')
  const { data: allRequests, error: allError } = await supabase
    .from('pending_offpremises_checkins')
    .select('*')
    .order('created_at', { ascending: false })
  
  if (allError) {
    console.log('ERROR:', allError.message)
  } else {
    console.log(`Total records: ${allRequests?.length || 0}`)
    console.log('\nAll requests:')
    allRequests?.forEach((r, i) => {
      console.log(`\n[${i+1}] Request ID: ${r.id}`)
      console.log(`    Status: ${r.status}`)
      console.log(`    User ID: ${r.user_id?.substring(0,12)}...`)
      console.log(`    Created: ${r.created_at}`)
      console.log(`    Location: ${r.current_location_name || r.google_maps_name}`)
      if (r.approved_at) console.log(`    Approved: ${r.approved_at}`)
      if (r.rejection_reason) console.log(`    Rejected: ${r.rejection_reason}`)
    })
  }

  // 2. Get PENDING requests specifically
  console.log('\n\n2. PENDING REQUESTS ONLY')
  const { data: pendingRequests } = await supabase
    .from('pending_offpremises_checkins')
    .select(`
      *,
      user_profiles!pending_offpremises_checkins_user_id_fkey (
        first_name,
        last_name,
        email,
        role,
        department_id
      )
    `)
    .eq('status', 'pending')
    .order('created_at', { ascending: false })
  
  console.log(`Total pending: ${pendingRequests?.length || 0}`)
  if (pendingRequests && pendingRequests.length > 0) {
    pendingRequests.forEach((r, i) => {
      console.log(`\n[${i+1}] PENDING Request`)
      console.log(`    ID: ${r.id}`)
      console.log(`    User: ${r.user_profiles?.first_name} ${r.user_profiles?.last_name} (${r.user_profiles?.email})`)
      console.log(`    Role: ${r.user_profiles?.role}`)
      console.log(`    Created: ${r.created_at}`)
      console.log(`    Location: ${r.current_location_name}`)
      console.log(`    Coordinates: ${r.latitude}, ${r.longitude}`)
    })
  } else {
    console.log('No pending requests found.')
  }

  // 3. Check attendance_records to see if any off-premises check-ins exist
  console.log('\n\n3. CHECKING ATTENDANCE RECORDS (off-premises check-ins)')
  const { data: offpremisesAttendance } = await supabase
    .from('attendance_records')
    .select(`
      id,
      user_id,
      check_in_time,
      check_in_type,
      on_official_duty_outside_premises,
      actual_location_name,
      notes,
      created_at
    `)
    .eq('on_official_duty_outside_premises', true)
    .order('check_in_time', { ascending: false })
    .limit(10)
  
  console.log(`Total off-premises attendance records (last 10): ${offpremisesAttendance?.length || 0}`)
  offpremisesAttendance?.forEach((a, i) => {
    console.log(`\n[${i+1}] Attendance Record`)
    console.log(`    ID: ${a.id}`)
    console.log(`    User: ${a.user_id?.substring(0,12)}...`)
    console.log(`    Check-in time: ${a.check_in_time}`)
    console.log(`    Record created: ${a.created_at}`)
    console.log(`    Time difference: ${Math.round((new Date(a.created_at) - new Date(a.check_in_time)) / 1000)} seconds`)
    console.log(`    Location: ${a.actual_location_name}`)
    console.log(`    Type: ${a.check_in_type}`)
    console.log(`    Notes: ${a.notes}`)
  })

  // 4. Status breakdown
  console.log('\n\n4. STATUS BREAKDOWN')
  const statuses = {}
  allRequests?.forEach(r => {
    statuses[r.status] = (statuses[r.status] || 0) + 1
  })
  console.log(JSON.stringify(statuses, null, 2))

  console.log('\n' + '='.repeat(80))
  console.log('VERIFICATION COMPLETE')
  console.log('='.repeat(80))
}

main()
