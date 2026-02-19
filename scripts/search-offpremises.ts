import { createClient } from '@supabase/supabase-js';

async function findOffPremisesRequestsComprehensive() {
  console.log("[v0] Searching for your off-premises request across all tables...");

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    console.error("[v0] Missing Supabase credentials");
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  // Get today's date range
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  const todayEnd = new Date(today);
  todayEnd.setUTCHours(23, 59, 59, 999);

  console.log(`[v0] Checking tables for requests from 2026-02-19...\n`);

  // Check pending_offpremises_checkins with broader date range
  console.log("=== Checking pending_offpremises_checkins ===");
  const { data: pending, error: pendingError } = await supabase
    .from("pending_offpremises_checkins")
    .select("*")
    .gte("created_at", "2026-02-19T00:00:00Z")
    .order("created_at", { ascending: false });

  if (!pendingError) {
    console.log(`Found ${pending?.length || 0} records`);
    if (pending && pending.length > 0) {
      console.log("Latest:", JSON.stringify(pending[0], null, 2));
    }
  } else {
    console.log("Error:", pendingError.message);
  }

  // Check all_offpremises_checkins
  console.log("\n=== Checking all_offpremises_checkins ===");
  const { data: allCheckins, error: allError } = await supabase
    .from("all_offpremises_checkins")
    .select("*")
    .gte("created_at", "2026-02-19T00:00:00Z")
    .order("created_at", { ascending: false });

  if (!allError) {
    console.log(`Found ${allCheckins?.length || 0} records`);
    if (allCheckins && allCheckins.length > 0) {
      console.log("Latest:", JSON.stringify(allCheckins[0], null, 2));
    }
  } else {
    console.log("Error:", allError.message);
  }

  // Check attendance table for any records
  console.log("\n=== Checking attendance table ===");
  const { data: attendance, error: attendanceError } = await supabase
    .from("attendance")
    .select("*")
    .gte("created_at", "2026-02-19T00:00:00Z")
    .order("created_at", { ascending: false })
    .limit(5);

  if (!attendanceError) {
    console.log(`Found ${attendance?.length || 0} records`);
    if (attendance && attendance.length > 0) {
      console.log("Latest:", JSON.stringify(attendance[0], null, 2));
    }
  } else {
    console.log("Error:", attendanceError.message);
  }

  // Check for any table with "outside" or "offpremises" in name
  console.log("\n=== Checking for other related tables ===");
  const { data: tables, error: tablesError } = await supabase
    .from("information_schema.tables")
    .select("table_name")
    .eq("table_schema", "public");

  if (!tablesError && tables) {
    const offPremisesTables = tables.filter(t => 
      t.table_name.includes('offpremises') || 
      t.table_name.includes('outside') ||
      t.table_name.includes('off_premises')
    );
    console.log("Off-premises related tables:", offPremisesTables.map(t => t.table_name));
  }
}

findOffPremisesRequestsComprehensive()
  .then(() => {
    console.log("[v0] Search complete");
  })
  .catch((error) => {
    console.error("[v0] Error:", error);
  });
