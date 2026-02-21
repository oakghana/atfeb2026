import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error("[v0] Missing Supabase credentials");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function verifyCheckoutFix() {
  console.log("[v0] ========== POST-FIX VERIFICATION ==========\n");

  try {
    const today = new Date().toISOString().split("T")[0];
    console.log(`[v0] Verifying checkout records for: ${today}\n`);

    // Fetch all records for today
    const { data: records, error } = await supabase
      .from("attendance_records")
      .select(
        "id, user_id, check_in_time, check_out_time, work_hours, check_in_location_name, check_out_location_name, check_out_method, is_remote_checkout"
      )
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

    console.log(`[v0] Found ${records.length} attendance records:\n`);

    let checkedOutCount = 0;
    let notCheckedOutCount = 0;
    let inRangeCount = 0;
    let outOfRangeCount = 0;
    let remoteCheckoutCount = 0;

    records.forEach((record, index) => {
      const hasCheckout = !!record.check_out_time;
      const isRemote = record.is_remote_checkout;
      const checkoutMethod = record.check_out_method || "none";

      if (hasCheckout) {
        checkedOutCount++;
        if (isRemote || checkoutMethod === "remote_offpremises") {
          remoteCheckoutCount++;
        } else {
          inRangeCount++;
        }
      } else {
        notCheckedOutCount++;
      }

      const status = hasCheckout ? "✓ CHECKED OUT" : "❌ NOT CHECKED OUT";
      const checkoutType = isRemote ? "(Remote/Out-of-Range)" : "(In-Range)";

      console.log(`${index + 1}. User: ${record.user_id}`);
      console.log(`   Status: ${status} ${hasCheckout ? checkoutType : ""}`);
      if (hasCheckout) {
        console.log(
          `   Time: ${new Date(record.check_in_time).toLocaleTimeString()} → ${new Date(
            record.check_out_time
          ).toLocaleTimeString()}`
        );
        console.log(`   Work Hours: ${record.work_hours?.toFixed(2) || "N/A"}`);
        console.log(`   Location: ${record.check_out_location_name || "N/A"}`);
      }
      console.log("");
    });

    console.log("[v0] ========== SUMMARY ==========");
    console.log(`[v0] Total Records: ${records.length}`);
    console.log(`[v0] Checked Out: ${checkedOutCount} (${((checkedOutCount / records.length) * 100).toFixed(1)}%)`);
    console.log(`[v0]   - In-Range: ${inRangeCount}`);
    console.log(`[v0]   - Out-of-Range/Remote: ${remoteCheckoutCount}`);
    console.log(`[v0] NOT Checked Out: ${notCheckedOutCount}\n`);

    if (notCheckedOutCount === 0) {
      console.log("[v0] ✓ SUCCESS! All checkout records are being saved correctly.");
    } else {
      console.log(
        `[v0] ⚠️  ISSUE: ${notCheckedOutCount} record(s) still missing checkout data. The API fix may not be working.`
      );
    }
  } catch (error) {
    console.error("[v0] Unexpected error:", error);
  }
}

verifyCheckoutFix();
