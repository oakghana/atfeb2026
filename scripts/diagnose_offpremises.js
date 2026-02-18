import { createClient } from "@supabase/supabase-js";

const supabaseUrl = "https://vgtajtqxgczhjboatvol.supabase.co";
const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZndGFqdHF4Z2N6aGpib2F0dm9sIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1Njk3NTI0OCwiZXhwIjoyMDcyNTUxMjQ4fQ.x3by0hGUAO3GQcPs1_sla6gdGY8QuxcYiGmSRdj4-yA";

const supabase = createClient(supabaseUrl, supabaseKey);

async function diagnose() {
  console.log("=== 1. TABLE SCHEMA: pending_offpremises_checkins ===");
  const { data: columns, error: colErr } = await supabase.rpc("exec_sql", {
    query: "SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'pending_offpremises_checkins' ORDER BY ordinal_position"
  }).maybeSingle();
  
  // Fallback: just query for all rows
  if (colErr) {
    console.log("Could not get schema via RPC, querying table directly...");
  } else {
    console.log("Columns:", JSON.stringify(columns, null, 2));
  }

  console.log("\n=== 2. ALL RECORDS IN pending_offpremises_checkins ===");
  const { data: pending, error: pendingErr } = await supabase
    .from("pending_offpremises_checkins")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(20);

  if (pendingErr) {
    console.log("ERROR querying pending_offpremises_checkins:", pendingErr.message);
  } else {
    console.log(`Found ${pending?.length || 0} records:`);
    if (pending && pending.length > 0) {
      pending.forEach((r, i) => {
        console.log(`\n  Record ${i + 1}:`, JSON.stringify(r, null, 4));
      });
    } else {
      console.log("  NO RECORDS FOUND - requests are NOT being saved!");
    }
  }

  console.log("\n=== 3. ALL RECORDS IN approved_offpremises_checkins ===");
  const { data: approved, error: approvedErr } = await supabase
    .from("approved_offpremises_checkins")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(20);

  if (approvedErr) {
    console.log("ERROR querying approved_offpremises_checkins:", approvedErr.message);
  } else {
    console.log(`Found ${approved?.length || 0} records:`);
    if (approved && approved.length > 0) {
      approved.forEach((r, i) => {
        console.log(`\n  Record ${i + 1}:`, JSON.stringify(r, null, 4));
      });
    } else {
      console.log("  NO APPROVED RECORDS FOUND");
    }
  }

  console.log("\n=== 4. ADMIN/MANAGER USERS (who can approve) ===");
  const { data: admins, error: adminErr } = await supabase
    .from("user_profiles")
    .select("id, first_name, last_name, email, role, department_id")
    .in("role", ["admin", "department_head", "regional_manager"])
    .limit(20);

  if (adminErr) {
    console.log("ERROR querying admins:", adminErr.message);
  } else {
    console.log(`Found ${admins?.length || 0} admin/manager users:`);
    admins?.forEach((a, i) => {
      console.log(`  ${i + 1}. ${a.first_name} ${a.last_name} (${a.email}) - role: ${a.role}, dept: ${a.department_id}`);
    });
  }

  console.log("\n=== 5. RECENT ATTENDANCE RECORDS (last 5) ===");
  const { data: attendance, error: attErr } = await supabase
    .from("attendance_records")
    .select("id, user_id, check_in_time, check_out_time, check_in_location_id, status, created_at")
    .order("created_at", { ascending: false })
    .limit(5);

  if (attErr) {
    console.log("ERROR querying attendance_records:", attErr.message);
  } else {
    console.log(`Found ${attendance?.length || 0} recent records:`);
    attendance?.forEach((r, i) => {
      console.log(`  ${i + 1}. user: ${r.user_id}, check_in: ${r.check_in_time}, status: ${r.status}`);
    });
  }

  console.log("\n=== 6. user_profiles TABLE COLUMNS ===");
  const { data: sample, error: sampleErr } = await supabase
    .from("user_profiles")
    .select("*")
    .limit(1);

  if (sampleErr) {
    console.log("ERROR:", sampleErr.message);
  } else if (sample && sample.length > 0) {
    console.log("Available columns in user_profiles:", Object.keys(sample[0]).join(", "));
  }

  console.log("\n=== DIAGNOSIS COMPLETE ===");
}

diagnose().catch(console.error);
