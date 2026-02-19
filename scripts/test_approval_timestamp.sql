-- Test Off-Premises Check-in Approval Flow
-- This simulates: Request at 8:30 AM, Approval at 10:30 AM
-- Expected result: Attendance check_in_time = 8:30 AM (NOT 10:30 AM)

-- Step 1: Create a test pending request (simulating request at 8:30 AM)
INSERT INTO pending_offpremises_checkins (
  id,
  user_id,
  current_location_name,
  latitude,
  longitude,
  accuracy,
  device_info,
  status,
  created_at
)
SELECT
  gen_random_uuid(),
  id,
  'TEST: Client Meeting - Off-Site Location',
  5.6360,
  -0.1966,
  20,
  '{"test": true, "timestamp_verification": true}',
  'pending',
  '2026-02-19 08:30:00+00'::timestamptz
FROM user_profiles
WHERE role IN ('it-admin', 'staff', 'audit_staff')
LIMIT 1
RETURNING id, user_id, created_at as request_time, status;

-- Step 2: Check what we created
SELECT 
  id,
  user_id,
  current_location_name,
  created_at as request_time,
  status,
  '2026-02-19 08:30:00+00'::timestamptz as expected_request_time,
  created_at = '2026-02-19 08:30:00+00'::timestamptz as time_matches
FROM pending_offpremises_checkins
WHERE current_location_name LIKE 'TEST:%'
  AND status = 'pending'
ORDER BY created_at DESC
LIMIT 1;

-- Note: Now the approval should be done via the /api/attendance/offpremises/approve endpoint
-- The endpoint should:
-- 1. Update pending_offpremises_checkins.status = 'approved'
-- 2. Set approved_at = current time (10:30 AM)
-- 3. Create attendance_records with check_in_time = created_at (8:30 AM, NOT approval time)
