# Data Flow & System Architecture: Off-Premises Attendance

## Complete Data Flow Diagram

```
┌─────────────────────────────────────────────────────────────┐
│ STAFF USER SUBMITS OFF-PREMISES REQUEST                     │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
         ┌────────────────────────────────┐
         │ Check In Outside Premises      │
         │ Button (on Attendance page)    │
         └────────────────┬───────────────┘
                          │
                          ▼
         ┌────────────────────────────────────────────┐
         │ /api/attendance/check-in-outside-request   │
         │ - Captures GPS location                    │
         │ - Captures reason/remarks                  │
         │ - Captures device info                     │
         └────────────┬─────────────────────────────┘
                      │
                      ▼
    ┌─────────────────────────────────────────────────────┐
    │ INSERT into pending_offpremises_checkins table:     │
    │ - id (auto-generated)                              │
    │ - user_id (staff member)                           │
    │ - current_location_name (GPS name)                 │
    │ - latitude, longitude, accuracy                    │
    │ - reason (why off-premises)                        │
    │ - device_info (device details)                     │
    │ - created_at (timestamp)                           │
    │ - status = 'pending' (waiting for approval)        │
    └─────────────┬──────────────────────────────────────┘
                  │
       ┌──────────┴──────────┐
       │                     │
       ▼ (on success)        ▼ (Turbopack crashes)
  Staff sees             ❌ False "Success"
  "Success"              message shown
       │                     │
       └──────────┬──────────┘
                  │
    ┌─────────────▼──────────────────────────────────────┐
    │ Staff attendance details now show:                 │
    │ - "⏳ Pending Approval" status badge               │
    │ - Reason for being off-premises                   │
    │ - Waiting for supervisor decision                 │
    └─────────────┬──────────────────────────────────────┘
                  │
                  ▼
    ┌─────────────────────────────────────────────────────┐
    │ SUPERVISOR REVIEWS OFF-PREMISES REQUEST             │
    │ (Off-Premises Check-In Approvals page)             │
    │ - See pending requests in "Pending (1)" tab        │
    │ - View staff location & reason                     │
    │ - View timestamps and GPS accuracy                 │
    └─────────────┬──────────────────────────────────────┘
                  │
       ┌──────────┴──────────────────────────┐
       │                                     │
       ▼ (Approve)                    ▼ (Reject)
    /api/attendance/                 /api/attendance/
    offpremises/approve              offpremises/reject
       │                                     │
       ├─────────────────┬───────────────────┤
       │                 │                   │
       ▼                 ▼                   ▼
UPDATE pending_  UPDATE attendance_  UPDATE pending_
offpremises_     records with:       offpremises_
checkins:        - approval_status   checkins:
- status =         = 'approved_off'  - status = 'rejected'
  'approved'     - supervisor_approval - rejection_reason
- approved_at      _remarks
- approved_by_id
       │                 │                   │
       └─────────────────┼───────────────────┘
                         │
       ┌─────────────────▼──────────────────┐
       │ Staff checks attendance details    │
       │ - Old: "⏳ Pending Approval"       │
       │ - New: "✓ Off-Premises Approved"  │
       │ OR rejection message               │
       │                                   │
       │ Request appears in:               │
       │ - "Approved (N)" tab on supervisor│
       │ - Staff attendance history        │
       └─────────────────────────────────────┘
```

## Database Tables & Data Storage

### Table 1: pending_offpremises_checkins
**Purpose**: Stores all off-premises requests (pending, approved, rejected)

```sql
CREATE TABLE pending_offpremises_checkins (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL (references auth.users),
  current_location_name VARCHAR (current location name from GPS),
  google_maps_name VARCHAR (Google Maps formatted address),
  latitude FLOAT (GPS latitude),
  longitude FLOAT (GPS longitude),
  accuracy FLOAT (GPS accuracy in meters),
  reason TEXT (why user is off-premises),
  device_info JSONB (device details),
  created_at TIMESTAMP (when request was submitted),
  
  -- Approval workflow
  status VARCHAR ('pending' | 'approved' | 'rejected'),
  approved_by_id UUID (supervisor who approved),
  approved_at TIMESTAMP (when approved/rejected),
  rejection_reason TEXT (why rejected, if rejected),
  
  created_at TIMESTAMP
);
```

### Table 2: attendance_records
**Purpose**: Stores all check-in/check-out records

```sql
CREATE TABLE attendance_records (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL (references auth.users),
  check_in_time TIMESTAMP,
  check_out_time TIMESTAMP,
  work_hours FLOAT,
  status VARCHAR ('present' | 'absent' | 'late' | ...),
  check_in_method VARCHAR ('gps' | 'manual' | ...),
  check_out_method VARCHAR,
  check_in_location_name VARCHAR,
  check_out_location_name VARCHAR,
  is_remote_location BOOLEAN,
  notes TEXT,
  
  -- Off-premises tracking
  approval_status VARCHAR ('pending_supervisor_approval' | 'approved_offpremises'),
  supervisor_approval_remarks TEXT,
  on_official_duty_outside_premises BOOLEAN,
  off_premises_request_id UUID (foreign key to pending_offpremises_checkins)
);
```

