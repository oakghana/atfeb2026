# Off-Premises Check-In/Check-Out Workflow Analysis

## Overview
The off-premises workflow allows staff to request approval to check-in/check-out from locations outside their assigned workplace. This is particularly useful for remote workers, field staff, or those working temporarily at different locations.

## Database Tables

### 1. `pending_offpremises_checkins` (Main Request Table)
This table stores all off-premises check-in/check-out requests awaiting approval.

**Schema:**
```sql
CREATE TABLE public.pending_offpremises_checkins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES user_profiles(id),
  current_location_name TEXT NOT NULL,
  latitude FLOAT8 NOT NULL,
  longitude FLOAT8 NOT NULL,
  accuracy FLOAT8,
  device_info TEXT,
  request_type TEXT DEFAULT 'checkin' -- 'checkin' or 'checkout'
  reason TEXT,
  google_maps_name TEXT,
  status TEXT DEFAULT 'pending' -- 'pending', 'approved', 'rejected'
  approved_by_id UUID REFERENCES user_profiles(id),
  approved_at TIMESTAMP WITH TIME ZONE,
  rejection_reason TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

INDEXES:
- idx_pending_offpremises_user_id
- idx_pending_offpremises_status
- idx_pending_offpremises_created_at
- idx_pending_offpremises_request_type
- idx_pending_offpremises_google_maps_name
```

**Key Fields:**
- `user_id`: Employee requesting the off-premises check-in/out
- `current_location_name`: Name of the location where they want to check in/out
- `latitude/longitude`: GPS coordinates of the location
- `request_type`: Type of request - 'checkin' or 'checkout'
- `reason`: Optional reason for the off-premises request
- `status`: Current status of the request
- `approved_by_id`: ID of the manager who approved it
- `approved_at`: Timestamp when approved

---

## Workflow Steps

### STEP 1: Employee Initiates Off-Premises Request
**API Endpoint:** `POST /api/attendance/check-in-outside-request`

**Flow:**
1. Employee is at a location outside their assigned workplace
2. Employee clicks "Check In From Outside" button
3. App captures:
   - Current GPS location (latitude, longitude, accuracy)
   - Device information
   - Reason for being outside (optional)
   - Request type: 'checkin' or 'checkout'

**Request Body:**
```json
{
  "user_id": "372eba9d-6515-4df1-8160-bfba99af197c",
  "current_location": {
    "name": "Coffee Shop",
    "latitude": -31.854696,
    "longitude": 116.00816,
    "accuracy": 30,
    "display_name": "Starbucks on Main St"
  },
  "device_info": {...},
  "reason": "Client meeting at downtown office",
  "request_type": "checkin"
}
```

**Database Action:**
- Insert new record into `pending_offpremises_checkins` with status='pending'

**Example Record Created:**
```json
{
  "id": "abc123...",
  "user_id": "372eba9d-6515-4df1-8160-bfba99af197c",
  "current_location_name": "Coffee Shop",
  "latitude": -31.854696,
  "longitude": 116.00816,
  "accuracy": 30,
  "device_info": "...",
  "request_type": "checkin",
  "reason": "Client meeting at downtown office",
  "google_maps_name": "Starbucks on Main St",
  "status": "pending",
  "approved_by_id": null,
  "approved_at": null,
  "created_at": "2026-02-21T10:30:00Z",
  "updated_at": "2026-02-21T10:30:00Z"
}
```

**Notifications Sent:**
- Email notifications to all managers (admins, regional_managers, department_heads)
- Staff notifications in the system

---

### STEP 2: Manager Reviews and Approves/Rejects Request
**API Endpoint:** `POST /api/attendance/offpremises/approve`

**Manager Dashboard shows:**
- Employee name and ID
- Requested location (map + coordinates)
- Reason provided
- Request type (check-in or check-out)
- GPS accuracy information

**Approval/Rejection:**
- Manager can approve with comments
- Manager can reject with rejection reason

**Request Body:**
```json
{
  "request_id": "abc123...",
  "user_id": "manager-id",
  "approved": true,
  "comments": "Approved - Client meeting confirmed"
}
```

**Database Action:**
- Update `pending_offpremises_checkins` record:
  - Set `status = 'approved'` or `status = 'rejected'`
  - Set `approved_by_id = manager-id`
  - Set `approved_at = NOW()`
  - Set `rejection_reason` if rejected

**Updated Record Example:**
```json
{
  "id": "abc123...",
  "status": "approved",
  "approved_by_id": "manager-uuid",
  "approved_at": "2026-02-21T10:35:00Z",
  "rejection_reason": null
}
```

**Notifications Sent:**
- Employee is notified of approval/rejection
- If approved, employee's device is registered for off-premises check-in

