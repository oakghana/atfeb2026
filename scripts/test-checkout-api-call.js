import fetch from "node-fetch";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000";
const USER_ID = "8f23ae6a-8933-4594-ae41-f19a5c683284";
const RECORD_ID = "3c7e2c1d-f0ef-4161-80af-8af24ade9f0e";

async function testCheckoutAPI() {
  console.log("\n[v0] ========== TESTING CHECKOUT API ENDPOINT ==========\n");

  try {
    // Test 1: In-range checkout (Cocobod Archives location)
    console.log("[v0] TEST 1: In-Range Checkout (At Cocobod Archives)");
    console.log("[v0] Location: Lat 5.5627, Lng -0.2019\n");

    const inRangePayload = {
      recordId: RECORD_ID,
      latitude: 5.5627,
      longitude: -0.2019,
      accuracy: 10,
      checkoutMethod: "gps",
    };

    console.log("[v0] Sending payload:", JSON.stringify(inRangePayload, null, 2));

    const inRangeResponse = await fetch(`${API_URL}/api/attendance/check-out`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(inRangePayload),
    });

    console.log(`[v0] Response Status: ${inRangeResponse.status}`);

    const inRangeData = await inRangeResponse.json();
    console.log("[v0] Response Body:", JSON.stringify(inRangeData, null, 2));

    if (inRangeResponse.ok) {
      console.log("[v0] ✅ API returned success for in-range checkout");
    } else {
      console.log("[v0] ❌ API returned error for in-range checkout");
      if (inRangeData.dbError) {
        console.log("[v0] DB Error:", inRangeData.dbError);
      }
    }

    // Test 2: Out-of-range checkout
    console.log("\n[v0] TEST 2: Out-of-Range Checkout (Far from any location)");
    console.log("[v0] Location: Lat 5.5000, Lng -0.3000 (different area)\n");

    const outOfRangePayload = {
      recordId: RECORD_ID,
      latitude: 5.5,
      longitude: -0.3,
      accuracy: 50,
      checkoutMethod: "gps",
    };

    console.log("[v0] Sending payload:", JSON.stringify(outOfRangePayload, null, 2));

    const outOfRangeResponse = await fetch(`${API_URL}/api/attendance/check-out`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(outOfRangePayload),
    });

    console.log(`[v0] Response Status: ${outOfRangeResponse.status}`);

    const outOfRangeData = await outOfRangeResponse.json();
    console.log("[v0] Response Body:", JSON.stringify(outOfRangeData, null, 2));

    if (outOfRangeResponse.ok) {
      console.log("[v0] ✅ API returned success for out-of-range checkout");
    } else {
      console.log("[v0] ❌ API returned error for out-of-range checkout");
      if (outOfRangeData.dbError) {
        console.log("[v0] DB Error:", outOfRangeData.dbError);
      }
    }

    console.log("\n[v0] ========== API TEST COMPLETE ==========\n");
  } catch (error) {
    console.error("[v0] Test Error:", error.message);
    process.exit(1);
  }
}

testCheckoutAPI();
