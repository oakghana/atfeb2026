-- Comprehensive testing queries for off-premises workflow
-- Run these in sequence to test and verify the implementation

-- 1. Verify database schema updates
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'attendance_records'
AND column_name IN ('off_premises_request_id', 'approval_status', 'supervisor_approval_remarks', 'on_official_duty_outside_premises')
ORDER BY ordinal_position;

-- 2. Check all off-premises requests with their statuses
SELECT 
  r.id,
  r.user_id,
  p.first_name,
  p.last_name,
  r.status,
  r.current_location_name,
  r.created_at,
  r.approved_at,
  a.approval_status,
  a.check_in_time,
  a.check_out_time
FROM pending_offpremises_checkins r
LEFT JOIN user_profiles p ON r.user_id = p.id
LEFT JOIN attendance_records a ON r.id = a.off_premises_request_id
ORDER BY r.created_at DESC;

-- 3. Show pending off-premises requests waiting for approval
SELECT 
  r.id,
  p.first_name || ' ' || p.last_name AS staff_name,
  r.current_location_name,
  r.latitude,
  r.longitude,
  r.created_at,
  a.approval_status,
  a.supervisor_approval_remarks
FROM pending_offpremises_checkins r
JOIN user_profiles p ON r.user_id = p.id
LEFT JOIN attendance_records a ON r.id = a.off_premises_request_id
WHERE r.status = 'pending'
ORDER BY r.created_at DESC;

-- 4. Show approved off-premises check-ins today
SELECT 
  a.id,
  u.first_name || ' ' || u.last_name AS staff_name,
  a.approval_status,
  a.on_official_duty_outside_premises,
  a.check_in_time,
  a.check_out_time,
  a.check_in_location_name,
  a.work_hours
FROM attendance_records a
JOIN user_profiles u ON a.user_id = u.id
WHERE DATE(a.attendance_date) = CURRENT_DATE
AND a.approval_status = 'approved_offpremises'
ORDER BY a.check_in_time DESC;

-- 5. Verify attendance workflow - temporary pending records
SELECT 
  a.id,
  u.first_name || ' ' || u.last_name AS staff_name,
  a.status,
  a.approval_status,
  a.off_premises_request_id,
  a.check_in_time,
  a.supervisor_approval_remarks,
  a.attendance_date
FROM attendance_records a
JOIN user_profiles u ON a.user_id = u.id
WHERE DATE(a.attendance_date) = CURRENT_DATE
AND a.approval_status IN ('pending_supervisor_approval', 'approved_offpremises')
ORDER BY a.approval_status, a.check_in_time DESC;

-- 6. Count workflow statistics
SELECT
  COUNT(CASE WHEN status = 'pending' THEN 1 END) AS pending_requests,
  COUNT(CASE WHEN status = 'approved' THEN 1 END) AS approved_requests,
  COUNT(CASE WHEN status = 'rejected' THEN 1 END) AS rejected_requests
FROM pending_offpremises_checkins
WHERE DATE(created_at) = CURRENT_DATE;

-- 7. Check for notification sending to managers
SELECT 
  n.id,
  n.notification_type,
  n.message,
  n.is_read,
  n.created_at
FROM staff_notifications n
WHERE n.notification_type IN ('offpremises_checkin_request', 'offpremises_checkin_approved', 'offpremises_checkin_rejected')
ORDER BY n.created_at DESC
LIMIT 10;
