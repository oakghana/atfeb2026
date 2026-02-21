import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error("[v0] Missing Supabase credentials");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function diagnoseCheckoutIssue() {
  console.log("[v0] ========== CHECKOUT DATA VERIFICATION ==========\n");

  try {
    // Get today's date
    const today = new Date().toISOString().split("T")[0];
    console.log(`[v0] Checking attendance records for today: ${today}\n`);

    // Fetch today's attendance records
    const { data: records, error } = await supabase
      .from("attendance_records")
      .select(`
        id,
        user_id,
        check_in_time,
        check_out_time,
        work_hours,
        check_in_location_name,
        check_out_location_name,
        is_remote_checkout,
        check_out_method,
        user_profiles(id, first_name, last_name, employee_id)
      `)
      .gte("check_in_time", `${today}T00:00:00`)
      .lte("check_in_time", `${today}T23:59:59`)
      .order("check_in_time", { ascending: false });

    if (error) {
      console.error("[v0] Error fetching records:", error);
      return;
    }

    if (!records || records.length === 0) {
      console.log("[v0] No attendance records found for today.");
      return;
    }

    console.log(`[v0] Found ${records.length} attendance record(s) for today:\n`);

    records.forEach((record, index) => {
      const userName = record.user_profiles
        ? `${record.user_profiles.first_name} ${record.user_profiles.last_name}`
        : "Unknown";
      const employeeId = record.user_profiles?.employee_id || "N/A";

      console.log(`[v0] Record ${index + 1}:`);
      console.log(`   - User: ${userName} (ID: ${employeeId})`);
      console.log(`   - Check-in: ${new Date(record.check_in_time).toLocaleString()}`);
      console.log(
        `   - Check-out: ${
          record.check_out_time
            ? new Date(record.check_out_time).toLocaleString()
            : "NOT RECORDED ❌"
        }`
      );
      console.log(
        `   - Work Hours: ${record.work_hours ? record.work_hours.toFixed(2) : "N/A"}`
      );
      console.log(`   - Check-in Location: ${record.check_in_location_name || "N/A"}`);
      console.log(`   - Check-out Location: ${record.check_out_location_name || "N/A"}`);
      console.log(`   - Check-out Method: ${record.check_out_method || "N/A"}`);
      console.log(`   - Is Remote Checkout: ${record.is_remote_checkout ? "Yes" : "No"}`);
      console.log("");
    });

    // Count statistics
    const checkedOut = records.filter((r) => r.check_out_time).length;
    const notCheckedOut = records.length - checkedOut;

    console.log("[v0] ========== SUMMARY ==========");
    console.log(`[v0] Total Records: ${records.length}`);
    console.log(`[v0] Checked Out: ${checkedOut} ✓`);
    console.log(`[v0] NOT Checked Out: ${notCheckedOut} ❌`);
    console.log("");

    if (notCheckedOut > 0) {
      console.log("[v0] ⚠️  ISSUE DETECTED: Some records are missing check_out_time!");
      console.log(
        "[v0] This indicates the checkout API is showing success but not persisting data.\n"
      );
    } else {
      console.log("[v0] ✓ All records have check-out times recorded.");
    }
  } catch (error) {
    console.error("[v0] Unexpected error:", error);
  }
}

diagnoseCheckoutIssue();
