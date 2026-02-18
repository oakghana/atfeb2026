-- Check pending off-premises requests
SELECT 
  id,
  user_id,
  current_location_name,
  latitude,
  longitude,
  status,
  reason,
  created_at,
  updated_at
FROM pending_offpremises_checkins
ORDER BY created_at DESC
LIMIT 10;

-- Check approved off-premises requests
SELECT 
  id,
  user_id,
  current_location_name,
  status,
  approved_at,
  approved_by,
  created_at
FROM approved_offpremises_checkins
ORDER BY created_at DESC
LIMIT 10;

-- Check user profiles to understand the user data
SELECT 
  id,
  first_name,
  last_name,
  email,
  department_id,
  role
FROM user_profiles
ORDER BY created_at DESC
LIMIT 5;

-- Check department info
SELECT 
  id,
  name,
  department_head_id
FROM departments
LIMIT 10;
