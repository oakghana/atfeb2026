# Off-Premises Check-In System - Redesigned Implementation

## System Architecture Overview

### Role-Based Access Control

**Admin Users:**
- Can view ALL pending off-premises requests from all departments and locations
- Can view ALL approved off-premises records across the entire organization
- Can approve/reject any off-premises check-in request
- Full visibility and approval authority across all locations

**Regional Managers:**
- Can view pending off-premises requests from their assigned location/region
- Can view approved off-premises records from their location
- Can approve/reject requests from their location staff
- Limited to their regional scope

**Department Heads:**
- Can view pending off-premises requests only from their department staff
- Can view approved off-premises records only from their department
- Can approve/reject requests from their department staff only
- Limited to their department scope

---

## Pages & Components

### 1. **Off-Premises Check-In Approvals Page** (`/admin/offpremises-approvals`)
**Component:** `PendingOffPremisesRequests`

**Features:**
- Displays role-specific messaging in header (Admin/Regional Manager/Department Head)
- Shows count of pending requests requiring approval
- Lists all pending requests with:
  - Staff member name, email
  - Location details (GPS coordinates, location name)
  - Request submission time
  - Review button to open approval modal
- No results state: Directs users to review approved requests
- Uses API endpoint: `/api/attendance/offpremises/pending`

**Data Filtering:**
- Admins: See all pending requests
- Regional Managers: See requests from their location
- Department Heads: See only their department's requests

---

### 2. **Off-Premises Review Log Page** (`/admin/offpremises-reviews`)
**Component:** `OffPremisesReviewLog`

**Features:**
- Displays role-specific messaging in header
- Shows total count of approved records
- Shows role badge (Admin/Regional Manager/Department Head)
- Advanced search and filtering:
  - Search by staff name, email, or location
  - Filter by department
  - Filter by date range
  - Sort by staff name, location, or approval time
- Displays approved records in table format with:
  - Staff name and email
  - Location details
  - Approval time
  - Location coordinates for verification
- Pagination for large datasets
- CSV export functionality
- Uses API endpoint: `/api/attendance/offpremises/approved`

**Data Filtering:**
- Admins: See all approved records across organization
- Regional Managers: See only approved records from their location
- Department Heads: See only approved records from their department

---

## API Endpoints

### `/api/attendance/offpremises/pending` (GET)
**Purpose:** Fetch pending approval requests with role-based filtering

**Response Structure:**
```json
{
  "requests": [
    {
      "id": "request_id",
      "user_id": "staff_member_id",
      "current_location_name": "Location name",
      "latitude": 0.0,
      "longitude": 0.0,
      "accuracy": 10,
      "device_info": "Device details",
      "created_at": "ISO timestamp",
      "status": "pending",
      "user_profiles": {
        "id": "user_id",
        "first_name": "John",
        "last_name": "Doe",
        "email": "john@example.com",
        "department_id": "dept_id"
      }
    }
  ],
  "profile": {
    "role": "admin|regional_manager|department_head",
    "department_id": "dept_id"
  },
  "count": 5
}
```

### `/api/attendance/offpremises/approved` (GET)
**Purpose:** Fetch approved records with role-based filtering

**Response Structure:**
```json
{
  "records": [
    {
      "id": "request_id",
      "user_id": "staff_member_id",
      "current_location_name": "Location name",
      "google_maps_name": "Full location name",
      "latitude": 0.0,
      "longitude": 0.0,
      "created_at": "ISO timestamp",
      "approved_at": "ISO timestamp",
      "status": "approved",
      "user_profiles": {
        "id": "user_id",
        "first_name": "John",
        "last_name": "Doe",
        "email": "john@example.com",
        "department_id": "dept_id"
      }
    }
  ],
  "profile": {
    "role": "admin|regional_manager|department_head",
    "department_id": "dept_id"
  },
  "count": 10
}
```

---

## Database Tables

### `pending_offpremises_checkins`
**Status Values:** `pending`, `approved`, `rejected`

**Key Columns:**
- `id`: Unique request ID
- `user_id`: Staff member who made the request
- `current_location_name`: Location description
- `latitude`, `longitude`: GPS coordinates
- `accuracy`: GPS accuracy in meters
- `device_info`: Device information
- `reason`: User's reason for off-premises check-in
- `google_maps_name`: Maps location display name
- `status`: pending/approved/rejected
- `created_at`: Request submission time
- `approved_at`: Approval timestamp
- `approved_by_id`: ID of approving manager
- `approval_notes`: Comments from approver

---

## Approval Workflow

1. **Staff Submits Request:**
   - Staff member clicks "Check In Outside Premises"
   - Enters reason and confirms location
   - Request saved to `pending_offpremises_checkins` with status="pending"
   - Notifications sent to relevant managers

2. **Manager Reviews Request:**
   - Manager navigates to Approvals page
   - Sees pending requests for their scope (location/department/all)
   - Clicks "Review" to open approval modal
   - Can view full request details and location map

3. **Manager Approves/Rejects:**
   - Adds optional approval notes/comments
   - Clicks "Approve" or "Reject"
   - System updates status and creates attendance record
   - Notifications sent to staff member

4. **Request Appears in Review Log:**
   - Approved requests appear in Review Log page
   - Accessible to relevant managers based on role/scope
   - Can be searched, filtered, sorted, and exported

---

## Testing the System

### To verify requests are appearing:

1. **Check if any requests exist:**
   - Navigate to `/admin/offpremises-approvals` as Admin
   - Should show count of pending requests
   - If showing "0 Pending", no requests have been submitted yet

2. **Submit a test request:**
   - As a staff member, go to attendance page
   - Click "Check In Outside Premises"
   - Enter location and reason
   - Submit request

3. **Verify it appears:**
   - Go back to `/admin/offpremises-approvals`
   - Request should appear in the list with staff details
   - Click "Review" to open approval modal

4. **Approve the request:**
   - In modal, click "Approve"
   - Add optional notes
   - Request is approved

5. **Check review log:**
   - Navigate to `/admin/offpremises-reviews`
   - Approved request should appear in the list
   - Can be searched, filtered, and exported

---

## Current Status

✅ **Completed:**
- Role-based permission system (Admin/Regional Manager/Department Head)
- Pending approval page with list view
- Approved review log with advanced filtering
- API endpoints with server-side authentication and filtering
- Approval/rejection workflow
- Attendance record creation on approval

⚠️ **Note:** 
- Currently showing "0 Pending" or "0 Approved" because no off-premises requests have been submitted yet
- System is fully functional and ready to receive requests
- Once requests are submitted by staff, they will appear in the appropriate manager's view based on role and scope
