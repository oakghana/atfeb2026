# Quick Reference: Attendance System Guide

## ✅ System Status

| Component | Status | Notes |
|-----------|--------|-------|
| Countdown Timer | ✅ Working | Real-time, updates every second |
| Check-In Rules | ✅ Enforced | Time-based (before 3 PM), location-based |
| Check-Out Rules | ✅ Enforced | Time-based (before 6 PM), minimum 120 min |
| Off-Premises | ✅ Working | Approval workflow + auto-rejection at 6 PM |
| Device Security | ✅ Monitored | Tracks IP, device ID, usage patterns |
| Database | ✅ Optimized | Proper indexes and relationships |

---

## 📋 Check-In Conditions

### Who Can Check In?
- ✅ **All staff** - Regular staff before 3 PM
- ✅ **Managers** - Anytime (Admin, Dept Head, Regional Manager)
- ✅ **Special Departments** - Security, Operations, Transport (anytime)

### Where Can They Check In?
- ✅ **At registered geofence** - Within 50m radius
- ✅ **GPS enabled** - Location accuracy must be acceptable
- ✅ **Enabled location** - Must have check-in enabled

### What Happens During Check-In?
1. ✅ GPS location validated
2. ✅ Check for duplicate check-in today
3. ✅ Device security verification
4. ✅ Record check-in time
5. ✅ Start countdown timer
6. ✅ Require lateness reason (if weekday, not exempt)

---

## ⏱️ Active Session (Countdown Timer)

### During Active Session
- ⏱️ **Timer counts down** from 120 minutes
- 🟠 **Orange display** while waiting (00:45:30)
- 📊 **Progress tracked** in percentage
- 📍 **Location shown** for reference
- ⌚ **Time worked** displayed (0h 15m)

### When Timer Reaches Zero
- 🟢 **Background turns green**
- ✅ **Checkout button enables**
- 📢 **User notified** (automatic alert)
- 📍 **Location working hours shown** (if applicable)

### Timer Behavior
- ⏱️ Continues if user navigates away
- 🔄 Resets if user logs out and back in
- 📱 Works on mobile and desktop
- 🌙 Works in dark mode

---

## ✌️ Check-Out Conditions

### When Can User Check Out?

```
IF minimum_work_period_elapsed (120 min) AND time_before_deadline (6 PM)
  THEN allow_checkout = true
```

### Special Cases

**Off-Premises (Approved):**
- ✅ Can checkout anytime
- ✅ No location required
- ✅ No time deadline
- ✅ Marked as "remote"

**Emergency Checkout:**
- ✅ With supervisor approval
- ✅ Any time
- ✅ Reason required
- ✅ Flagged in system

**Early Checkout:**
- ⚠️ Only before minimum period ends
- ⚠️ Requires reason if location enforces it
- ⚠️ Only on weekdays
- ⚠️ Not for exempt roles

---

## 🚀 Off-Premises Workflow

### Step 1: Request
```
Employee selects "Check In Outside" 
  ↓
Fills form with location name and reason
  ↓
Request stored in pending_offpremises_checkins
```

### Step 2: Approval
```
Manager reviews request
  ↓
Manager approves or rejects
  ↓
User notified of decision
```

### Step 3: Checkout
```
If APPROVED:
  - User can checkout anywhere
  - No GPS needed
  - No location validation
  - Marked as "remote work"

If REJECTED:
  - Checkout blocked
  - Must go to office
  - Can try again tomorrow
```

### Auto-Rejection
- ⏰ **Automatic rejection** after 6 PM (18:00)
- 📝 **Reason:** Work day considered over
- 🔔 **User notified** via email
- 🔄 **Can request again** next day

---

## 📊 Business Rules Summary

### Time Restrictions
| Time | What Happens |
|------|--------------|
| Before 3 PM | ✅ Regular staff can check in |
| 3 PM - 6 PM | ✅ Only managers can check in; anyone can check out |
| After 6 PM | ❌ Cannot check in or out (unless exempt/approved) |

### Exemptions Apply To
- **Roles:** Admin, Department Head, Regional Manager
- **Departments:** Security, Operations, Transport

### Key Rules
- 📍 Must be at registered location (50m)
- ⏱️ Must work minimum 120 minutes before checkout
- 🚫 Cannot check in twice same day
- 📱 Device must pass security checks
- 📝 Lateness reason required (weekdays, not exempt)

---

## 🔧 Component Files

### Core Components
- `active-session-timer.tsx` - **Current timer** (working)
- `optimized-check-in-card.tsx` - **Check-in UI**
- `modernized-attendance-flow.tsx` - **NEW: Enhanced UI** (recommended)

### API Endpoints
- `POST /api/attendance/check-in` - Submit check-in
- `POST /api/attendance/check-out` - Submit checkout
- `POST /api/attendance/check-in-outside-request` - Off-premises request
- `POST /api/attendance/offpremises/approve` - Manager approval
- `GET /api/attendance/offpremises/approved-checkins` - Get approvals

