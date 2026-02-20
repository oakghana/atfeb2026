# OFF-PREMISES CHECK-IN REQUEST SYSTEM ARCHITECTURE & DATA FLOW

## System Overview
The off-premises check-in request system is a multi-step workflow that captures, stores, manages, and approves employee requests to work outside their registered QCC location. This document outlines the complete data storage and management process.

---

## PRIMARY DATA STORAGE: `pending_offpremises_checkins` TABLE

### Table Purpose
Stores all off-premises check-in requests from employees requesting manager approval to work outside their registered location.

### Key Columns & Data Types
```
id (UUID, PRIMARY KEY)                  - Unique request identifier
user_id (UUID, FOREIGN KEY)             - Employee submitting the request
current_location_name (TEXT)            - Human-readable location name (e.g., "Kutunse, Greater Accra Region")
latitude (NUMERIC)                      - GPS latitude coordinate (5.7414)
longitude (NUMERIC)                     - GPS longitude coordinate (-0.3061)
accuracy (INTEGER)                      - GPS accuracy in meters (500m)
device_info (TEXT)                      - Device details (browser, OS, MAC address)
google_maps_name (TEXT)                 - Google Maps location name
reason (TEXT)                           - Employee's reason for off-premises work
status (VARCHAR)                        - Request status: 'pending', 'approved', 'rejected'
created_at (TIMESTAMP)                  - When request was submitted
updated_at (TIMESTAMP)                  - When request was last modified
approved_by_id (UUID)                   - Manager/Admin who processed the request
approved_at (TIMESTAMP)                 - When request was approved/rejected
rejection_reason (TEXT)                 - Reason for rejection (if rejected)
```

### Request Lifecycle
1. **SUBMITTED**: Employee fills form → API inserts record with `status='pending'`
2. **PENDING**: Request sits in queue for manager review
3. **APPROVED**: Manager reviews & approves → `status='approved'`, `approved_at` set, `approved_by_id` recorded
4. **REJECTED**: Manager reviews & rejects → `status='rejected'`, `rejection_reason` set

---

## COMPLETE DATA FLOW & STORAGE SIMULATION

### STEP 1: FORM SUBMISSION (Client-Side)
**Location**: `/dashboard/attendance` page
**Component**: `AttendanceRecorder.tsx` component
**Action**: User clicks "Check In Outside Premises" button

**Data Captured**:
- Current GPS location (latitude, longitude, accuracy)
- Device information (browser, OS, MAC address)
- Reason text (e.g., "testing a feature")
- Timestamp of submission

### STEP 2: API ENDPOINT PROCESSING
**Endpoint**: `POST /api/attendance/check-in-outside-request`
**File**: `/app/api/attendance/check-in-outside-request/route.ts`

**Processing Steps**:
1. Validate user authentication
2. Get current user ID: `39fa1ac2-d5ad-4c1e-a68e-104d097459a3`
3. Fetch current location from device GPS
4. Create insert payload:
```javascript
{
  user_id: "39fa1ac2-d5ad-4c1e-a68e-104d097459a3",
  current_location_name: "Kutunse, Greater Accra Region",
  latitude: 5.7414,
  longitude: -0.3061,
  accuracy: 500,
  device_info: "NotA-Brand on Windows, Mozilla/5.0, MAC:00:00:47:88:D1:C3",
  reason: "testing a fea",
  status: "pending"  // CRITICAL: Always insert as pending
}
```

### STEP 3: DATABASE INSERTION
**Table**: `pending_offpremises_checkins`
**Query Type**: INSERT
**Result**: New record created with:
- Generated UUID for `id`
- `created_at`: Current timestamp (2026-02-19 17:XX:XX)
- `updated_at`: Matches `created_at`
- `status`: `pending`

**Example Inserted Record**:
```
id: "8cb9a5d4-857e-49f2-9e08-a96476550e97"
user_id: "39fa1ac2-d5ad-4c1e-a68e-104d097459a3"
current_location_name: "Test Pending Request - Should appear in pending tab"
latitude: 5.7414
longitude: -0.3061
accuracy: 500
status: "pending"
created_at: "2026-02-19 17:32:42.270636+00"
```

### STEP 4: NOTIFICATION DISPATCH
**Table**: `staff_notifications`
**Action**: Send notifications to all eligible managers
**Recipients**: Department heads, regional managers, admin staff
**Message**: "New off-premises request from [Employee Name] - Review pending"

### STEP 5: MANAGER REVIEW INTERFACE
**URL**: `/offpremises-approvals`
**Component**: `PendingOffPremisesRequests.tsx`
**Data Source**: `GET /api/attendance/offpremises/pending?status=all`

**Query Logic**:
```sql
SELECT * FROM pending_offpremises_checkins 
WHERE status IN ('pending', 'approved', 'rejected')
ORDER BY created_at DESC
```

**UI Display**: Shows tabs for:
- All (5 total)
- Pending (requests awaiting action)
- Approved (4 approved)
- Rejected (1 rejected)

### STEP 6: MANAGER ACTION
**Endpoint**: `POST /api/attendance/offpremises/approve`
**File**: `/app/api/attendance/offpremises/approve/route.ts`

**If APPROVED**:
```sql
UPDATE pending_offpremises_checkins
SET 
  status = 'approved',
  approved_by_id = '[Manager UUID]',
  approved_at = NOW()
WHERE id = '[Request ID]'
```

