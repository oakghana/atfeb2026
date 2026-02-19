-- ============================================================
-- OFF-PREMISES REQUEST DATA TRACE - DIRECT SQL QUERIES
-- ============================================================
-- Copy and paste each query individually in Supabase SQL Editor

-- Query 1: Check table exists and show schema
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'pending_offpremises_checkins'
ORDER BY ordinal_position;

-- Query 2: Count all requests by status
SELECT 
  status,
  COUNT(*) as count,
  MAX(created_at) as most_recent
FROM pending_offpremises_checkins
GROUP BY status;

-- Query 3: Show last 10 requests (all time)
SELECT 
  id,
  user_id,
  current_location_name,
  status,
  created_at,
  approved_at,
  rejection_reason
FROM pending_offpremises_checkins
ORDER BY created_at DESC
LIMIT 10;

-- Query 4: Show requests from last 30 minutes with employee info
SELECT 
  poc.id,
  poc.user_id,
  up.first_name || ' ' || up.last_name as employee,
  poc.current_location_name,
  poc.latitude,
  poc.longitude,
  poc.status,
  poc.created_at,
  poc.approved_at,
  poc.rejection_reason
FROM pending_offpremises_checkins poc
LEFT JOIN user_profiles up ON poc.user_id = up.id
WHERE poc.created_at >= NOW() - INTERVAL '30 minutes'
ORDER BY poc.created_at DESC;

-- Query 5: Check if table has any data at all
SELECT COUNT(*) as total_records
FROM pending_offpremises_checkins;

-- Query 6: Show all tables in the database
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public'
AND table_name LIKE '%offpremises%' OR table_name LIKE '%pending%'
ORDER BY table_name;
