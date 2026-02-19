import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("[v0] Missing Supabase credentials");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function testInsert() {
  console.log("[v0] Testing direct insert into pending_offpremises_checkins...");
  
  // First, check table structure
  console.log("[v0] Step 1: Checking table structure...");
  const { data: tableInfo, error: infoError } = await supabase
    .from('pending_offpremises_checkins')
    .select('*')
    .limit(1);
  
  console.log("[v0] Table info error:", infoError);
  console.log("[v0] Can read from table: ", !infoError);

  // Try to insert a test record
  console.log("[v0] Step 2: Attempting to insert test record...");
  const testData = {
    user_id: '00000000-0000-0000-0000-000000000000', // Test UUID
    current_location_name: 'Test Location - ' + new Date().toISOString(),
    latitude: 6.0761,
    longitude: -0.2760,
    accuracy: 21,
    device_info: { test: true },
    status: 'pending',
  };

  const { data: insertResult, error: insertError } = await supabase
    .from('pending_offpremises_checkins')
    .insert([testData])
    .select();

  console.log("[v0] Insert error:", insertError);
  console.log("[v0] Insert result:", insertResult);

  if (insertError) {
    console.error("[v0] INSERT FAILED:");
    console.error("  Error message:", insertError.message);
    console.error("  Error code:", insertError.code);
    console.error("  Error details:", insertError.details);
    console.error("  Error hint:", insertError.hint);
  } else {
    console.log("[v0] INSERT SUCCESSFUL");
    console.log("[v0] Inserted record ID:", insertResult?.[0]?.id);
  }

  // Now query for all records today
  console.log("[v0] Step 3: Querying for records from today...");
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const { data: todayRecords, error: queryError } = await supabase
    .from('pending_offpremises_checkins')
    .select('*')
    .gte('created_at', today.toISOString());

  console.log("[v0] Query error:", queryError);
  console.log("[v0] Records found today:", todayRecords?.length || 0);
  console.log("[v0] Records:", todayRecords);
}

testInsert().catch(err => {
  console.error("[v0] Fatal error:", err.message);
  process.exit(1);
});
