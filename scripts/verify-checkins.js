import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error("Missing Supabase credentials");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function main() {
  console.log("[v0] Verifying check-in records for latest approved off-premises request...\n");

  // Get the latest approved off-premises request
  const { data: latestRequest } = await supabase
    .from("pending_offpremises_checkins")
    .select("*")
    .eq("status", "approved")
    .order("approved_at", { ascending: false })
    .limit(1)
    .single();

  if (!latestRequest) {
    console.log("No approved off-premises requests found");
    process.exit(0);
  }

  console.log("Latest Approved Request:");
  console.log(`- Request ID: ${latestRequest.id}`);
  console.log(`- Staff User ID: ${latestRequest.user_id}`);
  console.log(`- Approved at: ${new Date(latestRequest.approved_at).toLocaleString()}`);
  console.log(`- Location: ${latestRequest.current_location_name}`);
  console.log("");

  // Get staff profile
  const { data: staffProfile } = await supabase
    .from("profiles")
    .select("first_name, last_name, email")
    .eq("id", latestRequest.user_id)
    .single();

  if (staffProfile) {
    console.log(`Staff Member: ${staffProfile.first_name} ${staffProfile.last_name}`);
    console.log(`Email: ${staffProfile.email}\n`);
  }

  // Check for any attendance records created after the approval time
  console.log("Checking for check-in records created after approval...\n");

  const approvalTime = new Date(latestRequest.approved_at);

  const { data: attendanceRecords, error: attendanceError } = await supabase
    .from("attendance_records")
    .select("*")
    .eq("user_id", latestRequest.user_id)
    .gte("check_in_time", latestRequest.approved_at)
    .order("check_in_time", { ascending: false })
    .limit(5);

  if (attendanceError) {
    console.log(`Error querying attendance records: ${attendanceError.message}`);
  } else if (attendanceRecords && attendanceRecords.length > 0) {
    console.log(`Found ${attendanceRecords.length} check-in record(s) after approval:\n`);
    for (const record of attendanceRecords) {
      console.log("Check-in Record:");
      console.log(`- Check-in Time: ${new Date(record.check_in_time).toLocaleString()}`);
      console.log(`- Location Name: ${record.location_name || "N/A"}`);
      console.log(`- Latitude/Longitude: ${record.latitude}, ${record.longitude}`);
      console.log(`- Check-in Method: ${record.check_in_method || "N/A"}`);
      console.log(`- Check-out Time: ${record.check_out_time ? new Date(record.check_out_time).toLocaleString() : "Not checked out yet"}`);
      console.log("");
    }
  } else {
    console.log("No check-in records found after approval time.");
    console.log("The staff member may not have been automatically checked in.\n");
  }

  // Get table columns to check what data is being tracked
  console.log("\nChecking database schema for off-premises tracking columns...\n");

  const { data: columns, error: columnError } = await supabase
    .rpc("get_table_columns", { table_name: "attendance_records" })
    .catch((err) => ({ data: null, error: err }));

  if (columnError) {
    console.log("Note: Database may be missing the following columns:");
    console.log("- actual_location_name");
    console.log("- actual_latitude");
    console.log("- actual_longitude");
    console.log("- on_official_duty_outside_premises");
    console.log("- check_in_type");
    console.log("- device_info");
    console.log("\nThese columns need to be added to properly track off-premises check-ins.");
  }

  console.log("\n[v0] Verification complete");
}

main().catch((err) => {
  console.error("[v0] Error:", err.message);
  process.exit(1);
});
