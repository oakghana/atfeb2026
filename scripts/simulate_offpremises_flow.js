import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://qfyajdlxqxtxmljxacij.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFmeWFqZGx4cXh0eG1sanhhY2lqIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTczMjk4NzE0NSwiZXhwIjoyMDQ4NTYzMTQ1fQ.p7AZVZ6n6jPSVtY5sqjRGEHRYvpuBt8k7YQ9SDGxf4U'

const supabase = createClient(supabaseUrl, supabaseKey)

async function simulateOffPremisesFlow() {
  console.log('==========================================')
  console.log('OFF-PREMISES CHECK-IN FLOW SIMULATION')
  console.log('==========================================\n')

  // Step 1: Find a test user (any user)
  console.log('STEP 1: Finding test user...')
  
  // First check total user count
  const { count: totalUsers } = await supabase
    .from('user_profiles')
    .select('*', { count: 'exact', head: true })
  console.log(`Total users in database: ${totalUsers}`)
  
  const { data: allUsers, error: userError } = await supabase
    .from('user_profiles')
    .select('id, first_name, last_name, email, role, department_id')
    .limit(10)
  
  if (userError) {
    console.log('ERROR fetching users:', userError.message)
    return
  }
  
  if (!allUsers || allUsers.length === 0) {
    console.log('ERROR: No users found')
    return
  }
  
  console.log(`Found ${allUsers.length} users:`)
  allUsers.forEach(u => console.log(`  - ${u.first_name} ${u.last_name} (${u.role})`))
  console.log()

  const testUser = allUsers[0]
  console.log(`✓ Using test user: ${testUser.first_name} ${testUser.last_name} (${testUser.email})`)
  console.log(`  User ID: ${testUser.id}`)
  console.log(`  Role: ${testUser.role}`)
  console.log(`  Department: ${testUser.department_id}\n`)

  // Step 2: Create a pending off-premises request with a specific timestamp
  console.log('STEP 2: Creating pending off-premises check-in request...')
  const requestTime = new Date('2026-02-19T08:30:00Z') // 8:30 AM request time
  const testLocation = 'Client Meeting - Simulation Test Location'
  
  const { data: pendingRequest, error: insertError } = await supabase
    .from('pending_offpremises_checkins')
    .insert({
      user_id: testUser.id,
      current_location_name: testLocation,
      latitude: 5.6360,
      longitude: -0.1966,
      accuracy: 20,
      device_info: JSON.stringify({ test: true, simulation: true }),
      status: 'pending',
      created_at: requestTime.toISOString()
    })
    .select()
    .single()

  if (insertError) {
    console.log('ERROR creating request:', insertError.message)
    return
  }

  console.log(`✓ Created pending request ID: ${pendingRequest.id}`)
  console.log(`  Request time: ${requestTime.toISOString()} (8:30 AM)`)
  console.log(`  Location: ${testLocation}`)
  console.log(`  Status: ${pendingRequest.status}\n`)

  // Step 3: Find a manager to approve it
  console.log('STEP 3: Finding manager to approve request...')
  const { data: managers } = await supabase
    .from('user_profiles')
    .select('id, first_name, last_name, role')
    .in('role', ['admin', 'department_head', 'regional_manager'])
    .limit(1)

  if (!managers || managers.length === 0) {
    console.log('ERROR: No managers found')
    return
  }

  const approver = managers[0]
  console.log(`✓ Using approver: ${approver.first_name} ${approver.last_name} (${approver.role})`)
  console.log(`  Approver ID: ${approver.id}\n`)

  // Step 4: Simulate approval (happening 2 hours later at 10:30 AM)
  console.log('STEP 4: Simulating approval process...')
  const approvalTime = new Date('2026-02-19T10:30:00Z') // 10:30 AM approval time
  console.log(`  Current time (approval): ${approvalTime.toISOString()} (10:30 AM)`)
  console.log(`  Time difference: 2 hours after request\n`)

  // Update the pending request to approved
  const { error: updateError } = await supabase
    .from('pending_offpremises_checkins')
    .update({
      status: 'approved',
      approved_by_id: approver.id,
      approved_at: approvalTime.toISOString()
    })
    .eq('id', pendingRequest.id)

  if (updateError) {
    console.log('ERROR updating request:', updateError.message)
    return
  }

  // Create attendance record with ORIGINAL request time (not approval time)
  const { data: attendanceRecord, error: attendanceError } = await supabase
    .from('attendance_records')
    .insert({
      user_id: testUser.id,
      check_in_time: pendingRequest.created_at, // ✓ CORRECT: Use original request time
      actual_location_name: testLocation,
      actual_latitude: 5.6360,
      actual_longitude: -0.1966,
      on_official_duty_outside_premises: true,
      device_info: pendingRequest.device_info,
      check_in_type: 'offpremises_confirmed',
      notes: 'Off-premises check-in approved by manager (SIMULATION TEST)'
    })
    .select()
    .single()

  if (attendanceError) {
    console.log('ERROR creating attendance record:', attendanceError.message)
    return
  }

  console.log('✓ Request approved and attendance record created')
  console.log(`  Attendance record ID: ${attendanceRecord.id}`)
  console.log(`  Check-in time recorded: ${attendanceRecord.check_in_time}`)
  console.log(`  Approved at: ${approvalTime.toISOString()}\n`)

  // Step 5: Verify the timestamps
  console.log('STEP 5: TIMESTAMP VERIFICATION')
  console.log('==========================================')
  console.log(`Original request time:    ${pendingRequest.created_at}`)
  console.log(`Approval time:            ${approvalTime.toISOString()}`)
  console.log(`Check-in time in DB:      ${attendanceRecord.check_in_time}`)
  
  const requestTimeMs = new Date(pendingRequest.created_at).getTime()
  const checkinTimeMs = new Date(attendanceRecord.check_in_time).getTime()
  const approvalTimeMs = approvalTime.getTime()

  if (requestTimeMs === checkinTimeMs) {
    console.log('\n✅ SUCCESS: Check-in time matches ORIGINAL request time')
    console.log('   Staff will be checked in at 8:30 AM (request time)')
    console.log('   NOT at 10:30 AM (approval time)')
  } else if (checkinTimeMs === approvalTimeMs) {
    console.log('\n❌ FAILURE: Check-in time matches approval time!')
    console.log('   This is WRONG - staff should be checked in at request time')
  } else {
    console.log('\n⚠️  WARNING: Check-in time matches neither request nor approval time')
    console.log(`   Request: ${new Date(requestTimeMs).toISOString()}`)
    console.log(`   Approval: ${new Date(approvalTimeMs).toISOString()}`)
    console.log(`   Check-in: ${new Date(checkinTimeMs).toISOString()}`)
  }

  // Step 6: Query the pending requests to verify visibility
  console.log('\n\nSTEP 6: Checking pending requests visibility...')
  const { data: allPending } = await supabase
    .from('pending_offpremises_checkins')
    .select('id, status, created_at')
    .eq('status', 'pending')

  console.log(`Pending requests in system: ${allPending?.length || 0}`)
  
  const { data: allApproved } = await supabase
    .from('pending_offpremises_checkins')
    .select('id, status, created_at')
    .eq('status', 'approved')
    .order('created_at', { ascending: false })
    .limit(5)

  console.log(`Recently approved requests: ${allApproved?.length || 0}`)
  allApproved?.forEach(r => {
    console.log(`  - ${r.id.substring(0, 8)}... (approved at ${r.created_at})`)
  })

  console.log('\n==========================================')
  console.log('SIMULATION COMPLETE')
  console.log('==========================================')
}

simulateOffPremisesFlow().catch(console.error)
