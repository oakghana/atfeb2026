import { createClient } from "@supabase/supabase-js";

const supabaseUrl = "https://vgtajtqxgczhjboatvol.supabase.co";
const supabaseServiceKey =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZndGFqdHF4Z2N6aGpib2F0dm9sIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1Njk3NTI0OCwiZXhwIjoyMDcyNTUxMjQ4fQ.x3by0hGUAO3GQcPs1_sla6gdGY8QuxcYiGmSRdj4-yA";

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function checkOffPremisesReview() {
  console.log("[v0] Checking latest off-premises reviews and check-ins...\n");

  // Get the latest pending off-premises requests that have been reviewed
  const { data: pendingRequests, error: pendingError } = await supabase
    .from("pending_offpremises_checkins")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(10);

  if (pendingError) {
    console.error("[v0] Error fetching pending requests:", pendingError);
    return;
  }

  console.log(`[v0] Found ${pendingRequests?.length || 0} recent off-premises requests:\n`);

  if (pendingRequests && pendingRequests.length > 0) {
    for (const request of pendingRequests) {
      console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
      console.log(`Request ID: ${request.id}`);
      console.log(`Staff User ID: ${request.user_id}`);
      console.log(`Status: ${request.status?.toUpperCase()}`);
      console.log(`Location Name: ${request.current_location_name}`);
      console.log(`Google Maps Name: ${request.google_maps_name || "Not available"}`);
      console.log(`Coordinates: ${request.latitude}, ${request.longitude}`);
      console.log(`Requested at: ${new Date(request.created_at).toLocaleString()}`);

      // Get staff profile
      const { data: staffProfile } = await supabase
        .from("profiles")
        .select("first_name, last_name, email")
        .eq("id", request.user_id)
        .single();

      if (staffProfile) {
        console.log(`Staff: ${staffProfile.first_name || ""} ${staffProfile.last_name || ""}`);
        console.log(`Email: ${staffProfile.email || "N/A"}`);
      }

      if (request.status === "approved") {
        console.log(`✓ APPROVED`);
        console.log(`Approved at: ${request.approved_at ? new Date(request.approved_at).toLocaleString() : "N/A"}`);
        console.log(`Approved by ID: ${request.approved_by || "N/A"}`);

        // Get approver details
        if (request.approved_by) {
          const { data: approverProfile } = await supabase
            .from("profiles")
            .select("first_name, last_name, email")
            .eq("id", request.approved_by)
            .single();

          if (approverProfile) {
            console.log(
              `Approved by: ${approverProfile.first_name || ""} ${approverProfile.last_name || ""}`,
            );
          }
        }

        // Check if the staff member was auto-checked in
        const { data: attendanceRecord, error: attendanceError } = await supabase
          .from("attendance_records")
          .select("*")
          .eq("user_id", request.user_id)
          .eq("on_official_duty_outside_premises", true)
          .order("check_in_time", { ascending: false })
          .limit(1)
          .single();

        if (attendanceError && attendanceError.code !== "PGRST116") {
          console.log(`[v0] Error checking attendance: ${attendanceError.message}`);
        } else if (attendanceRecord) {
          console.log(`✓ CHECK-IN RECORDED`);
          console.log(`Check-in Time: ${new Date(attendanceRecord.check_in_time).toLocaleString()}`);
          console.log(`Location: ${attendanceRecord.actual_location_name || "N/A"}`);
          console.log(`Check-in Type: ${attendanceRecord.check_in_type || "N/A"}`);
          console.log(`Check-out Time: ${attendanceRecord.check_out_time ? new Date(attendanceRecord.check_out_time).toLocaleString() : "Not yet checked out"}`);
        } else {
          console.log(`✗ NO CHECK-IN FOUND - Staff may not have been auto-checked in`);
        }
      } else if (request.status === "rejected") {
        console.log(`✗ REJECTED`);
        console.log(`Rejection Reason: ${request.rejection_reason || "No reason provided"}`);
      } else {
        console.log(`⏳ PENDING - Not yet reviewed`);
      }
      console.log("");
    }
  } else {
    console.log("[v0] No off-premises requests found");
  }

  console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log("[v0] Query completed");
}

checkOffPremisesReview().catch(console.error);
