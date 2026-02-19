import { createClient } from '@supabase/supabase-js';

async function checkLatestRequest() {
  console.log("[v0] Checking latest request details...");

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    console.error("[v0] Missing Supabase credentials");
    return;
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    // Get the latest request (from 2/19/2026, 5:32:42 PM)
    const { data: latestRequest } = await supabase
      .from('pending_offpremises_checkins')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (latestRequest) {
      console.log("[v0] Latest request details:");
      console.log("[v0]   ID:", latestRequest.id);
      console.log("[v0]   User ID:", latestRequest.user_id);
      console.log("[v0]   Status:", latestRequest.status);
      console.log("[v0]   Created:", latestRequest.created_at);
      console.log("[v0]   Location:", latestRequest.current_location_name);
      console.log("[v0]   Approved By:", latestRequest.approved_by_id);
      console.log("[v0]   Approved At:", latestRequest.approved_at);
      console.log("[v0]   Rejection Reason:", latestRequest.rejection_reason);
      console.log("[v0]   Google Maps Name:", latestRequest.google_maps_name);
      console.log("[v0]   Device Info:", latestRequest.device_info);
    } else {
      console.log("[v0] No requests found in database");
    }

  } catch (error) {
    console.error("[v0] Error:", error);
  }
}

checkLatestRequest();
