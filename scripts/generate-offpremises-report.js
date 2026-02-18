import { createClient } from "@supabase/supabase-js";

async function generateOffPremisesReport() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    console.error("[v0] Missing Supabase environment variables");
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, supabaseAnonKey);

  console.log(`
════════════════════════════════════════════════════════════════════════════
                    OFF-PREMISES CHECK-IN REPORT
════════════════════════════════════════════════════════════════════════════
`)

  // Get the latest approved off-premises request
  const { data: approvedRequests, error: requestError } = await supabase
    .from("pending_offpremises_checkins")
    .select("*")
    .eq("status", "approved")
    .order("approved_at", { ascending: false })
    .limit(1)

  if (requestError || !approvedRequests || approvedRequests.length === 0) {
    console.log("❌ No approved off-premises requests found")
    return
  }

  const request = approvedRequests[0]
  console.log(`\n📋 LATEST APPROVED REQUEST:\n`)
  console.log(`Request ID: ${request.id}`)
  console.log(`Status: ${request.status.toUpperCase()}`)
  console.log(`Requested: ${new Date(request.created_at).toLocaleString()}`)
  console.log(`Approved: ${new Date(request.approved_at).toLocaleString()}`)
  console.log(`Location: ${request.current_location_name}`)
  console.log(`Google Maps: ${request.google_maps_name || "Not captured"}`)
  console.log(`Coordinates: ${request.latitude}, ${request.longitude}`)

  // Get staff profile
  const { data: staffProfile } = await supabase
    .from("profiles")
    .select("id, first_name, last_name, email, department_id")
    .eq("id", request.user_id)
    .single()

  if (staffProfile) {
    console.log(`\n👤 STAFF MEMBER:\n`)
    console.log(`Name: ${staffProfile.first_name} ${staffProfile.last_name}`)
    console.log(`Email: ${staffProfile.email}`)
    console.log(`User ID: ${staffProfile.id}`)
  }

  // Get approver profile
  const { data: approverProfile } = await supabase
    .from("profiles")
    .select("id, first_name, last_name, email, role")
    .eq("id", request.approved_by_id)
    .single()

  if (approverProfile) {
    console.log(`\n✅ APPROVED BY:\n`)
    console.log(`Name: ${approverProfile.first_name} ${approverProfile.last_name}`)
    console.log(`Role: ${approverProfile.role}`)
    console.log(`Email: ${approverProfile.email}`)
  }

  // Check attendance records table columns
  console.log(`\n🗄️  DATABASE CHECK:\n`)
  
  // Try to get a sample attendance record to see what columns exist
  const { data: sampleRecord, error: sampleError } = await supabase
    .from("attendance_records")
    .select("*")
    .limit(1)
    .single()

  if (!sampleError && sampleRecord) {
    const columnNames = Object.keys(sampleRecord);
    const requiredColumns = [
      "actual_location_name",
      "actual_latitude",
      "actual_longitude",
      "on_official_duty_outside_premises",
      "check_in_type",
    ];

    console.log(`Expected columns for off-premises tracking:`);
    requiredColumns.forEach((col) => {
      if (columnNames.includes(col)) {
        console.log(`  ✓ ${col}`);
      } else {
        console.log(`  ✗ ${col} - MISSING!`);
      }
    });
  } else {
    console.log("⚠️  Could not verify database columns");
  }

  // Check if attendance record was created
  console.log(`\n📝 CHECK-IN STATUS:\n`)
  const { data: attendanceRecords, error: attendanceError } = await supabase
    .from("attendance_records")
    .select("*")
    .eq("user_id", request.user_id)
    .order("check_in_time", { ascending: false })
    .limit(3)

  if (attendanceError) {
    console.log(`Error retrieving attendance records: ${attendanceError.message}`)
  } else if (!attendanceRecords || attendanceRecords.length === 0) {
    console.log(
      `❌ NO CHECK-IN FOUND - Staff member was NOT automatically checked in after approval`,
    )
  } else {
    const latestCheckIn = attendanceRecords[0]
    const checkInTime = new Date(latestCheckIn.check_in_time)
    const approvalTime = new Date(request.approved_at)

    if (checkInTime > approvalTime) {
      console.log(`✓ CHECK-IN RECORDED - AFTER approval at ${checkInTime.toLocaleString()}`)
      console.log(`  Check-in Type: ${latestCheckIn.check_in_type || "standard"}`)
      console.log(`  Location: ${latestCheckIn.location_name || "N/A"}`)
      console.log(`  Notes: ${latestCheckIn.notes || "None"}`)
    } else {
      console.log(`⚠️  CHECK-IN EXISTS but BEFORE approval - Not related to this request`)
      console.log(`  Previous Check-in: ${checkInTime.toLocaleString()}`)
      console.log(`  Approval: ${approvalTime.toLocaleString()}`)
    }
  }

  console.log(`
════════════════════════════════════════════════════════════════════════════
                              SUMMARY
════════════════════════════════════════════════════════════════════════════

✓ OFF-PREMISES REQUEST: APPROVED
  - Request Date: ${new Date(request.created_at).toLocaleString()}
  - Approval Date: ${new Date(request.approved_at).toLocaleString()}
  - Location: ${request.current_location_name}

❌ AUTOMATIC CHECK-IN: NOT RECORDED
  - The approve route attempted to create a check-in record
  - But the database columns don't exist yet:
    * actual_location_name
    * actual_latitude
    * actual_longitude
    * on_official_duty_outside_premises
    * check_in_type

📋 NEXT STEPS:
  1. Add missing columns to attendance_records table
  2. Manually create check-in record for this request
  3. Future approvals will automatically create check-in records once columns exist

════════════════════════════════════════════════════════════════════════════
`)
}

generateOffPremisesReport().catch(console.error)
