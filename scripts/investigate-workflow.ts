import { createClient } from '@supabase/supabase-js';

async function investigateAuthAndFlow() {
  console.log("[v0] ========== INVESTIGATING OFF-PREMISES WORKFLOW ==========\n");

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    console.error("[v0] Missing Supabase credentials");
    return;
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  // Step 1: Check all auth users
  console.log("Step 1: Checking all authenticated users in the system...");
  const { data: allUsers, error: usersError } = await supabase.auth.admin.listUsers();
  
  if (usersError) {
    console.error("[v0] Error listing users:", usersError);
  } else {
    console.log(`[v0] Found ${allUsers?.users?.length || 0} users in auth system`);
    if (allUsers?.users && allUsers.users.length > 0) {
      allUsers.users.slice(0, 3).forEach(user => {
        console.log(`  - User: ${user.email} (ID: ${user.id})`);
      });
    }
  }

  // Step 2: Check user_profiles table
  console.log("\nStep 2: Checking user_profiles table...");
  const { data: profiles, error: profilesError } = await supabase
    .from('user_profiles')
    .select('*')
    .limit(3);

  if (profilesError) {
    console.error("[v0] Error reading profiles:", profilesError);
  } else {
    console.log(`[v0] Found ${profiles?.length || 0} user profiles`);
    profiles?.forEach(p => {
      console.log(`  - Profile: ${p.full_name} (user_id: ${p.user_id}, department: ${p.department})`);
    });
  }

  // Step 3: Check pending_offpremises_checkins table
  console.log("\nStep 3: Checking pending_offpremises_checkins table...");
  const { data: pending, error: pendingError } = await supabase
    .from('pending_offpremises_checkins')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(10);

  if (pendingError) {
    console.error("[v0] Error reading pending requests:", pendingError);
  } else {
    console.log(`[v0] Found ${pending?.length || 0} pending requests`);
    pending?.forEach((req, idx) => {
      console.log(`  ${idx + 1}. User: ${req.user_id}, Created: ${req.created_at}, Status: ${req.status}`);
    });
  }

  // Step 4: Check all_offpremises_checkins table
  console.log("\nStep 4: Checking all_offpremises_checkins table...");
  const { data: allOffpremises, error: allOffError } = await supabase
    .from('all_offpremises_checkins')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(10);

  if (allOffError) {
    console.error("[v0] Error reading all offpremises:", allOffError);
  } else {
    console.log(`[v0] Found ${allOffpremises?.length || 0} total records`);
    allOffpremises?.forEach((rec, idx) => {
      console.log(`  ${idx + 1}. User: ${rec.user_id}, Created: ${rec.created_at}, Status: ${rec.status}`);
    });
  }

  // Step 5: Try to fetch pending requests using the new API endpoint logic
  console.log("\nStep 5: Testing pending requests query (as the API would)...");
  const { data: apiPending, error: apiError } = await supabase
    .from('pending_offpremises_checkins')
    .select(`
      *,
      user_profiles!inner(full_name, email, department)
    `)
    .eq('status', 'pending')
    .order('created_at', { ascending: false });

  if (apiError) {
    console.error("[v0] API Query Error:", apiError);
  } else {
    console.log(`[v0] API would return ${apiPending?.length || 0} pending requests`);
    apiPending?.forEach((req, idx) => {
      console.log(`  ${idx + 1}. Name: ${req.user_profiles?.full_name}, Reason: ${req.reason}, Created: ${req.created_at}`);
    });
  }

  // Step 6: Check table schema/structure
  console.log("\nStep 6: Inspecting pending_offpremises_checkins table structure...");
  const { data: tableInfo } = await supabase
    .from('pending_offpremises_checkins')
    .select('*')
    .limit(1);

  if (tableInfo && tableInfo.length > 0) {
    console.log("[v0] Table columns:", Object.keys(tableInfo[0]));
  } else {
    console.log("[v0] No records to inspect structure");
  }

  console.log("\n========== END INVESTIGATION ==========");
}

investigateAuthAndFlow().catch(console.error);
