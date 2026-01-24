# QCC Attendance - OUT OF RANGE CHECKOUT SIMULATION

## Scenario
A staff member (e.g., MRS Rose Manu) attempts to check out while being **OUT OF RANGE** of their assigned location.

---

## EXPECTED FLOW (Current Implementation)

### Stage 1: UI State (canCheckOutButton Logic)
**Location:** `components/attendance/attendance-recorder.tsx` Line 307-313

\`\`\`javascript
const canCheckOutButton =
  (initialCanCheckOut ?? true) &&          // ✓ Checkout enabled in settings
  !recentCheckOut &&                       // ✓ Not checked out recently
  !!localTodayAttendance?.check_in_time && // ✓ Has checked in today
  !localTodayAttendance?.check_out_time && // ✓ Not already checked out
  !isOnLeave &&                            // ✓ Not on leave
  locationValidation?.canCheckOut === true // ❌ USER IS OUT OF RANGE = FALSE
\`\`\`

**Expected Result:** 
- `canCheckOutButton = FALSE`
- **"Check Out Now" button is DISABLED (greyed out)**
- Button rendered with `disabled={!canCheckOutButton}`

### Stage 2: Location Badge Display
**Location:** `components/attendance/location-preview-card.tsx`

The badge shows proximity status using **checkout radius** (not check-in radius):
- User distance: 292 meters
- Device checkout radius: 1000 meters (desktop)
- **Distance ≤ Radius?** 292 ≤ 1000 = **TRUE** ✓ Within range

**BUT if user is 160km away:**
- User distance: 160,286 meters
- Device checkout radius: 1000 meters
- **Distance ≤ Radius?** 160,286 ≤ 1000 = **FALSE** ❌ **OUT OF RANGE**

Badge displays: **🔴 "Out of Range"**

### Stage 3: User Clicks "Check Out Now"
Since button is disabled, click doesn't work.
- No API call is made
- No modal appears
- User sees visual feedback that button is inactive

---

## IF USER BYPASSES UI (via Browser DevTools)

If someone manually enables the button via DevTools, the server-side validation kicks in:

### Stage 4: Server-Side Location Validation
**Location:** `app/api/attendance/check-out/route.tsx` Line 316

The backend ALSO validates location independently:

\`\`\`typescript
if (!validation.canCheckOut) {
  return NextResponse.json(
    {
      error: `You are currently out of range. Check-out requires being within range of your assigned QCC location...`,
    },
    { status: 400 },
  )
}
\`\`\`

**Expected Result:**
- API returns **400 Bad Request**
- Error message: "You are currently out of range..."
- Checkout is **REJECTED** even if button was forced

---

## FLOW WITH handleCheckOut Function

**Location:** `components/attendance/attendance-recorder.tsx` Line 1023+

### Step 1: Initial Validation (Line 1065-1083)
\`\`\`javascript
const checkoutValidation = validateCheckoutLocation(locationData, realTimeLocations || [], checkOutRadius)

if (!checkoutValidation.canCheckOut) {
  console.log("[v0] Location validation failed - user out of range:", checkoutValidation.message)
  throw new Error(checkoutValidation.message)
}
\`\`\`

**If OUT OF RANGE:**
- ❌ `canCheckOut = false`
- ❌ Error thrown immediately
- ❌ Code execution stops at line 1082 `return`
- ❌ Flash message displayed: "You must be within 100 meters of a QCC location to check out"
- ❌ Modal never appears
- ❌ Early checkout logic is skipped

### Step 2: Time Validation (Line 1085-1107)
Only reached if location validation passes.
- Checks if before checkout end time
- If yes AND early checkout reason required → shows modal

### Step 3: Early Checkout Modal (Line 1110+)
If showing early checkout modal, **RE-VALIDATES LOCATION** (Line 1131-1138):

\`\`\`javascript
const earlyCheckoutLocationValidation = validateCheckoutLocation(locationData, realTimeLocations || [], checkOutRadius)
if (!earlyCheckoutLocationValidation.canCheckOut) {
  throw new Error(`You are out of range. ${earlyCheckoutLocationValidation.message}`)
}
\`\`\`

**Protection Layer 2:** Even if somehow time check passed, location is checked AGAIN before modal.

---

## validateCheckoutLocation Function

**Location:** `lib/geolocation.ts` Line 621-696

### Input
\`\`\`javascript
validateCheckoutLocation(
  userLocation,      // { latitude, longitude, accuracy }
  qccLocations,      // Array of QCC office locations
  checkOutRadius     // 1000 (meters for desktop)
)
\`\`\`

### Processing
1. Finds nearest QCC location
2. Calculates distance using Haversine formula
3. Compares: `distance ≤ checkOutRadius?`
4. If accuracy is poor (>100m), adds warning

### Output (OUT OF RANGE)
\`\`\`javascript
{
  canCheckOut: false,
  distance: 160286,           // meters to nearest location
  nearestLocation: {
    name: "HEAD OFFICE SWANZY ARCADE",
    distance: 160286
  },
  message: "You must be within 100 meters of a QCC location to check out",
  accuracyWarning: "GPS accuracy is low (160286m)..."
}
\`\`\`

---

## Complete Timeline: User OUT OF RANGE

| Step | Component | Action | State | Result |
|------|-----------|--------|-------|--------|
| 1 | LocationPreviewCard | Calculate distance | 160286m | 🔴 Out of Range |
| 2 | AttendanceRecorder | Calculate `canCheckOutButton` | locationValidation.canCheckOut = false | Button DISABLED |
| 3 | UI | Render button | disabled=true | Button appears greyed out |
| 4 | User | Tries to click button | Event handlers ignored | No response |
| 5 | If DevTools bypass | handleCheckOut() called | Early location validation (line 1068-1083) | ❌ Error thrown |
| 6 | handleCheckOut catch | Error caught | Flash message shown | "You must be within 100 meters..." |
| 7 | - | Function returns | No API call made | Checkout BLOCKED |

---

## Current Code Validations (3 Layers of Protection)

### Layer 1: Button State (Client-Side UI)
✅ **ACTIVE** - Line 307-313 in attendance-recorder.tsx
- `canCheckOutButton` checks `locationValidation?.canCheckOut === true`
- Button disabled when false

### Layer 2: handleCheckOut First Check (Client-Side Logic)
✅ **ACTIVE** - Line 1068-1083 in attendance-recorder.tsx
- Validates location BEFORE any other logic
- Throws error if out of range
- No modal shown if location fails

### Layer 3: Early Checkout Modal Check (Client-Side Modal Logic)
✅ **ACTIVE** - Line 1131-1138 in attendance-recorder.tsx
- RE-validates location before showing early checkout modal
- Ensures user can't request early checkout if out of range

### Layer 4: Server-Side Validation (API)
✅ **ACTIVE** - Line 316 in check-out/route.tsx
- Backend independently validates location
- Returns 400 error if out of range
- No database record created

---

## Expected Behavior Summary

**When User is OUT OF RANGE:**

| Element | State | Visual |
|---------|-------|--------|
| Location Badge | ❌ Out of Range | 🔴 Red badge |
| Check Out Button | ❌ DISABLED | ⚫ Greyed out, not clickable |
| Modal Popup | ❌ Does NOT appear | - |
| Error Message | ✓ Shows immediately | "You must be within 100m..." |
| API Call | ❌ Never made | - |
| Checkout Recorded | ❌ NOT recorded | - |

---

## Testing Verification

To verify this works correctly, test these scenarios:

1. **Good GPS, Within Range**
   - ✓ Badge shows "Within Range" (green)
   - ✓ Check Out button ENABLED
   - ✓ Clicking works as expected

2. **Poor GPS, Out of Range**
   - ✓ Badge shows "Out of Range" (red)
   - ✓ Check Out button DISABLED
   - ✓ Error shown if forced via DevTools

3. **Time-based: Before Checkout Time, Within Range**
   - ✓ Badge shows "Within Range"
   - ✓ Button ENABLED
   - ✓ Modal appears asking for early checkout reason

4. **Time-based: Before Checkout Time, Out of Range**
   - ✓ Badge shows "Out of Range"
   - ✓ Button DISABLED
   - ✓ Error shown: "You must be within 100 meters..."
   - ✓ Modal does NOT appear

5. **Time-based: After Checkout Time, Out of Range**
   - ✓ Badge shows "Out of Range"
   - ✓ Button DISABLED
   - ✓ Error shown (no bypass based on time)
   - ✓ Location validation happens FIRST, before time check
