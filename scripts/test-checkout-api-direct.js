import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceKey) {
  console.error("[v0] Missing Supabase environment variables");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function testCheckoutAPI() {
  console.log("[v0] ========== CHECKOUT API TEST ==========\n");

  try {
    // Get today's date
    const today = new Date().toISOString().split("T")[0];
    console.log(`[v0] Testing checkout for: ${today}\n`);

    // Find a user with a check-in record but no check-out
    const { data: records, error: fetchError } = await supabase
      .from("attendance_records")
      .select("id, user_id, check_in_time, check_out_time, work_hours")
      .gte("check_in_time", `${today}T00:00:00`)
      .lt("check_in_time", `${today}T23:59:59`)
      .is("check_out_time", null)
      .limit(1)
      .single();

    if (fetchError || !records) {
      console.error("[v0] Error finding test record:", fetchError);
      return;
    }

    console.log(`[v0] Found test record:`);
    console.log(`  - ID: ${records.id}`);
    console.log(`  - User ID: ${records.user_id}`);
    console.log(`  - Check-In: ${records.check_in_time}`);
    console.log(`  - Check-Out: ${records.check_out_time}\n`);

    // Test the update directly
    const checkoutTime = new Date().toISOString();
    const workHours = 8.5; // Example work hours

    console.log(`[v0] Attempting to update checkout_time to: ${checkoutTime}\n`);

    const { data: updateResult, error: updateError } = await supabase
      .from("attendance_records")
      .update({
        check_out_time: checkoutTime,
        work_hours: workHours,
      })
      .eq("id", records.id)
      .select("*")
      .single();

    if (updateError) {
      console.error("[v0] Update error:", updateError);
      console.error("[v0] Error details:", {
        code: updateError.code,
        message: updateError.message,
        details: updateError.details,
      });
      return;
    }

    console.log("[v0] ✅ Update successful!");
    console.log(`[v0] Updated record:`);
    console.log(`  - Check-Out: ${updateResult.check_out_time}`);
    console.log(`  - Work Hours: ${updateResult.work_hours}\n`);

    // Verify the update was saved
    const { data: verification } = await supabase
      .from("attendance_records")
      .select("id, check_out_time, work_hours")
      .eq("id", records.id)
      .single();

    if (verification?.check_out_time) {
      console.log("[v0] ✅ VERIFICATION PASSED: Checkout time is persisted in database");
    } else {
      console.log("[v0] ❌ VERIFICATION FAILED: Checkout time was not saved");
    }
  } catch (error) {
    console.error("[v0] Test error:", error);
  }
}

testCheckoutAPI();
