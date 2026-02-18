-- Check for off-premises requests this week
SELECT 
  'PENDING_REQUESTS_COUNT' as metric,
  COUNT(*) as count,
  COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '7 days') as this_week
FROM pending_offpremises_checkins;

-- Check approved requests this week
SELECT 
  'APPROVED_REQUESTS_COUNT' as metric,
  COUNT(*) as count,
  COUNT(*) FILTER (WHERE approved_at >= NOW() - INTERVAL '7 days') as this_week
FROM pending_offpremises_checkins
WHERE status = 'approved';

-- Show latest pending requests
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
