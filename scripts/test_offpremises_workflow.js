// Comprehensive Off-Premises Workflow Test
// Tests: Request submission, pending approvals, approved reviews, and role-based access

import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

async function testOffPremisesWorkflow() {
  console.log('========== OFF-PREMISES WORKFLOW TEST ==========\n')

  try {
    // 1. Check pending requests (all statuses)
    console.log('1. CHECKING PENDING REQUESTS TABLE')
    const { data: pendingRequests, error: pendingError, count: pendingCount } = await supabase
      .from('pending_offpremises_checkins')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .limit(10)

    if (pendingError) {
      console.error('Error fetching pending requests:', pendingError.message)
    } else {
      console.log(`Found ${pendingCount} total pending requests`)
      if (pendingRequests && pendingRequests.length > 0) {
        console.log('Recent requests:')
        pendingRequests.forEach((req, i) => {
          console.log(`  ${i + 1}. ID: ${req.id}`)
          console.log(`     User: ${req.user_id}`)
          console.log(`     Status: ${req.status}`)
          console.log(`     Location: ${req.current_location_name}`)
          console.log(`     Reason: ${req.reason?.substring(0, 50)}...`)
          console.log(`     Created: ${req.created_at}`)
          console.log('')
        })
      }
    }

    // 2. Check by status breakdown
    console.log('\n2. STATUS BREAKDOWN')
    const statuses = ['pending', 'approved', 'rejected']
    for (const status of statuses) {
      const { count } = await supabase
        .from('pending_offpremises_checkins')
        .select('id', { count: 'exact' })
        .eq('status', status)
      console.log(`  ${status}: ${count} requests`)
    }

    // 3. Check user profiles and departments
    console.log('\n3. CHECKING USER PROFILES')
    const { data: profiles, error: profileError } = await supabase
      .from('user_profiles')
      .select('id, first_name, last_name, role, department_id')
      .in('role', ['admin', 'department_head', 'regional_manager'])
      .limit(5)

    if (profileError) {
      console.error('Error fetching profiles:', profileError.message)
    } else {
      console.log(`Found ${profiles?.length || 0} managers:`)
      profiles?.forEach((p, i) => {
        console.log(`  ${i + 1}. ${p.first_name} ${p.last_name} - ${p.role} (Dept: ${p.department_id})`)
      })
    }

    // 4. Test role-based filtering
    console.log('\n4. ROLE-BASED FILTERING TEST')
    
    if (profiles && profiles.length > 0) {
      // Test admin access
      const adminProfiles = profiles.filter(p => p.role === 'admin')
      if (adminProfiles.length > 0) {
        console.log(`  Admin should see: ALL requests`)
        const { count: adminCount } = await supabase
          .from('pending_offpremises_checkins')
          .select('id', { count: 'exact' })
          .eq('status', 'pending')
        console.log(`    → Found ${adminCount} pending requests for admin`)
      }

      // Test department head access
      const deptHeads = profiles.filter(p => p.role === 'department_head')
      if (deptHeads.length > 0) {
        deptHeads.slice(0, 2).forEach(async (deptHead) => {
          console.log(`  Department Head (${deptHead.first_name} - Dept ${deptHead.department_id}):`)
          
          // Get staff in their department
          const { data: deptStaff } = await supabase
            .from('user_profiles')
            .select('id')
            .eq('department_id', deptHead.department_id)
          
          const staffIds = deptStaff?.map(s => s.id) || []
          
          if (staffIds.length > 0) {
            const { count: deptCount } = await supabase
              .from('pending_offpremises_checkins')
              .select('id', { count: 'exact' })
              .eq('status', 'pending')
              .in('user_id', staffIds)
            console.log(`    → Found ${deptCount} pending requests from their department staff`)
          }
        })
      }
    }

    // 5. Check if requests are properly saved with all fields
    console.log('\n5. REQUEST DATA VALIDATION')
    const { data: latestRequest } = await supabase
      .from('pending_offpremises_checkins')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    if (latestRequest) {
      console.log('Latest request fields:')
      console.log(`  ID: ${latestRequest.id}`)
      console.log(`  User ID: ${latestRequest.user_id}`)
      console.log(`  Status: ${latestRequest.status}`)
      console.log(`  Location Name: ${latestRequest.current_location_name}`)
      console.log(`  Latitude: ${latestRequest.latitude}`)
      console.log(`  Longitude: ${latestRequest.longitude}`)
      console.log(`  Reason: ${latestRequest.reason}`)
      console.log(`  Device Info: ${latestRequest.device_info}`)
      console.log(`  Created At: ${latestRequest.created_at}`)
      console.log(`  Approved At: ${latestRequest.approved_at}`)
      console.log(`  Approved By: ${latestRequest.approved_by_id}`)
    }

    // 6. Test API endpoints
    console.log('\n6. API ENDPOINT TESTS')
    console.log('  Note: These would be tested in the browser environment')
    console.log('  Pending API: GET /api/attendance/offpremises/pending')
    console.log('  Approved API: GET /api/attendance/offpremises/approved')
    console.log('  Approve API: POST /api/attendance/offpremises/approve')

    console.log('\n========== TEST COMPLETE ==========\n')
  } catch (error) {
    console.error('Test failed:', error)
  }
}

testOffPremisesWorkflow()
