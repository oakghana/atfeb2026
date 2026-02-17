import { createClient } from "@supabase/supabase-js";

// Supabase credentials
const SUPABASE_URL = "https://vgtajtqxgczhjboatvol.supabase.co";
const SUPABASE_SERVICE_ROLE_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZndGFqdHF4Z2N6aGpib2F0dm9sIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1Njk3NTI0OCwiZXhwIjoyMDcyNTUxMjQ4fQ.x3by0hGUAO3GQcPs1_sla6gdGY8QuxcYiGmSRdj4-yA";

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function simulateOffPremisesRequest() {
  console.log("\n🎯 OFF-PREMISES CHECK-IN REQUEST SIMULATION");
  console.log("=".repeat(60));

  try {
    // Step 1: Get staff members to use as test data
    console.log("\n📋 Step 1: Fetching staff members from user_profiles...");
    const { data: staffMembers, error: staffError } = await supabase
      .from("user_profiles")
      .select("id, first_name, last_name, email, department_id, role")
      .neq("role", "admin")
      .limit(3);

    if (staffError) {
      console.error("❌ Error fetching staff:", staffError.message);
      return;
    }

    if (!staffMembers || staffMembers.length === 0) {
      console.log("⚠️  No staff members found in database");
      return;
    }

    console.log(`✅ Found ${staffMembers.length} staff members`);
    staffMembers.forEach((staff, idx) => {
      console.log(
        `   ${idx + 1}. ${staff.first_name} ${staff.last_name} (${staff.email})`
      );
    });

    // Create off-premises requests for existing staff
    await createOffPremisesRequests(staffMembers);
  } catch (error) {
    console.error("❌ Simulation error:", error);
  }
}

async function createOffPremisesRequests(staffMembers) {
  console.log("\n📝 Step 2: Creating off-premises check-in requests...");

  const requests = staffMembers.map((staff) => ({
    user_id: staff.id,
    current_location_name: `Client Meeting - Off-Site Location ${Math.floor(Math.random() * 100)}`,
    latitude: 5.5500 + (Math.random() - 0.5) * 0.2,
    longitude: -0.2167 + (Math.random() - 0.5) * 0.2,
    accuracy: 15 + Math.random() * 20,
    device_info: JSON.stringify({
      device_type: "mobile",
      os: "Android",
      browser: "Chrome",
      timestamp: new Date().toISOString(),
    }),
    status: "pending",
  }));

  const { data: createdRequests, error: requestError } = await supabase
    .from("pending_offpremises_checkins")
    .insert(requests)
    .select();

  if (requestError) {
    console.error("❌ Error creating requests:", requestError.message);
    return;
  }

  console.log(`✅ Created ${createdRequests.length} off-premises requests:`);
  createdRequests.forEach((req, idx) => {
    const staff = staffMembers[idx];
    console.log(`\n   Request ${idx + 1}:`);
    console.log(`   - Staff: ${staff.first_name} ${staff.last_name}`);
    console.log(`   - Email: ${staff.email}`);
    console.log(`   - Location: ${req.current_location_name}`);
    console.log(`   - Coordinates: ${req.latitude.toFixed(4)}, ${req.longitude.toFixed(4)}`);
    console.log(`   - Status: ${req.status}`);
    console.log(`   - Created: ${new Date(req.created_at).toLocaleString()}`);
  });

  // Step 3: Verify requests appear in pending list
  console.log("\n📋 Step 3: Fetching pending off-premises requests...");
  const { data: pendingRequests, error: pendingError } = await supabase
    .from("pending_offpremises_checkins")
    .select(
      `
      id,
      user_id,
      current_location_name,
      latitude,
      longitude,
      accuracy,
      status,
      created_at,
      user_profiles!pending_offpremises_checkins_user_id_fkey (
        id,
        first_name,
        last_name,
        email,
        department_id
      )
    `
    )
    .eq("status", "pending")
    .order("created_at", { ascending: false });

  if (pendingError) {
    console.error("❌ Error fetching pending requests:", pendingError.message);
    return;
  }

  console.log(
    `\n✅ Found ${pendingRequests.length} pending requests in the system:`
  );
  pendingRequests.forEach((req, idx) => {
    console.log(`\n   [${idx + 1}] ${req.user_profiles.first_name} ${req.user_profiles.last_name}`);
    console.log(`       Email: ${req.user_profiles.email}`);
    console.log(`       Location: ${req.current_location_name}`);
    console.log(`       Coordinates: ${req.latitude.toFixed(4)}, ${req.longitude.toFixed(4)}`);
    console.log(`       Status: ${req.status}`);
    console.log(`       Requested: ${new Date(req.created_at).toLocaleString()}`);
  });

  // Step 4: Show what supervisors should see
  console.log("\n📋 Step 4: Supervisor Dashboard View");
  console.log("   These requests should now appear in:");
  console.log("   → Off-Premises Approvals page");
  console.log(`   → "Pending Off-Premises Check-In Requests" section`);
  console.log(`   → Total Pending: ${pendingRequests.length}\n`);

  console.log("=".repeat(60));
  console.log("\n✨ SIMULATION COMPLETE!");
  console.log("\n📝 What happened:");
  console.log("   1. Retrieved staff members from user_profiles table");
  console.log("   2. Created off-premises check-in requests in 'pending' status");
  console.log("   3. Verified requests are visible in the system");
  console.log("   4. Requests should now appear in supervisor's approval page\n");

  console.log("🔍 Next Steps:");
  console.log("   • Visit: /offpremises-approvals");
  console.log("   • You should see the pending requests with staff details");
  console.log("   • Supervisors can now approve/reject these requests");
  console.log("   • Once approved, staff can check-in from off-premises locations\n");
}

// Run simulation
simulateOffPremisesRequest();
