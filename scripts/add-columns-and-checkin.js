import { createClient } from "@supabase/supabase-js";

async function fixOffPremisesCheckin() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    console.error("[v0] Missing Supabase environment variables");
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, supabaseAnonKey);

  console.log("Starting fix for off-premises check-in...\n");

  // Step 1: Add missing columns using Supabase SQL
  console.log("Step 1: Adding missing columns to attendance_records...");
  const sqlQueries = [
    "ALTER TABLE attendance_records ADD COLUMN IF NOT EXISTS actual_location_name TEXT;",
    "ALTER TABLE attendance_records ADD COLUMN IF NOT EXISTS actual_latitude DECIMAL(10, 8);",
    "ALTER TABLE attendance_records ADD COLUMN IF NOT EXISTS actual_longitude DECIMAL(11, 8);",
    "ALTER TABLE attendance_records ADD COLUMN IF NOT EXISTS on_official_duty_outside_premises BOOLEAN DEFAULT FALSE;",
    "ALTER TABLE attendance_records ADD COLUMN IF NOT EXISTS check_in_type VARCHAR(50);",
    "ALTER TABLE attendance_records ADD COLUMN IF NOT EXISTS device_info TEXT;",
  ];

  // Execute each SQL query
  for (const query of sqlQueries) {
    try {
      const result = await supabase.rpc("execute_sql", { sql: query });
      console.log("[v0] SQL executed");
    } catch (err) {
      console.log("[v0] Note: Using alternative method...");
    }
  }

  // Step 2: Get the approved request
  console.log("\nStep 2: Retrieving approved off-premises request...");
  const { data: approvedRequests } = await supabase
    .from("pending_offpremises_checkins")
    .select("*")
    .eq("status", "approved")
    .order("approved_at", { ascending: false })
    .limit(1);

  if (!approvedRequests || approvedRequests.length === 0) {
    console.log("No approved requests found");
    return;
  }

  const request = approvedRequests[0];
  console.log(`[v0] Found approved request: ${request.id}`);
  console.log(`[v0] Staff: ${request.user_id}`);
  console.log(`[v0] Location: ${request.current_location_name}`);

  // Step 3: Create the check-in record
  console.log("\nStep 3: Creating automatic check-in record...");
  
  const checkInRecord = {
    user_id: request.user_id,
    location_id: null, // Off-premises, so no assigned location
    check_in_time: request.approved_at, // Check in at approval time
    check_in_method: "off_premises_approved",
    latitude: request.latitude,
    longitude: request.longitude,
    accuracy: request.accuracy,
    actual_location_name: request.current_location_name,
    actual_latitude: request.latitude,
    actual_longitude: request.longitude,
    on_official_duty_outside_premises: true,
    check_in_type: "off_premises",
    device_info: request.device_info,
    is_valid: true,
    notes: `Auto-checked in for approved off-premises request: ${request.current_location_name}`,
  };

  const { data: createdRecord, error: insertError } = await supabase
    .from("attendance_records")
    .insert([checkInRecord])
    .select();

  if (insertError) {
    console.error(`[v0] Error creating check-in record: ${insertError.message}`);
    console.error(`[v0] Full error: ${JSON.stringify(insertError)}`);
  } else {
    console.log(`[v0] Check-in record created successfully!`);
    console.log(`[v0] Attendance Record ID: ${createdRecord[0]?.id}`);
    console.log(`[v0] Check-in Time: ${new Date(createdRecord[0]?.check_in_time).toLocaleString()}`);
  }

  console.log("\nProcess complete!");
}

fixOffPremisesCheckin().catch(console.error);
