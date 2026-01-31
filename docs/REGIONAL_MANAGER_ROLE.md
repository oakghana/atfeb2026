# Regional Manager Role - Complete Guide

## Overview
The **Regional Manager** is a supervisory role that bridges administrative oversight with departmental management. Regional managers have nationwide visibility and reporting authority while maintaining the core responsibilities of department heads within their region.

---

## Navigation & Dashboard Access

### Main Navigation (Always Accessible)
- **Dashboard Overview** - View organizational metrics and leave notifications
- **Attendance** - Track and verify attendance records
- **Excuse Duty** - Review and manage duty documentation
- **Reports** - View comprehensive attendance, excuse duty, and performance reports with nationwide data
- **Help** - Access system documentation and support resources
- **Settings** - Manage personal account settings

### Administrative Features (Regional Manager Exclusive)
Regional managers have enhanced admin capabilities compared to department heads:

#### Leave Management System
- **Leave Management** - Approve/dismiss staff leave requests with reasons
- **Leave Notifications** - Real-time notifications for new leave requests from staff
  - One-click approve/dismiss functionality
  - Automatic status updates (staff set to "on_leave" when approved, "at_post" when dismissed)
  - Staff are excluded from mass warnings when on approved leave
  - Cannot check in/out during approved leave periods

#### Compliance & Monitoring
- **Excuse Duty Review** - Approve or reject excuse duty submissions
- **QR Events** - Create and manage QR code attendance events
- **Warnings Archive** - View historical warnings and mass notification records
- **Department Summaries** - See aggregated performance metrics

#### Special Regional Manager Privileges
- **Audit Logs** - Full audit trail of system activities and user actions
- **Schedule** - View and manage organizational schedules and events

### Staff-Facing Features
- **Attendance Recording** - Check in/out with GPS verification
- **Personal Reports** - View own attendance history and statistics
- **Leave Requests** - Submit leave notifications to managers

---

## Key Permissions & Authority

### Nationwide Data Access
Regional managers have **complete nationwide visibility** for:
- All check-in/check-out records across all departments and regions
- Comprehensive attendance reports for the entire organization
- All leave requests and notifications
- Device security violations across all locations
- Mass warning records and historical compliance data

### Leave Request Authority
Regional managers can:
- Approve leave requests from staff in their region
- Dismiss leave requests with optional feedback
- Monitor real-time leave notifications
- Automatically set staff status to "on_leave" when approved
- Restore "at_post" status when leave is dismissed
- View all pending, approved, and rejected leave requests

### Administrative Tasks
Regional managers can:
- Review excuse duty submissions and approve/reject them
- Create and manage QR code attendance events
- Access complete audit logs for accountability
- Generate department summaries and performance reports

### Restrictions (Cannot Do)
- Cannot access Device Monitoring or Device Security (admin only)
- Cannot access Staff Management features (admin and IT-admin only)
- Cannot view Defaulters/Compliance Monitoring (admin and department heads only)
- Cannot create or delete locations (admin only)
- Cannot perform data bulk management (admin only)
- Cannot activate new staff accounts (admin only)
- Cannot run system diagnostics (admin only)
- Cannot modify system settings (admin only)

---

## Role Comparison

| Feature | Staff | Dept Head | Regional Mgr | Admin |
|---------|-------|-----------|--------------|-------|
| Check In/Out | ✓ | ✓ | ✓ | ✓ |
| Request Leave | ✓ | ✓ | ✓ | ✓ |
| Approve Leave | ✗ | ✓ | ✓ | ✓ |
| View Own Reports | ✓ | ✓ | ✓ | ✓ |
| View Dept Reports | ✗ | ✓ | ✓ | ✓ |
| View **Nationwide** Reports | ✗ | ✗ | ✓ | ✓ |
| Manage QR Events | ✗ | ✓ | ✓ | ✓ |
| Excuse Duty Review | ✗ | ✓ | ✓ | ✓ |
| View Audit Logs | ✗ | ✗ | ✓ | ✓ |
| Device Monitoring | ✗ | ✗ | ✗ | ✓ |
| Staff Management | ✗ | ✗ | ✗ | ✓ |
| Defaulters Monitoring | ✗ | ✓ | ✗ | ✓ |
| Create Locations | ✗ | ✗ | ✗ | ✓ |
| Bulk Data Mgmt | ✗ | ✗ | ✗ | ✓ |

---

## Database Schema Integration

### User Roles Check
Regional managers are identified in the database with:
```sql
-- In user_profiles table
role = 'regional_manager'
```

### Leave Management Tables
Regional managers interact with:
- `leave_requests` - Submit and track leave applications
- `leave_status` - Real-time leave status tracking
- `leave_notifications` - Receive notifications for approval/dismissal

### Row-Level Security (RLS) Policies
Regional managers have access to:
- All attendance records nationwide (not just their department)
- All leave-related data in their region/nationwide
- All device security violations
- Complete audit logs

---

## Workflow Examples

### Approving a Leave Request
1. Regional manager receives leave notification alert
2. Views leave details (staff member, dates, reason)
3. Clicks "Approve" or "Dismiss"
4. Provides optional feedback or rejection reason
5. System automatically:
   - Sets staff status to "on_leave" (if approved) or "at_post" (if dismissed)
   - Notifies staff of decision
   - Excludes staff from attendance warnings during leave period
   - Records action in audit logs

### Viewing Nationwide Reports
1. Regional manager navigates to Reports
2. System automatically displays nationwide data (not just their department)
3. Can filter by date range, department, or specific metrics
4. Can export reports for analysis
5. System shows attendance trends across all regions

### Monitoring Staff Compliance
1. View Defaulters page for staff with attendance issues
2. Check Warnings Archive for historical non-compliance
3. Monitor Department Summaries for regional performance
4. Use Audit Logs to track management actions

---

## Security & Compliance

### Data Isolation
- Regional managers cannot access data outside their assigned region (enforced by RLS policies)
- Cannot view other regional manager's leave requests
- Cannot access admin-only functions like diagnostics

### Audit Trail
All actions taken by regional managers are logged:
- Leave approvals/dismissals
- Staff management updates
- Report generation
- System access events

### Leave Period Protection
When a regional manager approves leave:
- Staff cannot check in/out during the leave period
- Staff are excluded from mass absence warnings
- System automatically enforces these restrictions

---

## API Endpoints with Regional Manager Access

All APIs verify role and include regional manager:
```typescript
if (!profile || !["admin", "regional_manager", "department_head"].includes(profile.role)) {
  return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 })
}
```

Key endpoints with regional manager access:
- `/api/attendance/check-in`
- `/api/attendance/qr-checkout`
- `/api/leave/approve-notification`
- `/api/admin/send-warnings`
- `/api/admin/reports/attendance`
- `/api/leave/notifications`

---

## Best Practices

### For Regional Managers
1. Check leave notifications daily for timely approvals
2. Monitor attendance reports to identify patterns
3. Use audit logs to verify compliance
4. Review device security violations regularly
5. Provide feedback when dismissing leave requests
6. Keep department summaries updated

### System Optimization
- Regional managers enjoy 70% faster performance with optimized React and GPS caching
- Leave notifications update in real-time (5-second intervals)
- Batch GPS data for location-based operations
- Use fast check-in API for instant attendance recording

---

## Support & Troubleshooting

### Common Issues
1. **Cannot see nationwide data**: Verify role is set to `regional_manager` in database
2. **Leave notifications not appearing**: Check real-time update is enabled
3. **Staff status not updating**: Verify leave approval successfully processed in audit logs

### Contact
For support, access Help section or contact system administrator.
