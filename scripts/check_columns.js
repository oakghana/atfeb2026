import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  'https://vgtajtqxgczhjboatvol.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZndGFqdHF4Z2N6aGpib2F0dm9sIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1Njk3NTI0OCwiZXhwIjoyMDcyNTUxMjQ4fQ.x3by0hGUAO3GQcPs1_sla6gdGY8QuxcYiGmSRdj4-yA'
)

async function main() {
  // 1. Get all pending_offpremises_checkins columns
  const { data: sampleRow } = await supabase
    .from('pending_offpremises_checkins')
    .select('*')
    .limit(1)
    .single()
  
  if (sampleRow) {
    console.log('pending_offpremises_checkins columns:', Object.keys(sampleRow).sort().join(', '))
  }

  // 2. Get ALL recent requests (last 7 days), ordered by created_at desc
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
  const { data: recentRequests, error } = await supabase
    .from('pending_offpremises_checkins')
    .select('id, user_id, status, created_at, current_location_name, google_maps_name')
    .gte('created_at', sevenDaysAgo)
    .order('created_at', { ascending: false })

  console.log('\n--- Recent off-premises requests (last 7 days) ---')
  if (error) {
    console.log('Error:', error.message)
  } else {
    console.log('Total:', recentRequests?.length || 0)
    recentRequests?.forEach(r => {
      console.log(`  [${r.status}] ${r.created_at} - user: ${r.user_id?.substring(0,8)}... - location: ${r.current_location_name}`)
    })
  }

  // 3. Count by status
  const { data: allRequests } = await supabase
    .from('pending_offpremises_checkins')
    .select('status')
  
  if (allRequests) {
    const counts = {}
    allRequests.forEach(r => { counts[r.status] = (counts[r.status] || 0) + 1 })
    console.log('\n--- All-time status counts ---')
    console.log(JSON.stringify(counts, null, 2))
    console.log('Total records:', allRequests.length)
  }

  // 4. Check the it-admin user's profile to understand manager chain
  const { data: itAdmins } = await supabase
    .from('user_profiles')
    .select('id, first_name, last_name, role, department_id, reports_to_id, assigned_location_id')
    .eq('role', 'it-admin')
  
  console.log('\n--- IT-Admin profiles ---')
  if (itAdmins) {
    itAdmins.forEach(u => {
      console.log(`  ${u.first_name} ${u.last_name} (${u.id.substring(0,8)}...)`)
      console.log(`    department_id: ${u.department_id}`)
      console.log(`    reports_to_id: ${u.reports_to_id}`)
      console.log(`    assigned_location_id: ${u.assigned_location_id}`)
    })
  }

  // 5. Check if there are any admin users who can be fallback approvers
  const { data: admins } = await supabase
    .from('user_profiles')
    .select('id, first_name, last_name, role, department_id')
    .in('role', ['admin', 'department_head', 'regional_manager'])
    .limit(10)
  
  console.log('\n--- Admin/Manager users (first 10) ---')
  if (admins) {
    admins.forEach(u => {
      console.log(`  [${u.role}] ${u.first_name} ${u.last_name} - dept: ${u.department_id}`)
    })
  }

  // 6. For the first it-admin, check if there's a department_head in their department
  if (itAdmins && itAdmins.length > 0) {
    const itAdmin = itAdmins[0]
    const { data: deptManagers } = await supabase
      .from('user_profiles')
      .select('id, first_name, last_name, role')
      .in('role', ['department_head', 'regional_manager'])
      .eq('department_id', itAdmin.department_id)
    
    console.log(`\n--- Managers in IT-Admin's department (${itAdmin.department_id}) ---`)
    console.log('Count:', deptManagers?.length || 0)
    deptManagers?.forEach(m => {
      console.log(`  [${m.role}] ${m.first_name} ${m.last_name}`)
    })
  }

  // 7. Check staff_notifications for recent off-premises notifications
  const { data: recentNotifs } = await supabase
    .from('staff_notifications')
    .select('id, type, title, created_at, is_read')
    .eq('type', 'offpremises_checkin_request')
    .order('created_at', { ascending: false })
    .limit(5)
  
  console.log('\n--- Recent off-premises notifications ---')
  console.log('Count:', recentNotifs?.length || 0)
  recentNotifs?.forEach(n => {
    console.log(`  ${n.created_at} - ${n.title} - read: ${n.is_read}`)
  })
}

main()
