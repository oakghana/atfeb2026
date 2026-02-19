import { createClient } from '@supabase/supabase-js';

async function checkTodaysOffPremisesRequests() {
  console.log("[v0] Starting off-premises request check...");

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    console.error("[v0] Missing Supabase credentials");
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  // Get today's date range in UTC
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  const todayEnd = new Date(today);
  todayEnd.setUTCHours(23, 59, 59, 999);

  console.log(
    `[v0] Querying for requests between ${today.toISOString()} and ${todayEnd.toISOString()}`
  );

  // Query all pending off-premises check-ins (not filtered by date first to see what exists)
  const { data: allRequests, error: allError } = await supabase
    .from("pending_offpremises_checkins")
    .select(
      "id, user_id, current_location_name, status, created_at, updated_at"
    )
    .order("created_at", { ascending: false });

  if (allError) {
    console.error("[v0] Error fetching all requests:", allError);
  } else {
    console.log("[v0] Total pending off-premises requests in database:", allRequests?.length || 0);
    console.log("[v0] Recent requests:", JSON.stringify(allRequests?.slice(0, 5), null, 2));
  }

  // Now query for today's requests specifically
  const { data: todaysRequests, error: todayError } = await supabase
    .from("pending_offpremises_checkins")
    .select(
      "id, user_id, current_location_name, status, created_at, updated_at"
    )
    .gte("created_at", today.toISOString())
    .lte("created_at", todayEnd.toISOString())
    .order("created_at", { ascending: false });

  if (todayError) {
    console.error("[v0] Error fetching today's requests:", todayError);
  } else {
    console.log(
      "[v0] Today's off-premises check-in requests:",
      todaysRequests?.length || 0
    );
    console.log("[v0] Details:", JSON.stringify(todaysRequests, null, 2));
  }

  return {
    totalPending: allRequests?.length || 0,
    todayCount: todaysRequests?.length || 0,
    todaysRequests: todaysRequests || [],
    allRequests: allRequests || [],
  };
}

checkTodaysOffPremisesRequests()
  .then((result) => {
    console.log("[v0] Final result:", JSON.stringify(result, null, 2));
  })
  .catch((error) => {
    console.error("[v0] Script error:", error);
  });