### Database Tables
- `attendance_records` - Check-in/out records
- `pending_offpremises_checkins` - Off-premises requests
- `geofence_locations` - Location boundaries
- `user_profiles` - User details
- `device_security_violations` - Security log

---

## 🎯 How to Use Modernized Component

### Installation
```tsx
// 1. Import the component
import { ModernizedAttendanceFlow } from "@/components/attendance/modernized-attendance-flow"

// 2. Add to your page
<ModernizedAttendanceFlow
  checkInTime={todayAttendance?.check_in_time}
  checkOutTime={todayAttendance?.check_out_time}
  checkInLocation={locationInfo?.name}
  minimumWorkMinutes={120}
  userDepartment={userDepartment}
  userRole={userRole}
  onCheckIn={handleCheckIn}
  onCheckOut={handleCheckOut}
  predictedCheckoutTime={predictedTime}
/>

// 3. Handle checkout in your API
const handleCheckOut = async () => {
  const response = await fetch('/api/attendance/check-out', {
    method: 'POST',
    body: JSON.stringify({ /* ... */ })
  })
}
```

---

## 📱 Mobile Optimization

### Current System
- ✅ Works on mobile
- ✅ Responsive buttons
- ✅ Touch-friendly
- ✅ Readable on small screens

### Modernized Component
- ✅ Mobile-first design
- ✅ Stacked layout on phones
- ✅ Large touch targets (44px+)
- ✅ Optimized for one-handed use
- ✅ Dark mode support
- ✅ High contrast text

---

## 🚨 Troubleshooting

### Timer Not Counting Down?
```
1. Check if user is logged in
2. Verify check-in time is recorded
3. Look at browser console for errors
4. Refresh page
```

### Checkout Button Disabled?
```
Check these conditions:
  ☐ Has minimum 120 minutes elapsed?
  ☐ Is time before 6 PM (or exempt)?
  ☐ Is user at registered location (GPS)?
  ☐ Or does user have approved off-premises request?
```

### Off-Premises Request Not Approved?
```
1. Check if request is still in PENDING status
2. Verify manager received notification
3. Check email spam folder
4. Try submitting request again
```

### Device Security Violation?
```
1. Check if multiple users on same device
2. Verify device IP hasn't changed suddenly
3. Check browser cookies/cache
4. Try logging out and back in
```

---

## 📈 Metrics to Track

```
✅ On-time checkout rate: ___% (Target: >95%)
✅ Failed checkouts: ___/day (Target: <1%)
✅ Off-premises approvals: ___/day (Target: >80%)
✅ User satisfaction: ___/5 (Target: >4.0)
✅ System uptime: ___% (Target: >99.9%)
```

---

## 📚 Documentation Files

| File | Purpose |
|------|---------|
| `ATTENDANCE_SYSTEM_COMPLETE_SUMMARY.md` | Complete system overview |
| `ATTENDANCE_MODERNIZATION_ANALYSIS.md` | Detailed analysis of current system |
| `MODERNIZED_WORKFLOW_GUIDE.md` | Implementation guide for new component |
| `BEFORE_AFTER_COMPARISON.md` | Side-by-side comparison |
| `OFF_PREMISES_WORKFLOW.md` | Off-premises system details |

---

## ✅ Verification Checklist

Use this to verify system is working:

```
Daily:
  ☐ Check-in available before 3 PM
  ☐ Timer starts counting after check-in
  ☐ Check-out available after 120 minutes
  ☐ Off-premises requests can be submitted

Weekly:
  ☐ Manager can approve/reject requests
  ☐ Auto-rejection happens at 6 PM
  ☐ Device security violations logged
  ☐ Attendance records accurate

Monthly:
  ☐ No duplicate check-ins occurring
  ☐ Time restrictions being enforced
  ☐ Department exemptions working
  ☐ All data persisting correctly
```

---

## 🎓 Key Concepts

### Geofence
- 📍 Circular boundary around location
- 📏 Default radius: 50 meters
- 🎯 Used for GPS check-in validation
- 🗺️ Prevents false check-ins from afar

### Minimum Work Period
- ⏱️ Employees must stay 120 minutes (2 hours)
- 🔐 Prevents short sessions (unless approved)
- 🚀 Enforced at checkout time
- 💼 Can be overridden for off-premises work

### Device Sharing Detection
- 📱 Monitors if multiple users on same device
- 🔍 Tracks IP addresses and device IDs
- 🚨 Flags unusual patterns
- 📊 Stored in security violations table

### Off-Premises Request
- 📝 Request to work from outside office
- ⏳ Stays PENDING until approved
- 🚀 Auto-rejects at 6 PM if not approved
- ✅ Once approved, allows remote checkout

---

## Need Help?

### For Users
1. Read the on-screen instructions
2. Check if conditions are met (see Troubleshooting)
3. Contact your department manager
4. Email support@company.com

### For Developers
1. Check database schema in scripts/
2. Review API endpoints in app/api/
3. Read MODERNIZED_WORKFLOW_GUIDE.md
4. Look at component examples in components/examples/

