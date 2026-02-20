-- Check all off-premises requests
SELECT 
  id, 
  user_id, 
  current_location_name, 
  status, 
  created_at, 
  approved_at
FROM pending_offpremises_checkins
ORDER BY created_at DESC
LIMIT 10;
