import { createClient } from '@supabase/supabase-js';

async function testPendingAPI() {
  console.log("[v0] Testing pending API endpoint...");

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    console.error("[v0] Missing Supabase credentials");
    return;
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    // Test 1: Simple query without relationships
    console.log("\n[v0] TEST 1: Simple query without relationships");
    const { data: simple, error: simpleError } = await supabase
      .from('pending_offpremises_checkins')
      .select('id, user_id, current_location_name, status, created_at')
      .order('created_at', { ascending: false });

    if (simpleError) {
      console.error("[v0] Error:", simpleError);
    } else {
      console.log(`[v0] Found ${simple?.length || 0} requests`);
      if (simple && simple.length > 0) {
        console.log("[v0] First request:", {
          id: simple[0].id,
          user_id: simple[0].user_id,
          status: simple[0].status,
          created_at: simple[0].created_at,
        });
      }
    }

    // Test 2: Query with explicit relationship
    console.log("\n[v0] TEST 2: Query with explicit relationship");
    const { data: withRel, error: relError } = await supabase
      .from('pending_offpremises_checkins')
      .select(`
        id,
        user_id,
        current_location_name,
        status,
        created_at,
        user_profiles!pending_offpremises_checkins_user_id_fkey (
          id,
          first_name,
          last_name,
          email
        )
      `)
      .order('created_at', { ascending: false });

    if (relError) {
      console.error("[v0] Relationship error:", relError);
    } else {
      console.log(`[v0] Found ${withRel?.length || 0} requests with relationships`);
      if (withRel && withRel.length > 0) {
        console.log("[v0] First request with user:", JSON.stringify(withRel[0], null, 2));
      }
    }

    // Test 3: Count requests by status
    console.log("\n[v0] TEST 3: Requests by status");
    const { data: allReqs } = await supabase
      .from('pending_offpremises_checkins')
      .select('status, id');

    if (allReqs) {
      const pending = allReqs.filter(r => r.status === 'pending').length;
      const approved = allReqs.filter(r => r.status === 'approved').length;
      const rejected = allReqs.filter(r => r.status === 'rejected').length;
      console.log(`[v0] Pending: ${pending}, Approved: ${approved}, Rejected: ${rejected}`);
    }

    // Test 4: Find TODAY's requests
    console.log("\n[v0] TEST 4: Today's requests (2026-02-19)");
    const todayStart = '2026-02-19T00:00:00';
    const todayEnd = '2026-02-20T00:00:00';
    
    const { data: today } = await supabase
      .from('pending_offpremises_checkins')
      .select('id, user_id, status, created_at')
      .gte('created_at', todayStart)
      .lt('created_at', todayEnd);

    console.log(`[v0] Found ${today?.length || 0} requests today`);
    if (today && today.length > 0) {
      today.forEach((req, idx) => {
        console.log(`[v0] Request ${idx + 1}: user_id=${req.user_id}, status=${req.status}, created=${req.created_at}`);
      });
    }

  } catch (error) {
    console.error("[v0] Exception:", error);
  }
}

testPendingAPI();
