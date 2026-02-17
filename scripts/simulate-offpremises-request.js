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
    console.log("\n📋 Step 1: Fetching staff members...");
    const { data: staffMembers, error: staffError } = await supabase
      .from("staff_members")
      .select("id, name, email, department, supervisor_id")
      .limit(3);

    if (staffError) {
      console.error("❌ Error fetching staff:", staffError.message);
      return;
    }

    if (!staffMembers || staffMembers.length === 0) {
      console.log("ℹ️  No staff members found. Creating test staff data first...");

      // Create test staff
      const testStaff = [
        {
          name: "John Kwaku",
          email: "john.kwaku@qcc.org.gh",
          department: "IT",
          position: "Software Developer",
          supervisor_id: null,
        },
        {
          name: "Ama Serwaa",
          email: "ama.serwaa@qcc.org.gh",
          department: "HR",
          position: "HR Manager",
          supervisor_id: null,
        },
        {
          name: "Kofi Mensah",
          email: "kofi.mensah@qcc.org.gh",
          department: "Finance",
          position: "Finance Officer",
          supervisor_id: null,
        },
      ];

      const { data: createdStaff, error: createError } = await supabase
        .from("staff_members")
        .insert(testStaff)
        .select();

      if (createError) {
        console.error("❌ Error creating test staff:", createError.message);
        return;
      }

      console.log(
        `✅ Created ${createdStaff.length} test staff members`,
        createdStaff
      );

      // Now create off-premises requests for these staff
      await createOffPremisesRequests(createdStaff);
    } else {
      console.log(`✅ Found ${staffMembers.length} staff members`);
      staffMembers.forEach((staff, idx) => {
        console.log(
          `   ${idx + 1}. ${staff.name} (${staff.email}) - ${staff.department}`
        );
      });

      // Create off-premises requests for existing staff
      await createOffPremisesRequests(staffMembers);
    }
  } catch (error) {
    console.error("❌ Simulation error:", error);
  }
}

async function createOffPremisesRequests(staffMembers) {
  console.log("\n📋 Step 2: Creating off-premises check-in requests...");

  const requests = staffMembers.map((staff) => ({
    user_id: staff.id,
    staff_id: staff.id,
    staff_name: staff.name,
    staff_email: staff.email,
    department: staff.department,
    requested_date: new Date().toISOString().split("T")[0],
    reason: "Business meeting with client outside office",
    location: "Accra Central Business District",
    expected_checkin_time: new Date(
      Date.now() + 2 * 60 * 60 * 1000
    ).toISOString(),
    status: "pending",
    supervisor_id: staff.supervisor_id,
    created_at: new Date().toISOString(),
  }));

  const { data: createdRequests, error: requestError } = await supabase
    .from("offpremises_checkin_requests")
    .insert(requests)
    .select();

  if (requestError) {
    console.error("❌ Error creating requests:", requestError.message);
    return;
  }

  console.log(`✅ Created ${createdRequests.length} off-premises requests:`);
  createdRequests.forEach((req, idx) => {
    console.log(`\n   Request ${idx + 1}:`);
    console.log(`   - Staff: ${req.staff_name} (${req.staff_email})`);
    console.log(`   - Department: ${req.department}`);
    console.log(`   - Reason: ${req.reason}`);
    console.log(`   - Location: ${req.location}`);
    console.log(`   - Status: ${req.status}`);
    console.log(`   - Expected Check-in: ${req.expected_checkin_time}`);
  });

  // Step 3: Verify requests appear in pending list
  console.log("\n📋 Step 3: Fetching pending off-premises requests...");
  const { data: pendingRequests, error: pendingError } = await supabase
    .from("offpremises_checkin_requests")
    .select(
      `
      id,
      staff_name,
      staff_email,
      department,
      reason,
      location,
      expected_checkin_time,
      status,
      requested_date,
      created_at
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
    console.log(`\n   [${idx + 1}] ${req.staff_name}`);
    console.log(`       Email: ${req.staff_email}`);
    console.log(`       Department: ${req.department}`);
    console.log(`       Reason: ${req.reason}`);
    console.log(`       Location: ${req.location}`);
    console.log(`       Expected Check-in: ${req.expected_checkin_time}`);
    console.log(`       Status: ${req.status}`);
  });

  // Step 4: Show what supervisors should see
  console.log("\n📋 Step 4: Supervisor Dashboard View");
  console.log("   These requests should now appear in:");
  console.log("   → /offpremises-approvals");
  console.log(`   → "Pending Off-Premises Check-In Requests" section`);
  console.log(`   → Count: ${pendingRequests.length} Pending\n`);

  console.log("=" * 60);
  console.log("\n✨ SIMULATION COMPLETE!");
  console.log("\n📝 What happened:");
  console.log("   1. Created sample staff members (if needed)");
  console.log("   2. Created off-premises check-in requests");
  console.log("   3. Verified requests are in 'pending' status");
  console.log("   4. Requests should now appear in supervisor's approval page\n");

  console.log("🔍 Next Steps:");
  console.log("   • Visit: https://qccqrcode.qccpf.com/offpremises-approvals");
  console.log("   • You should see the pending requests with staff details");
  console.log("   • Supervisors can approve/reject requests");
  console.log("   • Once approved, staff can check-in from off-premises\n");
}

// Run simulation
simulateOffPremisesRequest();