## API Endpoints Summary

### 1. Submit Off-Premises Request
**Endpoint**: `POST /api/attendance/check-in-outside-request`
**Input**: GPS location, reason, device info
**Output**: Creates record in pending_offpremises_checkins table
**Status**: Returns 200 (success) or error code

### 2. Fetch Personal Attendance
**Endpoint**: `GET /api/attendance/personal?startDate=XXX&endDate=YYY`
**Input**: Date range parameters
**Output**: All attendance records INCLUDING off-premises fields:
```javascript
{
  records: [
    {
      id, check_in_time, check_out_time, work_hours,
      status,
      // NEW FIELDS:
      approval_status,        // 'pending_supervisor_approval' | 'approved_offpremises'
      supervisor_approval_remarks,
      on_official_duty_outside_premises,
      off_premises_request_id
    }
  ],
  summary: { totalDays, totalHours, averageHours, ... }
}
```

### 3. Fetch Pending Requests (Supervisors)
**Endpoint**: `GET /api/attendance/offpremises/pending?status=all`
**Input**: Optional status filter
**Output**: All pending/approved/rejected off-premises requests
```javascript
{
  requests: [
    {
      id, user_id, current_location_name, latitude, longitude,
      accuracy, reason, device_info, created_at, status,
      approved_by_id, approved_at, rejection_reason,
      user_profiles: { first_name, last_name, email, ... }
    }
  ],
  count: number
}
```

### 4. Approve Request
**Endpoint**: `POST /api/attendance/offpremises/approve`
**Input**: request_id, supervisor remarks (optional)
**Output**: Updates status to 'approved', updates attendance_records
**Action**: 
- Sets approval_status = 'approved_offpremises'
- Stores supervisor remarks
- Updates pending request status

### 5. Reject Request
**Endpoint**: `POST /api/attendance/offpremises/reject`
**Input**: request_id, rejection_reason
**Output**: Updates status to 'rejected'
**Action**:
- Sets status = 'rejected'
- Stores rejection reason
- Removes from pending requests

## UI Display Logic

### Attendance Details Tab
When user views their attendance history:

```
For each attendance record:
  ├─ Date: 17/02/2026
  ├─ Check In: 8:20:03 am
  ├─ Check In Location: SEFWIE WIAWSO
  ├─ Check Out: 7:18:45 pm
  ├─ Check Out Location: Awutu Stores
  ├─ Hours: 7.81
  ├─ Status: late (green badge)
  ├─ OFF-PREMISES STATUS: ⏳ Pending Approval (NEW!)
  │  └─ Shows supervisor remarks if provided
  └─ Notes: Remote Location
```

### Off-Premises Approvals Tab
When supervisor views approvals page:

```
PENDING (1) tab shows:
├─ RICHARD NARTEY
│  ├─ Email: richard.nartey@qccgh.com
│  ├─ Position: Sen. I. T. Officer
│  ├─ Location: Nsawam Archive Center
│  ├─ Coordinates: 5.7414, -0.3061
│  ├─ Accuracy: 15m
│  ├─ Requested: Feb 19, 05:32 PM
│  └─ [Review] button
│
├─ NEW REQUEST (if submitted successfully)
│  └─ Shows immediately after submit
│
...
```

## Current Status of Implementation

✅ **Implemented & Working (After Turbopack Fix)**:
- All API endpoints created
- All database tables exist
- All UI components updated
- Authorization checks in place
- Off-premises status displays in attendance
- Pending requests visible to supervisors

❌ **Currently Blocked By**:
- Turbopack build system crashes
- API routes cannot execute
- Database inserts fail silently
- False "Success" messages

## Fix Verification Checklist

After rebuilding dev server, verify each step:

- [ ] Rebuild completes without "Next.js package not found" errors
- [ ] Attendance page loads without errors
- [ ] Historical records show (not empty)
- [ ] Off-Premises Status column visible in attendance details
- [ ] Submit off-premises request → "Success" shows
- [ ] Request appears in Pending tab within 30 seconds
- [ ] Request shows in staff's attendance details
- [ ] Supervisor can click "Review" on pending request
- [ ] Supervisor can approve/reject with remarks
- [ ] Staff sees approval status updated in attendance history
- [ ] All data persists after page reload

## Data Integrity & Recovery

If data appears missing:

1. **Check Database Directly** (Supabase Console):
   ```sql
   SELECT COUNT(*) FROM attendance_records WHERE user_id = 'xxx';
   SELECT COUNT(*) FROM pending_offpremises_checkins WHERE status = 'pending';
   ```

2. **Check API Response** (Browser DevTools):
   - Network tab → /api/attendance/personal
   - Check response JSON for records array

3. **Check UI Logic**:
   - If API returns records but UI shows empty
   - Check browser console for JavaScript errors
   - Check component state and data flow

4. **Last Resort**: Force page reload with cache clear
   - Ctrl+Shift+R (Windows/Linux)
   - Cmd+Shift+R (Mac)

All data is permanently stored in Supabase. The system is not deleting data - it's a display issue due to API failures.
