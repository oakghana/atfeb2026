import { createClient } from '@supabase/supabase-js';

async function checkPendingStatus() {
  console.log("[v0] Checking pending off-premises requests in database...");

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    console.error("[v0] Missing Supabase credentials");
    return;
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    // Get ALL requests from the database
    console.log("\n[v0] Fetching ALL requests from pending_offpremises_checkins...");
    const { data: allRequests, error: allError } = await supabase
      .from('pending_offpremises_checkins')
      .select('id, user_id, status, created_at, current_location_name');

    if (allError) {
      console.error("[v0] Error fetching all requests:", allError);
    } else {
      console.log(`[v0] Total requests in database: ${allRequests?.length || 0}`);
      if (allRequests && allRequests.length > 0) {
        allRequests.forEach((req, idx) => {
          console.log(`[v0] Request ${idx + 1}: status='${req.status}', user_id=${req.user_id}, created=${req.created_at}`);
        });
      }
    }

    // Get only PENDING requests
    console.log("\n[v0] Fetching PENDING requests only...");
    const { data: pendingRequests, error: pendingError } = await supabase
      .from('pending_offpremises_checkins')
      .select('id, user_id, status, created_at, current_location_name')
      .eq('status', 'pending');

    if (pendingError) {
      console.error("[v0] Error fetching pending requests:", pendingError);
    } else {
      console.log(`[v0] Pending requests in database: ${pendingRequests?.length || 0}`);
      if (pendingRequests && pendingRequests.length > 0) {
        pendingRequests.forEach((req, idx) => {
          console.log(`[v0] Pending ${idx + 1}: user_id=${req.user_id}, created=${req.created_at}, location=${req.current_location_name}`);
        });
      }
    }

    // Get requests by status breakdown
    console.log("\n[v0] Breakdown by status:");
    const { data: statusBreakdown } = await supabase
      .from('pending_offpremises_checkins')
      .select('status');

    if (statusBreakdown) {
      const pending = statusBreakdown.filter(r => r.status === 'pending').length;
      const approved = statusBreakdown.filter(r => r.status === 'approved').length;
      const rejected = statusBreakdown.filter(r => r.status === 'rejected').length;
      console.log(`[v0] Pending: ${pending}, Approved: ${approved}, Rejected: ${rejected}`);
    }

  } catch (error) {
    console.error("[v0] Exception:", error);
  }
}

checkPendingStatus();
