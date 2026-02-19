import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://vgtajtqxgczhjboatvol.supabase.co'
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZndGFqdHF4Z2N6aGpib2F0dm9sIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1Njk3NTI0OCwiZXhwIjoyMDcyNTUxMjQ4fQ.x3by0hGUAO3GQcPs1_sla6gdGY8QuxcYiGmSRdj4-yA'

const supabase = createClient(supabaseUrl, supabaseKey)

async function diagnose() {
  console.log("=== DIAGNOSIS: User Profiles ===")
  
  const { data: profiles, error: profilesError } = await supabase
    .from('user_profiles')
    .select('*')
    .limit(5)
  
  if (profilesError) {
    console.log("Error fetching user_profiles:", profilesError.message)
  } else {
    console.log("user_profiles count (sample):", profiles?.length)
    if (profiles?.length > 0) {
      console.log("Sample profile keys:", Object.keys(profiles[0]))
      console.log("Sample profile:", JSON.stringify(profiles[0], null, 2))
    }
  }

  const { count: totalProfiles, error: countErr } = await supabase
    .from('user_profiles')
    .select('*', { count: 'exact', head: true })
  
  console.log("Total user_profiles:", totalProfiles, countErr?.message || '')

  console.log("\n=== DIAGNOSIS: Off-Premises Check-in Requests ===")
  
  const { data: offpremises, error: offpremisesError } = await supabase
    .from('pending_offpremises_checkins')
    .select('*')
    .limit(5)
  
  if (offpremisesError) {
    console.log("Error fetching pending_offpremises_checkins:", offpremisesError.message)
  } else {
    console.log("pending_offpremises_checkins sample count:", offpremises?.length)
    if (offpremises?.length > 0) {
      console.log("Sample keys:", Object.keys(offpremises[0]))
      console.log("Sample record:", JSON.stringify(offpremises[0], null, 2))
    }
  }

  const { count: totalOffpremises, error: countErr2 } = await supabase
    .from('pending_offpremises_checkins')
    .select('*', { count: 'exact', head: true })
  
  console.log("Total pending_offpremises_checkins:", totalOffpremises, countErr2?.message || '')

  const twoDaysAgo = new Date()
  twoDaysAgo.setDate(twoDaysAgo.getDate() - 2)
  const twoDaysAgoISO = twoDaysAgo.toISOString()
  
  console.log("\n=== Last 2 days (since", twoDaysAgoISO, ") ===")
  
  const { data: recentRequests, error: recentError } = await supabase
    .from('pending_offpremises_checkins')
    .select('*')
    .gte('created_at', twoDaysAgoISO)
    .order('created_at', { ascending: false })
  
  if (recentError) {
    console.log("Error fetching recent requests:", recentError.message)
  } else {
    console.log("Off-premises requests in last 2 days:", recentRequests?.length)
    if (recentRequests?.length > 0) {
      for (const req of recentRequests) {
        console.log(`  - User: ${req.user_id}, Status: ${req.status}, Created: ${req.created_at}, Reason: ${req.reason || 'N/A'}`)
      }
    }
  }

  console.log("\n=== Attendance Records (off-premises, last 2 days) ===")
  const { data: attendanceOffpremises, error: attErr } = await supabase
    .from('attendance_records')
    .select('*')
    .eq('is_off_premises', true)
    .gte('created_at', twoDaysAgoISO)
    .order('created_at', { ascending: false })
  
  if (attErr) {
    console.log("Error:", attErr.message)
  } else {
    console.log("Off-premises attendance records in last 2 days:", attendanceOffpremises?.length)
    if (attendanceOffpremises?.length > 0) {
      for (const rec of attendanceOffpremises) {
        console.log(`  - User: ${rec.user_id}, Date: ${rec.date}, Status: ${rec.status}, Created: ${rec.created_at}`)
      }
    }
  }

  console.log("\n=== All Off-Premises Requests (all time, all statuses) ===")
  const { data: allRequests, error: allErr } = await supabase
    .from('pending_offpremises_checkins')
    .select('id, user_id, status, created_at, reason')
    .order('created_at', { ascending: false })
    .limit(20)
  
  if (allErr) {
    console.log("Error:", allErr.message)
  } else {
    console.log("Recent 20 off-premises requests:")
    for (const req of allRequests || []) {
      console.log(`  - ID: ${req.id}, User: ${req.user_id}, Status: ${req.status}, Created: ${req.created_at}`)
    }
  }

  console.log("\n=== Users Table Check ===")
  const { data: users, error: usersErr, count: usersCount } = await supabase
    .from('users')
    .select('id, full_name, email, role', { count: 'exact' })
    .limit(5)
  
  if (usersErr) {
    console.log("Error fetching users:", usersErr.message)
  } else {
    console.log("Total users:", usersCount)
    for (const u of users || []) {
      console.log(`  - ${u.full_name} (${u.email}), role: ${u.role}`)
    }
  }
}

diagnose().catch(console.error)
