import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("[v0] Missing Supabase credentials");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkTodayRequests() {
  console.log("[v0] Checking for TODAY's off-premises checkin requests (2/19/2026)...\n");

  // Today's date range
  const today = new Date('2026-02-19T00:00:00Z');
  const todayEnd = new Date('2026-02-19T23:59:59Z');

  console.log("[v0] Query date range:", today.toISOString(), "to", todayEnd.toISOString());

  // Query today's records
  const { data, error } = await supabase
    .from('pending_offpremises_checkins')
    .select('*')
    .gte('created_at', today.toISOString())
    .lte('created_at', todayEnd.toISOString())
    .order('created_at', { ascending: false });

  if (error) {
    console.error("[v0] Error querying today's records:", error);
    return;
  }

  console.log("[v0] TODAY'S REQUESTS FOUND:", data?.length || 0);
  
  if (data && data.length > 0) {
    data.forEach((record, index) => {
      console.log(`\nRecord ${index + 1}:`);
      console.log("  ID:", record.id);
      console.log("  User ID:", record.user_id);
      console.log("  Status:", record.status);
      console.log("  Location:", record.location);
      console.log("  Reason:", record.reason);
      console.log("  Created:", record.created_at);
    });
  } else {
    console.log("[v0] No requests found for today.");
    console.log("[v0] Let me check ALL records to see the latest ones:\n");
    
    // Get all records
    const { data: allData } = await supabase
      .from('pending_offpremises_checkins')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(5);

    if (allData && allData.length > 0) {
      console.log("[v0] Latest 5 records in database:");
      allData.forEach((record, index) => {
        console.log(`\nLatest Record ${index + 1}:`);
        console.log("  ID:", record.id);
        console.log("  User ID:", record.user_id);
        console.log("  Status:", record.status);
        console.log("  Location:", record.location);
        console.log("  Created:", record.created_at);
      });
    }
  }
}

checkTodayRequests().catch(err => {
  console.error("[v0] Fatal error:", err);
  process.exit(1);
});
