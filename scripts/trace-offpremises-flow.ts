import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function simulateAndTrace() {
  console.log('\n========== OFF-PREMISES CHECK-IN FLOW TRACE ==========\n');

  try {
    // Step 1: Get the current user (using admin client)
    console.log('Step 1: Getting authenticated user...');
    const { data: { users }, error: usersError } = await supabase.auth.admin.listUsers();
    
    if (usersError || !users || users.length === 0) {
      console.error('No users found:', usersError);
      return;
    }

    const testUser = users[0];
    console.log('Found user:', { id: testUser.id, email: testUser.email });

    // Step 2: Check user profile exists
    console.log('\nStep 2: Checking user profile...');
    const { data: userProfile, error: profileError } = await supabase
      .from('user_profiles')
      .select('id, first_name, last_name, email, role')
      .eq('id', testUser.id)
      .single();

    if (profileError) {
      console.error('User profile error:', profileError);
      return;
    }
    console.log('User profile found:', userProfile);

    // Step 3: Check what's currently in pending_offpremises_checkins
    console.log('\nStep 3: Checking current pending requests...');
    const { data: currentPending, error: pendingError } = await supabase
      .from('pending_offpremises_checkins')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(10);

    if (pendingError) {
      console.error('Error fetching pending requests:', pendingError);
    } else {
      console.log('Current pending requests count:', currentPending?.length || 0);
      if (currentPending && currentPending.length > 0) {
        console.log('Latest request:', {
          id: currentPending[0].id,
          user_id: currentPending[0].user_id,
          status: currentPending[0].status,
          created_at: currentPending[0].created_at,
          location: currentPending[0].current_location_name
        });
      }
    }

    // Step 4: Simulate inserting a test request
    console.log('\nStep 4: Simulating insertion of test request...');
    const testRequest = {
      user_id: testUser.id,
      current_location_name: 'Test Location - Debug',
      latitude: 5.123456,
      longitude: -0.987654,
      accuracy: 15,
      device_info: { browser: 'Test', os: 'Debug' },
      status: 'pending'
    };

    console.log('Attempting to insert:', testRequest);

    const { data: insertedData, error: insertError } = await supabase
      .from('pending_offpremises_checkins')
      .insert([testRequest])
      .select();

    if (insertError) {
      console.error('INSERT FAILED:', insertError);
      console.error('Error details:', {
        code: insertError.code,
        message: insertError.message,
        details: insertError.details
      });
    } else {
      console.log('INSERT SUCCESS:', insertedData);
    }

    // Step 5: Verify insertion worked
    console.log('\nStep 5: Verifying insertion...');
    const { data: verifyData, error: verifyError } = await supabase
      .from('pending_offpremises_checkins')
      .select('*')
      .eq('user_id', testUser.id)
      .order('created_at', { ascending: false })
      .limit(1);

    if (verifyError) {
      console.error('Error verifying:', verifyError);
    } else {
      console.log('Records found for this user:', verifyData?.length || 0);
      if (verifyData && verifyData.length > 0) {
        console.log('Latest record:', {
          id: verifyData[0].id,
          user_id: verifyData[0].user_id,
          status: verifyData[0].status,
          created_at: verifyData[0].created_at,
          location: verifyData[0].current_location_name
        });
      }
    }

    // Step 6: Check if API would return these records
    console.log('\nStep 6: Checking what API /pending would return...');
    const { data: apiData, error: apiError } = await supabase
      .from('pending_offpremises_checkins')
      .select(`
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
          employee_id,
          department_id,
          position,
          assigned_location_id
        )
      `)
      .eq('status', 'pending')
      .order('created_at', { ascending: false });

    if (apiError) {
      console.error('API Query error:', apiError);
    } else {
      console.log('API would return:', apiData?.length || 0, 'pending requests');
      if (apiData && apiData.length > 0) {
        console.log('Sample:', {
          id: apiData[0].id,
          user_id: apiData[0].user_id,
          location: apiData[0].current_location_name,
          staff_name: apiData[0].user_profiles?.first_name + ' ' + apiData[0].user_profiles?.last_name
        });
      }
    }

  } catch (error) {
    console.error('Trace error:', error);
  }

  console.log('\n========== END OF TRACE ==========\n');
}

simulateAndTrace();
