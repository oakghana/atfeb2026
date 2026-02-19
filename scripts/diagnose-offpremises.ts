import { createClient } from '@supabase/supabase-js';

async function diagnoseOffPremisesRequests() {
  console.log("[v0] Diagnosing off-premises requests storage...");

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    console.error("[v0] Missing Supabase credentials");
    return;
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    // Get ALL pending requests regardless of date
    console.log("[v0] Fetching ALL pending_offpremises_checkins records (no date filter)...");
    const { data: allRequests, error: allError } = await supabase
      .from('pending_offpremises_checkins')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(20);

    if (allError) {
      console.error("[v0] Error fetching all requests:", allError);
    } else {
      console.log("[v0] Total pending requests in table:", allRequests?.length || 0);
      if (allRequests && allRequests.length > 0) {
        console.log("[v0] Recent requests:");
        allRequests.forEach((req, idx) => {
          console.log(`  [${idx}] ID: ${req.id}, User: ${req.user_id}, Status: ${req.status}, Created: ${req.created_at}, Location: ${req.current_location_name}`);
        });
      }
    }

    // Get today's count specifically
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);

    console.log(`\n[v0] Checking for requests between ${today.toISOString()} and ${todayEnd.toISOString()}`);
    
    const { data: todayRequests, error: todayError, count } = await supabase
      .from('pending_offpremises_checkins')
      .select('*', { count: 'exact' })
      .gte('created_at', today.toISOString())
      .lte('created_at', todayEnd.toISOString());

    if (todayError) {
      console.error("[v0] Error fetching today's requests:", todayError);
    } else {
      console.log(`[v0] Today's requests count: ${count}`);
      if (todayRequests && todayRequests.length > 0) {
        console.log("[v0] Today's requests:");
        todayRequests.forEach((req, idx) => {
          console.log(`  [${idx}] ID: ${req.id}, User: ${req.user_id}, Location: ${req.current_location_name}, Created: ${req.created_at}`);
        });
      }
    }

  } catch (error) {
    console.error("[v0] Error:", error.message);
  }
}

diagnoseOffPremisesRequests();
