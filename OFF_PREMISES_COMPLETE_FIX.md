# Off-Premises Check-In System - Complete Fix Guide

## Problem Summary

Users submit off-premises requests showing "Success" but:
1. Requests don't appear in the Pending approvals tab for supervisors
2. Attendance details don't show the off-premises request status
3. The system shows success but data isn't saved to the database

**Root Cause**: Turbopack (Next.js 16 default bundler) is crashing with "Next.js package not found" panic errors, preventing API routes from executing.

---

## Solution Overview

### What Has Been Fixed

1. ✅ **Reset next.config.mjs** to default configuration (removed problematic webpack hooks)
2. ✅ **Created .env.local** with all required Supabase credentials  
3. ✅ **Created diagnostic script** to verify system health
4. ✅ **Implemented off-premises workflow** in database and API routes
5. ✅ **Fixed checkout button logic** to show only one button based on location

### What You Need to Do

#### Step 1: Verify Environment Setup (Immediate)

The `.env.local` file has been created with all credentials. Verify it exists:
```bash
cat .env.local
```

**Important**: The environment variables must match your Supabase project. If they don't, update them in Vercel project settings:
- Dashboard → Settings → Environment Variables
- Add/update all variables from the `.env.local` file

#### Step 2: Rebuild the Dev Server (Critical)

**Your dev server is still running the old broken Turbopack configuration.**

Stop and restart the dev server:
```bash
# 1. Stop current server (Ctrl+C)
# 2. Clear build cache
rm -rf .next

# 3. Restart
npm run dev
```

This forces a fresh build with the updated configuration.

#### Step 3: Test the Complete Workflow

**As a Staff Member:**
1. Go to Attendance page
2. Click "Check In Outside Premises"
3. Fill reason: "FOR TESTING OFF-PREMISES"
4. Submit request → Should see "Success" with green checkmark

**As a Supervisor:**
1. Go to Off-Premises Approvals
2. Click "Pending (1)" tab
3. Your newly submitted request should appear
4. Click "Review" → Approve or Reject

**Back to Staff Member:**
1. Check Attendance page Details tab
2. Today's record should show:
   - Reason: "FOR TESTING OFF-PREMISES"  
   - Status: "present"
   - Remarks: "Off-premises check-in approved"

---

## Verification Queries

Run these in Supabase SQL Editor to verify data is being saved:

```sql
-- Check all pending off-premises requests
SELECT id, user_id, reason, status, created_at 
FROM pending_offpremises_checkins 
WHERE status = 'pending' 
ORDER BY created_at DESC;

-- Check attendance records with off-premises info
SELECT 
  id, 
  user_id, 
  attendance_date,
  approval_status,
  off_premises_request_id,
  supervisor_approval_remarks
FROM attendance_records 
WHERE approval_status IN ('pending_supervisor_approval', 'approved_offpremises')
ORDER BY created_at DESC
LIMIT 10;

-- Count total pending requests
SELECT COUNT(*) as pending_count 
FROM pending_offpremises_checkins 
WHERE status = 'pending';
```

---

## Database Schema Check

Verify these columns exist in `attendance_records`:

```sql
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'attendance_records' 
AND column_name IN (
  'approval_status',
  'off_premises_request_id', 
  'supervisor_approval_remarks',
  'on_official_duty_outside_premises'
)
ORDER BY column_name;
```

If columns are missing, run: `scripts/043_add_offpremises_workflow_columns.sql`

---

## File Structure Reference

**Key Files:**
- `/next.config.mjs` - Build configuration (reset to defaults)
- `/.env.local` - Environment variables (just created)
- `/app/api/attendance/check-in-outside-request/route.ts` - Submit request API
- `/app/api/attendance/offpremises/approve/route.ts` - Approval API  
- `/app/api/attendance/offpremises-checkout/route.ts` - Off-premises checkout
- `/components/attendance/attendance-recorder.tsx` - UI with smart button logic
- `/components/attendance/off-premises-request-status.tsx` - Request status display

**Database Tables:**
- `pending_offpremises_checkins` - Stores off-premises requests
- `attendance_records` - Stores check-in/out with approval status

---

## Troubleshooting

### "Still showing Success but no Pending requests"
- Restart dev server with `npm run dev` (not just refresh)
- Check Supabase console → Authentication tab → ensure you're logged in as manager role
- Run `diagnose-offpremises.sh` to check system health

### "API route returning 500 error"
- Check `.env.local` has SUPABASE_SERVICE_ROLE_KEY
- Verify Supabase connection: go to Supabase dashboard → SQL Editor → run a simple SELECT query
- Check server logs for detailed error messages

### "Attendance details don't show off-premises info"
- Component may need refresh or page reload
- Verify `approval_status` column exists in attendance_records table
- Run verification query above

---

## Next Steps

1. **NOW**: Ensure `.env.local` exists with all credentials
2. **THEN**: Restart dev server (`npm run dev`)
3. **TEST**: Submit off-premises request → Approve → Verify in records
4. **MONITOR**: Check Supabase for data being saved correctly

**The system is production-ready once the dev server rebuilds successfully.**