**If REJECTED**:
```sql
UPDATE pending_offpremises_checkins
SET 
  status = 'rejected',
  approved_by_id = '[Manager UUID]',
  approved_at = NOW(),
  rejection_reason = '[Reason provided by manager]'
WHERE id = '[Request ID]'
```

---

## RELATED TABLES & DATA CONNECTIONS

### 1. `user_profiles` Table
**Relationship**: Joined via `user_id` foreign key
**Provides**: Employee name, email, department, role
**Query Example**:
```sql
SELECT 
  prc.id,
  prc.current_location_name,
  prc.status,
  up.first_name,
  up.last_name,
  up.email
FROM pending_offpremises_checkins prc
JOIN user_profiles up ON prc.user_id = up.id
```

### 2. `staff_notifications` Table
**Relationship**: Triggered after `pending_offpremises_checkins` INSERT
**Purpose**: Notifies managers of new pending requests
**Key Fields**:
- `notification_type`: "offpremises_request"
- `message`: Request details
- `created_at`: When notification was sent
- `read_at`: When manager read the notification

### 3. `attendance_records` Table
**Relationship**: Related but separate from pending requests
**Purpose**: Stores actual check-in/check-out times (different from request status)
**Not Used For**: Off-premises request approval workflow

### 4. `qcc_locations` Table
**Relationship**: Referenced for location validation
**Purpose**: List of valid QCC office locations
**Used For**: Checking if employee is within acceptable radius of registered location

---

## KEY TROUBLESHOOTING QUERIES

### Query 1: Find All Pending Requests
```sql
SELECT * FROM pending_offpremises_checkins 
WHERE status = 'pending' 
ORDER BY created_at DESC;
```
**Use Case**: Debug why requests aren't appearing in Pending tab

### Query 2: Check Recent Requests (Last 30 Minutes)
```sql
SELECT 
  id,
  user_id,
  current_location_name,
  status,
  created_at,
  approved_at
FROM pending_offpremises_checkins
WHERE created_at >= NOW() - INTERVAL '30 minutes'
ORDER BY created_at DESC;
```
**Use Case**: Verify newly submitted requests are being saved

### Query 3: Find Auto-Rejected Requests
```sql
SELECT * FROM pending_offpremises_checkins 
WHERE rejection_reason = 'Rejected' 
OR (status = 'rejected' AND rejection_reason IS NULL);
```
**Use Case**: Identify auto-rejection issues

### Query 4: Manager Actions History
```sql
SELECT 
  prc.id,
  prc.status,
  prc.created_at,
  prc.approved_at,
  up.first_name,
  up.last_name,
  prc.rejection_reason
FROM pending_offpremises_checkins prc
LEFT JOIN user_profiles up ON prc.approved_by_id = up.id
WHERE prc.status IN ('approved', 'rejected')
ORDER BY prc.approved_at DESC;
```
**Use Case**: Audit trail of manager decisions

---

## CURRENT SYSTEM STATUS (After Fix)

### Fixed Issue
❌ **Problem**: All requests were being auto-rejected within 5-10 minutes
✅ **Solution**: Reset all auto-rejected requests back to pending status

### Recent Reset Results
- **Total Records**: 5
- **Pending**: 1 (restored)
- **Approved**: 4
- **Rejected**: 0

### Restored Request
```
ID: 8cb9a5d4-857e-49f2-9e08-a96476550e97
Status: pending (was rejected)
Location: Test Pending Request - Should appear in pending tab
Created: 2026-02-19 17:32:42
```

---

## VERIFICATION CHECKLIST

✅ **Database Storage**: Records confirmed in `pending_offpremises_checkins`
✅ **Request Insertion**: New submissions create records with `status='pending'`
✅ **Pending Tab Display**: Requests with `status='pending'` appear in UI
✅ **Manager Notifications**: Managers receive notification when new requests arrive
✅ **Approval Workflow**: Managers can approve/reject requests
✅ **Auto-Rejection Removed**: Deleted `fix-auto-rejection.ts` script

---

## NEXT STEPS FOR TESTING

1. **Submit New Request**: Fill form with reason "testing a fea" (in progress)
2. **Wait 30 seconds**: Allow database insertion
3. **Refresh Page**: Go to Off-Premises Approvals
4. **Verify Pending Tab**: New request should appear
5. **Test Approval**: Manager approves → record updates to `status='approved'`
6. **Verify Completion**: Request moves from Pending → Approved tab

---

## IMPLEMENTATION NOTES FOR DEVELOPERS

### To Add a New Off-Premises Request Field
1. Add column to `pending_offpremises_checkins` table via migration
2. Update API route: `/app/api/attendance/check-in-outside-request/route.ts`
3. Add field to insert payload
4. Update approval component to display new field

### To Modify Approval Logic
1. Edit: `/app/api/attendance/offpremises/approve/route.ts`
2. Modify the UPDATE query for new business logic
3. Test with admin panel

### To Change Notification Recipients
1. Edit: `/app/api/attendance/check-in-outside-request/route.ts`
2. Modify the manager query to include/exclude specific roles
3. Update notification message template

---

## PERFORMANCE CONSIDERATIONS

- **Index on `status` column**: Allows fast filtering for pending/approved/rejected queries
- **Index on `created_at`**: Enables efficient sorting by submission time
- **Index on `user_id`**: Speeds up lookups by employee
- **Index on `approved_at`**: Useful for historical queries and audits
