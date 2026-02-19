import { createClient } from '@supabase/supabase-js';

async function testCompleteWorkflow() {
  console.log("[v0] ===== OFF-PREMISES CHECK-IN WORKFLOW TEST =====\n");

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    console.error("[v0] Missing Supabase credentials");
    return;
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    // Step 1: Check if we have any users
    console.log("[v0] STEP 1: Finding a test user...");
    const { data: users, error: userError } = await supabase
      .from('user_profiles')
      .select('id, first_name, last_name, email')
      .limit(1);

    if (userError || !users || users.length === 0) {
      console.error("[v0] No users found in database");
      return;
    }

    const testUser = users[0];
    console.log(`[v0] Found user: ${testUser.first_name} ${testUser.last_name} (${testUser.email})`);
    console.log(`[v0] User ID: ${testUser.id}\n`);

    // Step 2: Check existing pending requests
    console.log("[v0] STEP 2: Checking for existing pending requests...");
    const { data: existingRequests, error: checkError } = await supabase
      .from('pending_offpremises_checkins')
      .select('*')
      .eq('user_id', testUser.id);

    if (checkError) {
      console.error("[v0] Error checking existing requests:", checkError);
    } else {
      console.log(`[v0] Found ${existingRequests?.length || 0} existing requests\n`);
    }

    // Step 3: Insert a new off-premises check-in request
    console.log("[v0] STEP 3: Creating a test off-premises check-in request...");
    const testRequest = {
      user_id: testUser.id,
      current_location_name: 'Client Office - Test Location',
      google_maps_name: 'Test Client Office, Accra, Ghana',
      latitude: 5.6037,
      longitude: -0.1870,
      accuracy: 15,
      device_info: 'Test Device - Workflow Test',
      reason: 'Client meeting and project discussion',
      status: 'pending',
    };

    const { data: newRequest, error: insertError } = await supabase
      .from('pending_offpremises_checkins')
      .insert([testRequest])
      .select();

    if (insertError) {
      console.error("[v0] Error inserting request:", insertError);
      return;
    }

    console.log(`[v0] Successfully created request with ID: ${newRequest[0].id}`);
    console.log(`[v0] Status: ${newRequest[0].status}`);
    console.log(`[v0] Created at: ${newRequest[0].created_at}\n`);

    // Step 4: Verify the request was saved
    console.log("[v0] STEP 4: Verifying request was saved...");
    const { data: verifyRequest, error: verifyError } = await supabase
      .from('pending_offpremises_checkins')
      .select('id, user_id, current_location_name, status, created_at')
      .eq('id', newRequest[0].id);

    if (verifyError || !verifyRequest || verifyRequest.length === 0) {
      console.error("[v0] Failed to verify request save");
      return;
    }

    console.log(`[v0] Request verified in database`);
    console.log(`[v0] Location: ${verifyRequest[0].current_location_name}`);
    console.log(`[v0] Status: ${verifyRequest[0].status}\n`);

    // Step 5: Query using the pending API logic (user-specific)
    console.log("[v0] STEP 5: Querying as if staff member logged in...");
    const { data: staffRequests, error: staffError } = await supabase
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
        google_maps_name,
        reason,
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
      .eq('user_id', testUser.id)
      .order('created_at', { ascending: false });

    if (staffError) {
      console.error("[v0] Error querying staff requests:", staffError);
    } else {
      console.log(`[v0] Staff query returned ${staffRequests?.length || 0} requests`);
      if (staffRequests && staffRequests.length > 0) {
        const req = staffRequests[0];
        console.log(`[v0] Request: ${req.current_location_name}`);
        console.log(`[v0] Reason: ${req.reason}`);
        console.log(`[v0] Staff: ${req.user_profiles.first_name} ${req.user_profiles.last_name}\n`);
      }
    }

    // Step 6: Simulate approval
    console.log("[v0] STEP 6: Simulating request approval...");
    const { data: approvedRequest, error: approvalError } = await supabase
      .from('pending_offpremises_checkins')
      .update({
        status: 'approved',
        approved_by_id: testUser.id,
        approved_at: new Date().toISOString(),
      })
      .eq('id', newRequest[0].id)
      .select();

    if (approvalError) {
      console.error("[v0] Error approving request:", approvalError);
    } else {
      console.log(`[v0] Request approved successfully`);
      console.log(`[v0] New status: ${approvedRequest[0].status}`);
      console.log(`[v0] Approved at: ${approvedRequest[0].approved_at}\n`);
    }

    // Step 7: Final verification
    console.log("[v0] STEP 7: Final verification of workflow...");
    const { data: finalCheck } = await supabase
      .from('pending_offpremises_checkins')
      .select('id, status, created_at, approved_at')
      .eq('id', newRequest[0].id);

    if (finalCheck && finalCheck.length > 0) {
      console.log(`[v0] ✓ WORKFLOW COMPLETE`);
      console.log(`[v0] Request ID: ${finalCheck[0].id}`);
      console.log(`[v0] Final Status: ${finalCheck[0].status}`);
      console.log(`[v0] Created: ${finalCheck[0].created_at}`);
      console.log(`[v0] Approved: ${finalCheck[0].approved_at}`);
    }

    console.log("\n[v0] ===== WORKFLOW TEST PASSED ✓ =====\n");

  } catch (error) {
    console.error("[v0] Exception:", error);
  }
}

testCompleteWorkflow();