---

### STEP 3: Employee Completes Check-In/Check-Out
**Flow (after approval):**
1. Employee receives approval notification
2. Employee clicks "Confirm Check-In" button
3. App records the attendance with approved location

**Data Flow:**
- The approved off-premises location replaces the required geofence for this check-in
- Employee's location is recorded with the approved coordinates
- Attendance record is created linked to the off-premises request

**Attendance Record Created:**
```json
{
  "id": "attendance-uuid",
  "user_id": "372eba9d-6515-4df1-8160-bfba99af197c",
  "date": "2026-02-21",
  "check_in_time": "10:35:00Z",
  "location_name": "Coffee Shop",
  "latitude": -31.854696,
  "longitude": 116.00816,
  "offpremises_request_id": "abc123...",
  "status": "present"
}
```

---

## Example Complete Workflow

### Timeline:
```
10:30 AM - Employee submits off-premises check-in request from Coffee Shop
          - Database: pending_offpremises_checkins record created (status='pending')
          - Notifications: Sent to all managers
          
10:32 AM - Manager receives notification and opens approval dashboard
          
10:35 AM - Manager reviews and approves the request
          - Database: Record updated (status='approved', approved_at=10:35, approved_by_id=manager-uuid)
          - Notifications: Employee informed of approval
          
10:36 AM - Employee receives approval and confirms check-in
          - Database: Attendance record created with off-premises location
          - Status: Check-in complete
          
04:30 PM - Employee submits off-premises check-out request from same location
          - Database: New pending_offpremises_checkins record (request_type='checkout')
          
04:32 PM - Manager reviews and approves checkout request
          
04:33 PM - Employee confirms check-out
          - Database: Attendance record updated with check_out_time
          - Daily summary: 6 hours worked from off-premises location
```

---

## Key Features

### 1. Location Validation
- GPS coordinates are captured with accuracy level
- System validates GPS accuracy before accepting check-in

### 2. Manager Approval Chain
- All active managers (admins, regional_managers, department_heads) can approve
- Any manager can approve - no hierarchical requirement

### 3. Notifications
- **To Employee:** Status of their request (approved/rejected)
- **To Managers:** New requests requiring approval with all details

### 4. Audit Trail
- All requests stored with timestamps
- Approval history with manager ID and time
- Rejection reasons recorded for compliance

### 5. Device Information
- Device type detected (mobile, laptop, tablet)
- Device info stored for security verification
- Can help identify suspicious requests

---

## Database Relationships

```
pending_offpremises_checkins
├── user_id → user_profiles (employee requesting)
├── approved_by_id → user_profiles (manager approving)
└── offpremises_request_id ← attendance (link to actual attendance)

Notification Flow:
└── Linked to staff_notifications table
```

---

## API Endpoints Summary

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/attendance/check-in-outside-request` | POST | Create new off-premises request |
| `/api/attendance/offpremises/approve` | POST | Manager approves/rejects request |
| `/api/attendance/check-in` | POST | Employee confirms check-in (after approval) |
| `/api/attendance/check-out` | POST | Employee confirms check-out |

---

## Status Codes and Error Handling

### Success Responses:
- `200 OK`: Request processed successfully
- `pending_approval: true`: Request awaiting manager approval

### Error Responses:
- `400 Bad Request`: Missing required fields
- `404 Not Found`: User or manager not found
- `403 Forbidden`: Insufficient permissions (non-manager trying to approve)
- `500 Internal Server Error`: Database or processing error

---

## Security Considerations

1. **Authentication**: All endpoints require authenticated user
2. **Authorization**: Only managers can approve requests
3. **Location Verification**: GPS accuracy checked before accepting
4. **Device Tracking**: Device info stored for verification
5. **Audit Trail**: All changes logged with timestamps and user IDs
6. **Data Validation**: All inputs validated for type and format

---

## Common Scenarios

### Scenario 1: Field Staff Check-In
- Field staff arrives at client site (outside assigned location)
- Submits off-premises check-in from client coordinates
- Manager approves based on known client meeting
- Check-in recorded from field location

### Scenario 2: Remote Work Check-In
- Remote employee checks in from home/coffee shop
- Provides reason: "Working from home today"
- Manager approves based on remote work policy
- System records remote check-in for reporting

### Scenario 3: Early Check-Out
- Employee needs to leave early (medical appointment)
- Submits off-premises check-out request
- Manager reviews and approves
- Early check-out recorded with duration

### Scenario 4: Rejection
- Employee submits suspicious off-premises request
- No valid reason provided, GPS accuracy poor
- Manager rejects with message: "Please check-in from assigned location"
- Employee receives rejection notification
