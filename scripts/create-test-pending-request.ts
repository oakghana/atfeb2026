import { createClient } from '@supabase/supabase-js';

async function createTestPendingRequest() {
  console.log("[v0] Creating a test pending request...");

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    console.error("[v0] Missing Supabase credentials");
    return;
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    // Get a test user (use the last user id from your system)
    const { data: users } = await supabase
      .from('user_profiles')
      .select('id, first_name')
      .eq('is_active', true)
      .limit(1);

    if (!users || users.length === 0) {
      console.error("[v0] No active users found");
      return;
    }

    const testUserId = users[0].id;
    console.log(`[v0] Using test user: ${users[0].first_name} (${testUserId})`);

    // Create a request with status='pending'
    const { data: newRequest, error } = await supabase
      .from('pending_offpremises_checkins')
      .insert({
        user_id: testUserId,
        current_location_name: 'Test Pending Request - Should appear in pending tab',
        latitude: 5.7414,
        longitude: -0.3061,
        accuracy: 15,
        device_info: 'Browser',
        status: 'pending',
        google_maps_name: 'Nsawam Archive Center',
      })
      .select()
      .single();

    if (error) {
      console.error("[v0] Error creating test request:", error);
    } else {
      console.log("[v0] Test pending request created successfully:");
      console.log(`[v0]   ID: ${newRequest.id}`);
      console.log(`[v0]   Status: ${newRequest.status}`);
      console.log(`[v0]   Created: ${newRequest.created_at}`);
      
      // Verify it's actually pending
      const { data: verify } = await supabase
        .from('pending_offpremises_checkins')
        .select('id, status')
        .eq('id', newRequest.id)
        .single();
      
      console.log(`[v0] Verification - Status in DB: ${verify?.status}`);
    }

  } catch (error) {
    console.error("[v0] Exception:", error);
  }
}

createTestPendingRequest();
