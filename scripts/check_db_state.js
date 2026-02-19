import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

const supabase = createClient(supabaseUrl, supabaseAnonKey)

async function main() {
  console.log('\n=== CHECKING DATABASE STATE ===\n')

  // 1. Check all off-premises requests
  const { data: allRequests, error: reqError } = await supabase
    .from('pending_offpremises_checkins')
    .select('*')
    .order('created_at', { ascending: false })

  console.log('Total off-premises requests:', allRequests?.length || 0)
  if (reqError) console.log('Error:', reqError.message)
  
  if (allRequests && allRequests.length > 0) {
    console.log('\nRecent requests:')
    allRequests.slice(0, 5).forEach(req => {
      console.log(`  [${req.status}] ${req.created_at} - user: ${req.user_id.substring(0, 8)}...`)
    })
    
    // Count by status
    const statusCounts = {}
    allRequests.forEach(r => {
      statusCounts[r.status] = (statusCounts[r.status] || 0) + 1
    })
    console.log('\nStatus counts:', statusCounts)
  }

  // 2. Check for active managers
  const { data: managers, error: mgError } = await supabase
    .from('user_profiles')
    .select('id, first_name, last_name, email, role, is_active')
    .in('role', ['admin', 'regional_manager', 'department_head'])

  console.log('\n=== MANAGERS IN SYSTEM ===')
  console.log('Total managers:', managers?.length || 0)
  if (mgError) console.log('Error:', mgError.message)
  
  if (managers) {
    const activeCount = managers.filter(m => m.is_active).length
    console.log('Active managers:', activeCount)
    console.log('\nManagers by role:')
    const roleCounts = {}
    managers.forEach(m => {
      const key = `${m.role} (${m.is_active ? 'active' : 'inactive'})`
      roleCounts[key] = (roleCounts[key] || 0) + 1
    })
    Object.entries(roleCounts).forEach(([role, count]) => {
      console.log(`  ${role}: ${count}`)
    })
  }

  // 3. Check if there are any IT admin users (they were submitting requests)
  const { data: itAdmins } = await supabase
    .from('user_profiles')
    .select('id, first_name, last_name, role, is_active')
    .eq('role', 'it-admin')

  console.log('\n=== IT ADMIN USERS ===')
  console.log('Total IT admins:', itAdmins?.length || 0)
  if (itAdmins && itAdmins.length > 0) {
    itAdmins.forEach(u => {
      console.log(`  ${u.first_name} ${u.last_name} - active: ${u.is_active}`)
    })
  }
}

main()
