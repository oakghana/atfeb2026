import { createClient } from '@supabase/supabase-js';

async function checkRecentSubmissions() {
  console.log("[v0] Checking recent off-premises submissions...");

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    console.error("[v0] Missing Supabase credentials");
    return;
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    // Get the latest 10 requests from the last hour
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    
    console.log("\n[v0] Fetching all pending requests created in the last hour...");
    const { data: pendingRequests, error: pendingError } = await supabase
      .from('pending_offpremises_checkins')
      .select('id, user_id, status, created_at, current_location_name, google_maps_name')
      .gte('created_at', oneHourAgo)
      .order('created_at', { ascending: false });

    if (pendingError) {
      console.error("[v0] Error fetching pending requests:", pendingError);
    } else {
      console.log(`[v0] Total requests in last hour: ${pendingRequests?.length || 0}`);
      if (pendingRequests && pendingRequests.length > 0) {
        console.log("\n[v0] Recent submissions:");
        pendingRequests.forEach((req, idx) => {
          console.log(`\n[v0] Request ${idx + 1}:`);
          console.log(`     ID: ${req.id}`);
          console.log(`     Status: ${req.status}`);
          console.log(`     User ID: ${req.user_id}`);
          console.log(`     Location: ${req.current_location_name}`);
          console.log(`     Google Maps Name: ${req.google_maps_name || 'N/A'}`);
          console.log(`     Created: ${req.created_at}`);
        });
      } else {
        console.log("[v0] No pending requests found in the last hour");
      }
    }

    // Get status breakdown
    console.log("\n[v0] Status breakdown for all requests:");
    const { data: allRequests } = await supabase
      .from('pending_offpremises_checkins')
      .select('status, created_at');

    if (allRequests) {
      const pending = allRequests.filter(r => r.status === 'pending').length;
      const approved = allRequests.filter(r => r.status === 'approved').length;
      const rejected = allRequests.filter(r => r.status === 'rejected').length;
      console.log(`[v0] Total Pending: ${pending}, Approved: ${approved}, Rejected: ${rejected}`);
    }

  } catch (error) {
    console.error("[v0] Exception:", error);
  }
}

checkRecentSubmissions();
