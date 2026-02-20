# Off-Premises Check-In/Check-Out Workflow - Implementation Guide

## Overview
This guide covers the redesigned off-premises attendance workflow that enables proper tracking of supervisor approval requests and ensures only one checkout button is displayed at any time.

## What Has Been Implemented

### 1. Database Schema Updates ✓
**File**: `scripts/043_add_offpremises_workflow_columns.sql`

Added columns to `attendance_records` table:
- `off_premises_request_id` - Links to the pending_offpremises_checkins record
- `approval_status` - Tracks: 'pending_supervisor_approval', 'approved_offpremises', 'normal_checkin'
- `supervisor_approval_remarks` - Stores supervisor comments and approval details
- `on_official_duty_outside_premises` - Boolean flag for off-premises duty status

### 2. API Endpoints Created/Modified ✓

#### Check-In Outside Request API
**File**: `app/api/attendance/check-in-outside-request/route.ts`
- Creates pending_offpremises_checkins record with status='pending'
- **NEW**: Creates temporary attendance_records entry with approval_status='pending_supervisor_approval'
- Sends notifications to all managers (admin, regional_manager, department_head)
- Returns pending_approval: true to client

#### Off-Premises Checkout API
**File**: `app/api/attendance/offpremises-checkout/route.ts` (NEW)
- Validates user has approved off-premises check-in (approval_status='approved_offpremises')
- Updates attendance record with check_out_time and work_hours
- Maintains off-premises markers in database

#### Approval API
**File**: `app/api/attendance/offpremises/approve/route.ts`
- **UPDATED**: Now updates temporary attendance record instead of creating new one
- On approval:
  - Sets approval_status='approved_offpremises'
  - Sets on_official_duty_outside_premises=true
  - Adds supervisor remarks
  - Sends notification to user
- On rejection:
  - Deletes temporary attendance record
  - Sets pending_offpremises_checkins.status='rejected'
  - Sends rejection notification to user

#### QR Checkout API
**File**: `app/api/attendance/qr-checkout/route.ts`
- **UPDATED**: Added validation to prevent checkout if pending off-premises request exists
- Returns error: "Cannot check out - Off-premises request pending approval"

### 3. UI Components Created ✓

#### Smart Checkout Button
**File**: `components/attendance/smart-checkout-button.tsx`

Shows ONLY ONE button based on approval status:
- **If approved off-premises AND not at QCC**: Shows purple "Check Out Off-Premises" button
- **If normal check-in OR off-premises not approved**: Shows red "Check Out" button
- **If pending approval**: Shows disabled "Pending Supervisor Review" button
- **Never shows both buttons simultaneously**

#### Off-Premises Status Badge
**File**: `components/attendance/off-premises-status-badge.tsx`

Displays status alerts:
- **Pending Review (Amber)**: "Your off-premises request is being reviewed. You are temporarily checked in."
- **Approved (Green)**: "Your off-premises request has been approved. You are checked in on official duty."

### 4. Enhanced Attendance Recorder
**File**: `components/attendance/attendance-recorder.tsx`

Updates:
- Added approval_status to component interface
- Added on_official_duty_outside_premises flag
- Added off_premises_request_id link
- Added handleOffPremisesCheckout function
- Smart checkout button logic integrated

## Workflow Steps

### Step 1: User Submits Off-Premises Request
1. User fills form with reason and location
2. API creates:
   - `pending_offpremises_checkins` record with status='pending'
   - `attendance_records` record with approval_status='pending_supervisor_approval'
3. Attendance page shows: **"Off-Premises Request Submitted - Awaiting Supervisor Review"**
4. Managers receive notifications

### Step 2: Attendance Page Display
User sees:
- Amber status badge: "Pending Supervisor Review"
- Disabled checkout button: "Pending Supervisor Review"
- Message: "Your off-premises request is awaiting approval"
- No checkout functionality available

### Step 3: Supervisor Reviews Request
Manager goes to Off-Premises Approvals page:
- Sees pending request with employee details
- Can approve or reject

### Step 4A: Request Approved
1. Supervisor clicks "Approve"
2. API updates existing attendance_records:
   - approval_status → 'approved_offpremises'
   - on_official_duty_outside_premises → true
   - supervisor_approval_remarks → populated
