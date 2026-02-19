import { createClient } from '@supabase/supabase-js';

async function testOffPremisesFlow() {
  console.log("[v0] Testing off-premises check-in flow...\n");

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    console.error("[v0] Missing Supabase credentials");
    return;
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    // Get today's date range
    const today = new Date('2026-02-19');
    const todayEnd = new Date('2026-02-20');
    
    console.log(`[v0] Checking requests for: ${today.toDateString()}\n`);

    // Query pending requests with all details
    const { data: requests, error } = await supabase
      .from('pending_offpremises_checkins')
      .select(`
        id,
        user_id,
        current_location_name,
        google_maps_name,
        latitude,
        longitude,
        accuracy,
        reason,
        status,
        created_at,
        user_profiles!pending_offpremises_checkins_user_id_fkey (
          first_name,
          last_name,
          email,
          employee_id,
          department_id,
          assigned_location_id,
          departments (name),
          locations (name)
        )
      `)
      .gte('created_at', today.toISOString())
      .lt('created_at', todayEnd.toISOString())
      .order('created_at', { ascending: false });

    if (error) {
      console.error("[v0] Error fetching requests:", error);
      return;
    }

    if (!requests || requests.length === 0) {
      console.log("[v0] NO off-premises requests found for today");
      return;
    }

    console.log(`[v0] FOUND ${requests.length} off-premises request(s) for today:\n`);
    
    requests.forEach((req, idx) => {
      console.log(`Request ${idx + 1}:`);
      console.log(`  Status: ${req.status}`);
      console.log(`  Staff: ${req.user_profiles?.first_name} ${req.user_profiles?.last_name}`);
      console.log(`  Email: ${req.user_profiles?.email}`);
      console.log(`  Employee ID: ${req.user_profiles?.employee_id}`);
      console.log(`  Department: ${req.user_profiles?.departments?.name}`);
      console.log(`  Assigned Location: ${req.user_profiles?.locations?.name}`);
      console.log(`  Current Location: ${req.current_location_name}`);
      console.log(`  Google Maps Name: ${req.google_maps_name}`);
      console.log(`  Reason: ${req.reason}`);
      console.log(`  GPS: ${req.latitude.toFixed(4)}, ${req.longitude.toFixed(4)} (±${req.accuracy}m)`);
      console.log(`  Submitted: ${new Date(req.created_at).toLocaleString()}`);
      console.log("");
    });

    // Summary
    const pending = requests.filter(r => r.status === 'pending').length;
    const approved = requests.filter(r => r.status === 'approved').length;
    const rejected = requests.filter(r => r.status === 'rejected').length;
    
    console.log(`[v0] SUMMARY for today:`);
    console.log(`  Total requests: ${requests.length}`);
    console.log(`  Pending: ${pending}`);
    console.log(`  Approved: ${approved}`);
    console.log(`  Rejected: ${rejected}`);

  } catch (error) {
    console.error("[v0] Exception:", error);
  }
}

testOffPremisesFlow();
