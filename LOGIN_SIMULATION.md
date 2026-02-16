# Complete Login Simulation - QCC Electronic Attendance System

## Overview
This document traces the complete user authentication flow from the login page through to the attendance page dashboard.

---

## Step 1: User Visits Login Page
**URL:** `/auth/login`

**What Happens:**
- React client component loads with tabs for:
  - Email/Staff Number + Password login
  - OTP (One-Time Password) login
  
**Initial State:**
- Form fields: `identifier` (staff number or email), `password`
- States: `isLoading`, `error`, `successMessage`
- Notification system initialized

---

## Step 2: User Submits Login Form
**Action:** Click "Sign In" button with credentials

**User Example:**
```
Email: ohemengappiah@qccgh.com
Password: password123
```

OR (Staff Number)
```
Staff Number: QCC0001
Password: password123
```

---

## Step 3: Identifier Validation
**Component:** `handleLogin()` function in login page

**If Using Staff Number:**
1. Check if identifier contains `@`
   - If YES → treat as email
   - If NO → proceed to staff lookup API

**API Call:** `POST /api/auth/lookup-staff`
```json
{
  "identifier": "QCC0001"
}
```

**API Response Flow:**
```
lookup-staff/route.ts:
├─ Validate staff number format (7 digits)
├─ Query database: user_profiles.employee_id = identifier
├─ If found:
│  └─ Return { email: profile.email }
└─ If not found:
   └─ Return { error: "Staff number not found" } (404)
```

**Database Query:**
```sql
SELECT email, employee_id, first_name, last_name 
FROM user_profiles 
WHERE employee_id = 'QCC0001'
```

**Result:** Email extracted from database

---

## Step 4: Supabase Authentication
**Component:** `handleLogin()` - Supabase client authentication

**Supabase Call:**
```typescript
supabase.auth.signInWithPassword({
  email: "ohemengappiah@qccgh.com",
  password: "password123"
})
```

**Supabase Auth Response:**
- Success:
  ```json
  {
    "data": {
      "user": { "id": "uuid-123", "email": "..." },
      "session": { "access_token": "...", "refresh_token": "..." }
    },
    "error": null
  }
  ```
- Failure:
  ```json
  {
    "data": null,
    "error": {
      "message": "Invalid login credentials"
    }
  }
```

**Error Handling:**
- `AbortError` → Check if session exists anyway
- `Invalid login credentials` → Show error notification
- `Email not confirmed` → Show verification reminder

---

## Step 5: User Approval Check
**Component:** `handleLogin()` → `checkUserApproval()`

**Database Query:**
```sql
SELECT is_active, first_name, last_name 
FROM user_profiles 
WHERE id = 'uuid-123'
```

**Business Logic:**
```
IF user_profiles.is_active = false:
  └─ Sign out user
  └─ Redirect to /auth/pending-approval
  
IF user_profiles.is_active = true:
  └─ Continue to device binding check
```

---

## Step 6: Device Binding Security Check
**API Call:** `POST /api/auth/check-device-binding`

```json
{
  "device_id": "device-fingerprint-hash",
  "device_info": {
    "userAgent": "Mozilla/5.0...",
    "platform": "Linux",
    ...
  }
}
```

**Device Binding Logic:**
```
check-device-binding/route.ts:
├─ Extract current user from Supabase session
├─ Get client IP address (from multiple sources)
├─ Query device_user_bindings table:
│  ├─ IF device is bound to another user:
│  │  ├─ Create security violation record
│  │  ├─ Notify department head
│  │  ├─ Sign out user
│  │  └─ Return { allowed: false }
│  ├─ IF device is new (not bound):
│  │  ├─ Create new device binding
│  │  └─ Return { allowed: true }
│  └─ IF device bound to this user:
│     ├─ Update last_seen_at timestamp
│     └─ Return { allowed: true }
└─ Handle table not found → Continue (tables may not exist)
```

**Database Operations:**
```sql
-- Check existing binding
SELECT user_id FROM device_user_bindings 
WHERE device_id = 'device-hash' AND is_active = true

-- Create new binding
INSERT INTO device_user_bindings 
(device_id, user_id, ip_address, device_info, is_active, last_seen_at)
VALUES (...)

-- Update existing binding
UPDATE device_user_bindings 
SET ip_address = ..., last_seen_at = NOW()
WHERE device_id = ... AND user_id = ...
```

---

## Step 7: Login Activity Logging
**API Call:** `POST /api/auth/login-log`

```json
{
  "user_id": "uuid-123",
  "action": "login_success",
  "success": true,
  "method": "password",
  "user_agent": "Mozilla/5.0..."
}
```

**Logging Flow:**
```
login-log/route.ts:
├─ Extract client IP address
├─ Validate required fields
├─ Insert into audit_logs table
├─ IF insertion fails:
│  └─ Log error but continue (non-blocking)
└─ Return success response
```

**Database Insert:**
```sql
INSERT INTO audit_logs (
  user_id,
  action,
  table_name,
  new_values,
  ip_address,
  user_agent
) VALUES (
  'uuid-123',
  'login_success',
  'auth_sessions',
  '{"success": true, "method": "password", "timestamp": "2026-02-16T..."}',
  '203.0.113.45',
  'Mozilla/5.0...'
)
```

---

## Step 8: Cache Clearing & Redirect
**Component:** `handleLogin()` - Final steps

