-- ============================================================
-- OFF-PREMISES WORKFLOW DEBUGGING QUERIES
-- ============================================================

-- 1. CHECK ALL PENDING OFF-PREMISES REQUESTS (What supervisors should see)
SELECT 
  id,
  user_id,
  current_location_name,
  reason,
  status,
  created_at,
  approved_at,
  approved_by_id
FROM pending_offpremises_checkins
WHERE status = 'pending'
ORDER BY created_at DESC;

-- 2. CHECK TEMPORARY ATTENDANCE RECORDS FOR PENDING APPROVALS
SELECT 
  id,
  user_id,
  attendance_date,
  check_in_time,
  status,
  approval_status,
  off_premises_request_id,
  supervisor_approval_remarks,
  on_official_duty_outside_premises
FROM attendance_records
WHERE approval_status = 'pending_supervisor_approval'
ORDER BY check_in_time DESC;

-- 3. CHECK APPROVED OFF-PREMISES RECORDS
SELECT 
  pr.id,
  pr.user_id,
  pr.current_location_name,
  pr.reason,
  pr.status,
  pr.created_at,
  pr.approved_at,
  ar.check_in_time,
  ar.check_out_time,
  ar.supervisor_approval_remarks
FROM pending_offpremises_checkins pr
LEFT JOIN attendance_records ar ON ar.off_premises_request_id = pr.id
WHERE pr.status = 'approved'
ORDER BY pr.created_at DESC;

-- 4. GET MOST RECENT OFF-PREMISES STATUS FOR A SPECIFIC USER (Replace USER_ID)
SELECT 
  pr.id,
  pr.current_location_name,
  pr.reason,
  pr.status,
  pr.created_at,
  ar.approval_status,
  ar.supervisor_approval_remarks,
  ar.on_official_duty_outside_premises
FROM pending_offpremises_checkins pr
LEFT JOIN attendance_records ar ON ar.off_premises_request_id = pr.id
WHERE pr.user_id = 'USER_ID'
ORDER BY pr.created_at DESC
LIMIT 5;

-- 5. VERIFY COLUMN EXISTS IN ATTENDANCE_RECORDS
SELECT 
  column_name, 
  data_type, 
  is_nullable
FROM information_schema.columns
WHERE table_name = 'attendance_records'
AND column_name IN (
  'approval_status', 
  'off_premises_request_id', 
  'supervisor_approval_remarks', 
  'on_official_duty_outside_premises'
)
ORDER BY column_name;

-- 6. COUNT SUMMARY OF OFF-PREMISES REQUESTS BY STATUS
SELECT 
  status,
  COUNT(*) as count,
  COUNT(CASE WHEN created_at::date = CURRENT_DATE THEN 1 END) as today
FROM pending_offpremises_checkins
GROUP BY status;

-- 7. CHECK FOR FAILED INSERTS (Check if requests exist in attendance but not in pending_offpremises)
SELECT 
  ar.id,
  ar.user_id,
  ar.check_in_time,
  ar.approval_status,
  ar.supervisor_approval_remarks,
  CASE WHEN pr.id IS NULL THEN 'MISSING FROM pending_offpremises' ELSE 'OK' END as status
FROM attendance_records ar
LEFT JOIN pending_offpremises_checkins pr ON ar.off_premises_request_id = pr.id
WHERE ar.approval_status = 'pending_supervisor_approval'
OR ar.approval_status = 'approved_offpremises';

-- 8. SHOW ALL REQUESTS AND THEIR RELATED ATTENDANCE RECORDS
SELECT 
  pr.id as request_id,
  pr.user_id,
  (SELECT CONCAT(first_name, ' ', last_name) FROM user_profiles WHERE id = pr.user_id) as staff_name,
  pr.current_location_name,
  pr.reason,
  pr.status as request_status,
  ar.id as attendance_id,
  ar.approval_status,
  ar.check_in_time,
  ar.check_out_time,
  pr.created_at,
  pr.approved_at
FROM pending_offpremises_checkins pr
LEFT JOIN attendance_records ar ON ar.off_premises_request_id = pr.id
ORDER BY pr.created_at DESC
LIMIT 20;
