-- COMPREHENSIVE OFF-PREMISES DATA LOCATION TRACE
-- This SQL checks all possible storage locations for off-premises requests

-- Table 1: Main pending_offpremises_checkins table
SELECT 
  COUNT(*) as total_count,
  SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending_count,
  SUM(CASE WHEN status = 'approved' THEN 1 ELSE 0 END) as approved_count,
  SUM(CASE WHEN status = 'rejected' THEN 1 ELSE 0 END) as rejected_count,
  MAX(created_at) as latest_request
FROM pending_offpremises_checkins;

-- All records with details
SELECT 
  id,
  user_id,
  current_location_name,
  status,
  created_at::timestamp with time zone,
  approved_at::timestamp with time zone,
  rejection_reason
FROM pending_offpremises_checkins
ORDER BY created_at DESC
LIMIT 20;

-- Table 2: Notifications for off-premises requests
SELECT 
  COUNT(*) as notification_count,
  type,
  MAX(created_at) as latest
FROM staff_notifications
WHERE type = 'offpremises_checkin_request'
GROUP BY type;

-- Table 3: User profiles (to verify current user and managers)
SELECT 
  id,
  email,
  first_name,
  last_name,
  role,
  is_active
FROM user_profiles
WHERE role IN ('admin', 'regional_manager', 'department_head')
AND is_active = true;

-- Table 4: Check attendance_records for any off-premises data
SELECT COUNT(*) as count
FROM attendance_records
WHERE check_in_location_name ILIKE '%off%'
OR status ILIKE '%off%';
