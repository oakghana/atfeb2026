import { createClient } from '@supabase/supabase-js';

async function checkAllRequests() {
  console.log("[v0] Checking ALL off-premises requests in database (no time filter)...");

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    console.error("[v0] Missing Supabase credentials");
    return;
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    // Get ALL requests ever created
    const { data: allRequests, error } = await supabase
      .from('pending_offpremises_checkins')
      .select('id, user_id, status, created_at, current_location_name, google_maps_name')
      .order('created_at', { ascending: false });

    if (error) {
      console.error("[v0] Error fetching requests:", error);
      return;
    }

    console.log(`\n[v0] Total requests in database: ${allRequests?.length || 0}`);
    
    if (allRequests && allRequests.length > 0) {
      console.log("\n[v0] All requests (newest first):");
      allRequests.forEach((req, idx) => {
        console.log(`\n[v0] Request ${idx + 1}:`);
        console.log(`     ID: ${req.id}`);
        console.log(`     Status: ${req.status}`);
        console.log(`     Created: ${req.created_at}`);
        console.log(`     Location: ${req.current_location_name}`);
      });

      // Count by status
      const pending = allRequests.filter(r => r.status === 'pending').length;
      const approved = allRequests.filter(r => r.status === 'approved').length;
      const rejected = allRequests.filter(r => r.status === 'rejected').length;
      
      console.log(`\n[v0] Summary: Pending=${pending}, Approved=${approved}, Rejected=${rejected}`);
    }

  } catch (error) {
    console.error("[v0] Exception:", error);
  }
}

checkAllRequests();
