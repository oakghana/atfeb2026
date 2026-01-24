# Smart Leave Management System - Complete Implementation

## Overview
The QCC Attendance app now has a smart, streamlined leave management system that automatically marks staff as inactive during approved leave and excludes them from departmental analytics.

---

## System Architecture

### 1. Leave Status Flow
\`\`\`
PENDING → APPROVED → ACTIVE (with document) → COMPLETED
   ↓          ↓
 REJECTED   (reject flow)
\`\`\`

### 2. Inactive Status Management

**When Staff Becomes Inactive:**
- HOD approves a leave request → Status changes to "approved" & `is_active = false`
- Staff submits approved leave with document → Status changes to "active" & `is_active = false`

**When Staff Becomes Active Again:**
- Cron job runs daily (`/api/cron/reactivate-after-leave`)
- Finds all staff with `leave_end_date < today`
- Automatically sets `is_active = true` and `leave_status = "completed"`

---

## Components & Features

### 1. **LeaveStatusCard** (`/components/leave/leave-status-card.tsx`)
- Shows current leave status (Active, Pending, Approved, Rejected)
- For approved leave: Shows "Submit Document" button
- Automatically disables check-in/out when staff is on active leave
- Beautiful UI with status-specific colors and gradients

### 2. **LeaveRequestDialog** (`/components/leave/leave-request-dialog.tsx`)
- Multi-step form: Type → Dates → Reason → Document → Confirm
- Staff upload supporting documents (approval letter, medical certificate)
- Document validation (5MB max, PDF/JPG/PNG)
- For approved leave: Only shows document upload step

### 3. **HOD Leave Management** (`/app/dashboard/leave-management/page.tsx`)
- View all pending leave requests from department
- Approve: Changes to "approved" status, marks staff inactive
- Reject: Changes to "rejected" status, keeps staff active
- HOD gets notified when staff submits document

### 4. **Attendance Recorder** (`/components/attendance/attendance-recorder.tsx`)
- Receives `userLeaveStatus` prop
- Disables check-in/out buttons when `leave_status === "active"`
- Shows clear message that user is on leave

---

## API Endpoints

### 1. **POST /api/leave/request** 
- Initial leave request submission
- Creates pending leave request

### 2. **POST /api/leave/activate-approved** ✅ NEW
- Staff submits approved leave with document
- Changes status from "approved" to "active"
- Marks staff as `is_active = false`
- Response includes document URL

### 3. **GET /api/cron/reactivate-after-leave** ✅ NEW
- Daily cron job to reactivate staff after leave ends
- Finds staff with `leave_end_date < today` and `is_active = false`
- Updates `is_active = true` and `leave_status = "completed"`

### 4. **GET /api/admin/department-summaries** (UPDATED)
- Now includes leave data: `leave_status`, `leave_start_date`, `leave_end_date`
- Frontend filters out inactive staff on leave automatically

---

## Analytics & Filtering

### Department Summaries Filtering (`/components/admin/department-summaries-client.tsx`)

\`\`\`typescript
// SMART LEAVE FILTERING: Exclude inactive staff on leave from analytics
filtered = filtered.filter((staff) => {
  // Include only if staff is active
  if (!staff.isActive) return false
  
  // Exclude if currently on active leave
  if (staff.leaveStatus === "active" && staff.leaveStartDate && staff.leaveEndDate) {
    const today = new Date()
    const leaveStart = new Date(staff.leaveStartDate)
    const leaveEnd = new Date(staff.leaveEndDate)
    
    // Exclude from analytics if within leave period
    if (today >= leaveStart && today <= leaveEnd) return false
  }
  
  return true
})
\`\`\`

**Benefits:**
- Staff on leave don't skew attendance percentages
- Department analytics show only active staff metrics
- Accurate performance tracking during absences

---

## Database Schema

### user_profiles Table
\`\`\`sql
-- Leave-related columns (added in migration 024_add_leave_status.sql)
- leave_status: VARCHAR (active, pending, approved, rejected, completed)
- leave_start_date: DATE
- leave_end_date: DATE
- leave_reason: TEXT
- leave_document_url: TEXT
- is_active: BOOLEAN (existing, now used for leave status too)
\`\`\`

---

## Key Workflows

### Workflow 1: Staff Requests Leave
1. Staff clicks "Request Leave" on Attendance page
2. Fills form: Type → Dates → Reason → Confirm
3. Request sent to `/api/leave/request`
4. HOD sees pending request in Leave Management

### Workflow 2: HOD Approves & Staff Activates
1. HOD clicks "Approve" on leave request
   - Status: pending → approved
   - is_active: true → false
   - Staff notified
2. Staff sees "Leave Approved" card with "Submit Document" button
3. Staff uploads document and submits
   - Calls `/api/leave/activate-approved`
   - Status: approved → active
   - is_active remains false
   - Leave is now ACTIVE

### Workflow 3: Automatic Reactivation
1. Every day, cron job `/api/cron/reactivate-after-leave` runs
2. Finds staff with leave_end_date < today
3. Automatically sets:
   - is_active: false → true
   - leave_status: active → completed
4. Staff can check in/out normally again

### Workflow 4: HOD Rejects Leave
1. HOD clicks "Reject" on leave request
2. Status: pending → rejected
3. is_active: true (unchanged)
4. Staff can request again

---

## Integration with Attendance System

### Check-In/Check-Out Restrictions
When staff has `leave_status = "active"`:
- Check-in button is disabled
- Check-out button is disabled
- Message: "You are currently on approved leave"
- No attendance records can be created during leave

### Excluded from Analytics
Staff on active leave are:
- Removed from department attendance calculations
- Not included in "Days Absent" counts
- Not affecting team attendance percentage
- Shown separately in leave status

---

## Configuration

### Environment Variables
\`\`\`env
# For cron job authentication (optional)
CRON_SECRET=your-secret-key
\`\`\`

### Vercel Cron Setup (vercel.json)
\`\`\`json
{
  "crons": [{
    "path": "/api/cron/reactivate-after-leave",
    "schedule": "0 1 * * *"  // Daily at 1 AM UTC
  }]
}
\`\`\`

---

## Testing

### Test Cases

1. **Request Leave**
   - [ ] Staff can submit leave request
   - [ ] HOD receives notification
   - [ ] Status is "pending"

2. **Approve & Submit**
   - [ ] HOD can approve request
   - [ ] Staff sees "Approved" card
   - [ ] Staff can upload document
   - [ ] Leave activates with status "active"
   - [ ] Staff becomes inactive (`is_active = false`)

3. **Check-In/Out Disabled**
   - [ ] Check-in button is disabled during leave
   - [ ] Check-out button is disabled during leave
   - [ ] Error message shows clearly

4. **Analytics Exclusion**
   - [ ] Staff on leave not counted in department summary
   - [ ] Department attendance % doesn't include leave days
   - [ ] After leave ends, staff reactivated in analytics

5. **Auto-Reactivation**
   - [ ] Cron job runs daily
   - [ ] Staff reactivated after leave_end_date
   - [ ] is_active = true automatically

---

## Future Enhancements

- [ ] Leave balance tracking (annual leave quota)
- [ ] Approval workflows with multiple signers
- [ ] Holiday calendar integration
- [ ] Email notifications for all state changes
- [ ] Leave history reports per staff
- [ ] Department leave planning dashboard
- [ ] Document storage in Supabase Storage
- [ ] Leave type categories with different approval processes

---

## Troubleshooting

### Staff still showing in analytics while on leave
- Check `is_active` field is false
- Check `leave_status` is "active"
- Verify `leave_start_date` and `leave_end_date` are set correctly
- Run cron job manually: GET `/api/cron/reactivate-after-leave`

### Staff not reactivating after leave ends
- Check cron job is configured in vercel.json
- Verify leave_end_date is correct
- Check database for completed leaves
- Manually call cron endpoint for testing

### Check-in/out buttons not disabled during leave
- Verify `userLeaveStatus` prop is passed to AttendanceRecorder
- Check `leave_status === "active"` in component logic
- Clear browser cache and reload

---

## Summary

✅ Smart leave system with automatic inactive status management
✅ Staff excluded from analytics during leave
✅ Streamlined approval: approve → document submit → activate
✅ Automatic reactivation via daily cron job
✅ Clear UI indicators for all leave states
✅ No manual staff activation needed after leave
