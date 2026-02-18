import { createClient } from "@supabase/supabase-js";

const supabaseUrl = "https://vgtajtqxgczhjboatvol.supabase.co";
const supabaseServiceKey =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZndGFqdHF4Z2N6aGpib2F0dm9sIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1Njk3NTI0OCwiZXhwIjoyMDcyNTUxMjQ4fQ.x3by0hGUAO3GQcPs1_sla6gdGY8QuxcYiGmSRdj4-yA";

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function addMissingColumns() {
  console.log("[v0] Adding missing columns to attendance_records table...\n");

  // Check current schema
  const { data: tableInfo, error: schemaError } = await supabase.rpc(
    "get_table_columns",
    { table_name: "attendance_records" }
  ).catch(() => ({ data: null, error: { message: "RPC not available" } }));

  console.log("[v0] Current table info:", tableInfo);

  // Use raw SQL to add columns if RPC isn't available
  const columns = [
    "actual_location_name TEXT",
    "actual_latitude DECIMAL(10, 8)",
    "actual_longitude DECIMAL(11, 8)",
    "on_official_duty_outside_premises BOOLEAN DEFAULT FALSE",
    "check_in_type VARCHAR(50)",
    "device_info TEXT"
  ];

  console.log("[v0] Attempting to add missing columns...");
  
  for (const column of columns) {
    const columnName = column.split(" ")[0];
    console.log(`[v0] Adding column: ${columnName}`);
    
    const { error } = await supabase.from("attendance_records")
      .select(columnName)
      .limit(1);

    if (error && error.message.includes("does not exist")) {
      console.log(`[v0] Column ${columnName} doesn't exist, needs to be added`);
    } else if (error) {
      console.log(`[v0] Error checking ${columnName}: ${error.message}`);
    } else {
      console.log(`[v0] Column ${columnName} already exists`);
    }
  }

  console.log("\n[v0] Please run the following SQL directly in Supabase:\n");
  console.log(`
ALTER TABLE public.attendance_records
ADD COLUMN IF NOT EXISTS actual_location_name TEXT,
ADD COLUMN IF NOT EXISTS actual_latitude DECIMAL(10, 8),
ADD COLUMN IF NOT EXISTS actual_longitude DECIMAL(11, 8),
ADD COLUMN IF NOT EXISTS on_official_duty_outside_premises BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS check_in_type VARCHAR(50),
ADD COLUMN IF NOT EXISTS device_info TEXT;

ALTER TABLE public.pending_offpremises_checkins
ADD COLUMN IF NOT EXISTS google_maps_name TEXT;

CREATE INDEX IF NOT EXISTS idx_attendance_offpremises
  ON public.attendance_records(on_official_duty_outside_premises)
  WHERE on_official_duty_outside_premises = TRUE;

CREATE INDEX IF NOT EXISTS idx_attendance_check_in_type
  ON public.attendance_records(check_in_type);
  `);
}

addMissingColumns().catch(console.error);
