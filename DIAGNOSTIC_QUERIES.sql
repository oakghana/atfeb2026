-- DIAGNOSTIC QUERY 1: Show ALL 5 existing records with their timestamps
SELECT 
  id,
  user_id,
  current_location_name,
  status,
  created_at,
  approved_at
FROM pending_offpremises_checkins
ORDER BY created_at DESC;

-- DIAGNOSTIC QUERY 2: Check the LATEST request (regardless of time)
SELECT 
  id,
  user_id,
  current_location_name,
  latitude,
  longitude,
  status,
  created_at,
  updated_at
FROM pending_offpremises_checkins
ORDER BY created_at DESC
LIMIT 1;

-- DIAGNOSTIC QUERY 3: Check if there are records in staff_notifications for your recent request
SELECT 
  id,
  user_id,
  notification_type,
  message,
  created_at,
  read_at
FROM staff_notifications
WHERE notification_type = 'offpremises_request'
ORDER BY created_at DESC
LIMIT 5;

-- DIAGNOSTIC QUERY 4: Check attendance_records for recent activity
SELECT 
  id,
  user_id,
  check_in_time,
  check_out_time,
  attendance_date,
  created_at
FROM attendance_records
WHERE user_id = (SELECT id FROM user_profiles WHERE email LIKE '%Kwaku%' LIMIT 1)
ORDER BY attendance_date DESC, check_in_time DESC
LIMIT 3;

-- DIAGNOSTIC QUERY 5: Show how many pending requests exist
SELECT 
  status,
  COUNT(*) as count
FROM pending_offpremises_checkins
GROUP BY status;
