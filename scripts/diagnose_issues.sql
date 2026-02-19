-- Diagnostic script: Check user profiles and off-premises check-in requests

-- 1. Check if pending_offpremises_checkins table exists and its structure
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'pending_offpremises_checkins' 
AND table_schema = 'public'
ORDER BY ordinal_position;

-- 2. Count all off-premises check-in requests in the last 2 days
SELECT 
  COUNT(*) as total_requests_last_2_days,
  COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending_count,
  COUNT(CASE WHEN status = 'approved' THEN 1 END) as approved_count,
  COUNT(CASE WHEN status = 'rejected' THEN 1 END) as rejected_count
FROM pending_offpremises_checkins 
WHERE created_at >= NOW() - INTERVAL '2 days';

-- 3. List all off-premises requests from the last 2 days with user info
SELECT 
  poc.id,
  poc.user_id,
  up.first_name,
  up.last_name,
  up.email,
  up.role,
  poc.current_location_name,
  poc.status,
  poc.created_at,
  poc.latitude,
  poc.longitude
FROM pending_offpremises_checkins poc
LEFT JOIN user_profiles up ON poc.user_id = up.id
WHERE poc.created_at >= NOW() - INTERVAL '2 days'
ORDER BY poc.created_at DESC;

-- 4. Check all off-premises requests (not just last 2 days) for overview
SELECT 
  COUNT(*) as total_all_time,
  MIN(created_at) as earliest_request,
  MAX(created_at) as latest_request
FROM pending_offpremises_checkins;

-- 5. Check user_profiles table - verify it exists and has data
SELECT COUNT(*) as total_users FROM user_profiles;

-- 6. Check for any RLS policies on the tables
SELECT 
  schemaname, tablename, policyname, permissive, roles, cmd, qual
FROM pg_policies 
WHERE tablename IN ('pending_offpremises_checkins', 'user_profiles')
ORDER BY tablename, policyname;
