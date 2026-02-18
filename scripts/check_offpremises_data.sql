-- Check all pending off-premises requests
SELECT 
  id,
  user_id,
  current_location_name,
  latitude,
  longitude,
  device_info,
  status,
  created_at
FROM pending_offpremises_checkins
WHERE status = 'pending'
ORDER BY created_at DESC
LIMIT 10;

-- Check all off-premises requests (any status)
SELECT 
  id,
  user_id,
  status,
  created_at
FROM pending_offpremises_checkins
ORDER BY created_at DESC
LIMIT 20;

-- Check most recent check-ins from attendance table
SELECT 
  id,
  user_id,
  check_in_time,
  check_out_time,
  status,
  created_at
FROM attendance_records
ORDER BY created_at DESC
LIMIT 10;

-- Check user profiles and their departments
SELECT 
  up.id,
  up.first_name,
  up.last_name,
  up.email,
  up.department_id,
  up.role
FROM user_profiles up
WHERE up.email LIKE '%tete%' OR up.first_name LIKE '%test%'
LIMIT 10;