3. User receives notification: "Your off-premises request has been approved"
4. Attendance page updates:
   - Green status badge: "Off-Premises Approved"
   - Smart checkout button appears:
     - If user is NOT at QCC: Purple "Check Out Off-Premises" button
     - If user IS at QCC: Red normal "Check Out" button

### Step 4B: Request Rejected
1. Supervisor clicks "Reject" with reason
2. API:
   - Deletes temporary attendance_records entry
   - Updates pending_offpremises_checkins: status='rejected'
3. User receives notification: "Your request was rejected. Reason: ..."
4. No attendance record remains for today

### Step 5: User Checks Out
Based on approval status:
- **If approved off-premises AND away from QCC**: Calls `/api/attendance/offpremises-checkout`
- **If normal check-in**: Calls existing checkout endpoint
- Both buttons can NOT appear together
- Work hours calculated automatically

## Data Flow Diagram

```
User Submits Request
    ↓
[pending_offpremises_checkins] status='pending'
[attendance_records] approval_status='pending_supervisor_approval' (TEMPORARY)
    ↓
Manager Notification
    ↓
Manager Reviews + Approves
    ↓
[pending_offpremises_checkins] status='approved' ✓
[attendance_records] approval_status='approved_offpremises' (UPDATED)
    ↓
User Sees: Green Badge + Checkout Button
    ↓
User Checks Out
    ↓
[attendance_records] check_out_time + work_hours recorded
    ✓ Complete
```

## Tables Involved

### pending_offpremises_checkins
- Stores all off-premises requests
- Statuses: pending, approved, rejected

### attendance_records
- Stores attendance history
- Linked to off-premises request via `off_premises_request_id`
- approval_status tracks workflow state
- temporary records created during pending phase

### staff_notifications
- Notifications to managers for new requests
- Notifications to users for approval/rejection

## Key Features

✓ **Single Checkout Button**: Never shows multiple checkout buttons
✓ **Temporary Check-In**: User shows as checked in while awaiting approval
✓ **Clear Status**: Users always see approval status
✓ **Smart Logic**: Checkout button type depends on location and approval
✓ **No Data Loss**: Records created immediately, preserved or deleted based on decision
✓ **Full Audit Trail**: All actions tracked with remarks and timestamps

## Testing

Run the test queries in `OFF_PREMISES_WORKFLOW_TEST_QUERIES.sql` to verify:
1. Database schema correctly added
2. Requests create temporary attendance records
3. Approvals update attendance records properly
4. Status tracking works end-to-end
5. Notifications are sent correctly

## Integration with Existing Pages

To use these components, update your attendance pages to:

```tsx
import { SmartCheckoutButton } from "@/components/attendance/smart-checkout-button"
import { OffPremisesStatusBadge } from "@/components/attendance/off-premises-status-badge"

// In your component:
<OffPremisesStatusBadge 
  approvalStatus={todayAttendance?.approval_status}
  requestLocation={todayAttendance?.check_in_location_name}
  onOfficialDuty={todayAttendance?.on_official_duty_outside_premises}
/>

<SmartCheckoutButton 
  attendanceRecord={todayAttendance}
  isAtQCCLocation={locationValidation?.canCheckOut}
  isLoading={isLoading}
  onCheckOut={handleCheckOut}
  onOffPremisesCheckOut={handleOffPremisesCheckout}
  userLocation={userLocation}
/>
```

## Troubleshooting

**Issue**: Checkout button shows "Pending" even after approval
- **Solution**: Verify attendance_records was updated (not created new). Check approval_status column.

**Issue**: Both checkout buttons showing
- **Solution**: Check SmartCheckoutButton logic. Ensure isAtQCCLocation prop is correctly calculated.

**Issue**: Temporary attendance record not created
- **Solution**: Verify database migration ran. Check if columns exist: `ALTER TABLE attendance_records ADD COLUMN ...`

**Issue**: Notifications not received
- **Solution**: Check staff_notifications table. Verify manager roles are set correctly (admin, regional_manager, department_head).

## Future Enhancements

- Batch approval/rejection of multiple requests
- Recurring off-premises requests
- Geographic boundaries for off-premises locations
- Mobile app integration for off-premises checkout
- Automatic reminders for pending requests
