-- Diagnostic Script: Check Off-Premises Request Status
-- Run this to verify where pending requests are stored and why they might not be visible

-- Step 1: Check if any pending requests exist
SELECT 
  id,
  user_id,
  current_location_name,
  reason,
  status,
  created_at
FROM pending_offpremises_checkins
WHERE status = 'pending'
ORDER BY created_at DESC;

-- Step 2: Check all requests (including approved/rejected)
SELECT 
  id,
  user_id,
  current_location_name,
  status,
  created_at,
  updated_at
FROM pending_offpremises_checkins
ORDER BY created_at DESC
LIMIT 20;

-- Step 3: Get user and manager details
SELECT 
  u.id,
  u.first_name,
  u.last_name,
  u.email,
  u.role,
  u.department_id,
  d.name as department_name,
  u.reports_to_id,
  m.first_name as manager_first_name,
  m.last_name as manager_last_name,
  m.role as manager_role
FROM user_profiles u
LEFT JOIN departments d ON u.department_id = d.id
LEFT JOIN user_profiles m ON u.reports_to_id = m.id
ORDER BY u.created_at DESC
LIMIT 20;

-- Step 4: Check if the column structure is correct
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'pending_offpremises_checkins'
ORDER BY ordinal_position;
