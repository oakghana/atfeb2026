-- Check 1: Pending off-premises requests
SELECT COUNT(*) as pending_count FROM pending_offpremises_checkins WHERE status = 'pending';

-- Check 2: Approved off-premises requests
SELECT COUNT(*) as approved_count FROM approved_offpremises_checkins WHERE status = 'approved';

-- Check 3: All pending requests with user details
SELECT 
  p.id,
  p.user_id,
  p.current_location_name,
  p.created_at,
  p.status,
  u.first_name,
  u.last_name,
  u.email,
  u.role,
  u.department_id
FROM pending_offpremises_checkins p
LEFT JOIN user_profiles u ON p.user_id = u.id
ORDER BY p.created_at DESC
LIMIT 10;

-- Check 4: All approved requests with user details
SELECT 
  a.id,
  a.user_id,
  a.current_location_name,
  a.approved_at,
  a.status,
  u.first_name,
  u.last_name,
  u.email
FROM approved_offpremises_checkins a
LEFT JOIN user_profiles u ON a.user_id = u.id
ORDER BY a.approved_at DESC
LIMIT 10;