```typescript
// Clear local caches
clearAttendanceCache()      // Clears in-memory attendance data
clearGeolocationCache()     // Clears GPS cache

// Show success notification
showSuccess("Login successful! Redirecting...", "Welcome Back")

// Redirect to dashboard
window.location.href = "/dashboard/attendance"
```

---

## Step 9: Attendance Page Loading
**URL:** `/dashboard/attendance`

**Page Type:** Server Component (async)

**Authentication Check:**
```typescript
const supabase = await createClient()
const { data: { user } } = await supabase.auth.getUser()

if (!user) redirect("/auth/login")
```

**Database Queries (Parallel):**
```sql
-- 1. Today's attendance
SELECT * FROM attendance_records 
WHERE user_id = 'uuid-123' 
AND check_in_time >= 'TODAY 00:00:00'
AND check_in_time <= 'TODAY 23:59:59'

-- 2. User profile with leave status
SELECT assigned_location_id, leave_status, leave_start_date, 
       leave_end_date, leave_reason, first_name, last_name
FROM user_profiles 
WHERE id = 'uuid-123'

-- 3. All active geofence locations
SELECT * FROM geofence_locations 
WHERE is_active = true
ORDER BY name
```

---

## Step 10: Attendance Page Renders
**Components Displayed:**

1. **Header**
   - Back to Dashboard button
   - "Attendance" title with icon
   - Staff Status Badge (showing check-in/check-out status)

2. **Leave Status Card** (conditional)
   - Shows only if user has active leave status
   - Displays leave dates and reason

3. **Tabs**
   - **Today's Attendance Tab:**
     - Location Preview Card
     - Attendance Recorder (check-in/check-out buttons)
   
   - **Attendance History Tab:**
     - Personal Attendance History (past records)

4. **AttendanceRecorder Component**
   - Checks location (geofencing)
   - Captures GPS coordinates
   - Allows check-in/check-out if requirements met
   - Handles GPS spoofing detection

---

## Test User Credentials

### Test Users Available:
```
Email: ohemengappiah@qccgh.com
Password: password123
Role: Admin
Staff #: QCC001

OR

Email: info@qccgh.com
Password: password123
Role: Staff
Staff #: QCC002
```

---

## Complete Request Flow Diagram

```
┌─────────────────────┐
│   Login Page        │
│  /auth/login        │
└──────────┬──────────┘
           │
           ▼ User submits credentials
    ┌─────────────────────┐
    │ Validate Identifier │
    │ (lookup-staff API)  │
    └──────────┬──────────┘
               │
               ▼ Get email from database
        ┌─────────────────────┐
        │ Supabase Auth       │
        │ signInWithPassword  │
        └──────────┬──────────┘
                   │
                   ▼ Get user session
            ┌─────────────────────┐
            │ Check User Approval │
            │ (user_profiles)     │
            └──────────┬──────────┘
                       │
                       ▼ is_active = true?
                ┌─────────────────────┐
                │ Device Binding Check│
                │(device verification)│
                └──────────┬──────────┘
                           │
                           ▼ Device allowed?
                    ┌─────────────────────┐
                    │ Log Login Activity  │
                    │ (audit_logs)        │
                    └──────────┬──────────┘
                               │
                               ▼ Success
                        ┌─────────────────────┐
                        │ Clear Caches        │
                        │ Redirect to         │
                        │ /dashboard/         │
                        │ attendance          │
                        └──────────┬──────────┘
                                   │
                                   ▼ Page loads
                            ┌─────────────────────┐
                            │ Attendance Page     │
                            │ Server-side render  │
                            │ Fetch attendance &  │
                            │ location data       │
                            └──────────┬──────────┘
                                       │
                                       ▼ Display
                                ┌─────────────────────┐
                                │ Attendance UI       │
                                │ - Check-in button   │
                                │ - Location info     │
                                │ - History tabs      │
                                │ - Status badge      │
                                └─────────────────────┘
```

---

## Common Issues & Solutions

### Issue: "ERR_FAILED" on Attendance Page
**Cause:** Middleware redirecting to `/auth/login`
**Solution:** 
1. Check Supabase environment variables are set
2. Verify auth session is valid
3. Check Row Level Security (RLS) policies

### Issue: Device Security Violation
**Cause:** Device already bound to another user
**Solution:**
1. Clear device cache or use different device
2. Contact administrator to reset device binding

### Issue: Account Pending Approval
**Cause:** `is_active = false` in user_profiles
**Solution:**
1. Administrator approves user account
2. Update `is_active = true` in database
3. User can now login

### Issue: Staff Number Not Found
**Cause:** Employee ID mismatch
**Solution:**
1. Use email address directly instead
2. Verify employee_id in user_profiles matches

---

## Session Management

### Session Storage:
- Supabase handles JWT tokens
- Stored in browser (auth state)
- Middleware validates on every request
- Token refresh automatic on expiry

### Session Timeout:
- Default JWT expiry: 1 hour
- Refresh token extends session
- On expiry: Redirect to /auth/login

---

## Security Measures

1. **Password Hashing:** Supabase handles with bcrypt
2. **Device Binding:** Prevents multi-device sharing
3. **IP Tracking:** Logs IP for security audits
4. **Approval Workflow:** Admin must approve accounts
5. **Audit Logging:** All login attempts logged
6. **GPS Spoofing Detection:** Validates location authenticity

