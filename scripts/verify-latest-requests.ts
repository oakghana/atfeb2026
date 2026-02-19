import { createClient } from '@supabase/supabase-js';

async function verifyLatestRequests() {
  console.log("[v0] Verifying latest off-premises requests...");

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    console.error("[v0] Missing Supabase credentials");
    return;
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    // Get ALL requests from the database ordered by created_at DESC (newest first)
    console.log("\n[v0] Fetching ALL requests from pending_offpremises_checkins (newest first)...");
    const { data: allRequests, error: allError } = await supabase
      .from('pending_offpremises_checkins')
      .select('id, user_id, status, created_at, current_location_name')
      .order('created_at', { ascending: false });

    if (allError) {
      console.error("[v0] Error fetching all requests:", allError);
    } else {
      console.log(`[v0] Total requests in database: ${allRequests?.length || 0}`);
      console.log(`[v0] Total: ${allRequests?.length || 0} | Pending: ${allRequests?.filter((r) => r.status === 'pending').length || 0} | Approved: ${allRequests?.filter((r) => r.status === 'approved').length || 0} | Rejected: ${allRequests?.filter((r) => r.status === 'rejected').length || 0}`);
      
      if (allRequests && allRequests.length > 0) {
        console.log("\n[v0] Latest 5 requests:");
        allRequests.slice(0, 5).forEach((req, idx) => {
          const createdDate = new Date(req.created_at).toLocaleString();
          console.log(`[v0] ${idx + 1}. status='${req.status}' | created=${createdDate} | location=${req.current_location_name}`);
        });
      }
    }

  } catch (error) {
    console.error("[v0] Exception:", error);
  }
}

verifyLatestRequests();
