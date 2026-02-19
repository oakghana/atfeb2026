import { createClient } from '@supabase/supabase-js';

async function diagnoseOffPremises() {
  console.log("[v0] Starting diagnosis of off-premises checkins...");

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    console.error("[v0] Missing Supabase credentials");
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    console.log("[v0] Fetching ALL records from pending_offpremises_checkins...");
    const response = await supabase
      .from('pending_offpremises_checkins')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50);

    const { data, error } = response;

    if (error) {
      console.error("[v0] Query error:", error);
    } else {
      console.log("[v0] Total records found:", data.length);
      
      if (data.length > 0) {
        console.log("\n[v0] Last 10 records:");
        data.slice(0, 10).forEach((req, idx) => {
          console.log(`Record ${idx + 1}:`);
          console.log(`  ID: ${req.id}`);
          console.log(`  User ID: ${req.user_id}`);
          console.log(`  Status: ${req.status}`);
          console.log(`  Location: ${req.current_location_name}`);
          console.log(`  Created: ${req.created_at}`);
        });
      } else {
        console.log("[v0] No records found in pending_offpremises_checkins table");
      }
    }

  } catch (err) {
    console.error("[v0] Exception:", err);
  }
}

diagnoseOffPremises();
