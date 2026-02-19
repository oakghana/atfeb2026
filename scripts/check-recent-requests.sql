-- Check all off-premises requests from the last 30 minutes
SELECT 
  id,
  user_id,
  current_location_name,
  latitude,
  longitude,
  accuracy,
  status,
  created_at,
  approved_at,
  approved_by_id,
  rejection_reason,
  device_info,
  google_maps_name
FROM pending_offpremises_checkins
WHERE created_at >= NOW() - INTERVAL '30 minutes'
ORDER BY created_at DESC;
