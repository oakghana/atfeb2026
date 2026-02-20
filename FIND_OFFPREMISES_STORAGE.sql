-- Find all tables and their off-premises related columns
SELECT table_name, column_name, data_type 
FROM information_schema.columns 
WHERE column_name LIKE '%offpremis%' 
   OR column_name LIKE '%off_premis%'
   OR column_name LIKE '%outside_premis%'
ORDER BY table_name, column_name;

-- List all tables in the database
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
ORDER BY table_name;

-- Check for any table that might store off-premises requests
SELECT table_name, column_name, data_type
FROM information_schema.columns
WHERE table_name IN (
  SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'
)
AND (column_name LIKE '%request%' OR column_name LIKE '%approval%' OR column_name LIKE '%pending%')
ORDER BY table_name, column_name;

-- Detailed look at attendance_records table structure
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'attendance_records'
ORDER BY ordinal_position;

-- Check all attendance_records with off-premises data
SELECT 
  id,
  user_id,
  check_in_time,
  check_out_time,
  approval_status,
  off_premises_request_id,
  on_official_duty_outside_premises,
  supervisor_approval_remarks
FROM attendance_records
WHERE approval_status IS NOT NULL 
   OR off_premises_request_id IS NOT NULL
   OR on_official_duty_outside_premises = true
ORDER BY check_in_time DESC
LIMIT 50;

-- Find if there's a separate pending_offpremises_checkins or similar table
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public'
AND table_name LIKE '%offpremis%'
OR table_name LIKE '%off_premis%'
OR table_name LIKE '%request%'
ORDER BY table_name;

-- If pending_offpremises_checkins exists, show its structure
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'pending_offpremises_checkins'
ORDER BY ordinal_position;

-- Show all pending off-premises records
SELECT * FROM pending_offpremises_checkins
ORDER BY created_at DESC
LIMIT 50;

-- Count records by approval status in attendance_records
SELECT 
  approval_status,
  COUNT(*) as count
FROM attendance_records
WHERE approval_status IS NOT NULL
GROUP BY approval_status;

-- Show user and their pending off-premises requests
SELECT 
  u.id,
  u.email,
  u.first_name,
  u.last_name,
  ar.check_in_time,
  ar.approval_status,
  ar.supervisor_approval_remarks,
  ar.on_official_duty_outside_premises
FROM attendance_records ar
JOIN auth.users u ON u.id = ar.user_id
WHERE ar.approval_status IN ('pending_supervisor_approval', 'approved_offpremises')
ORDER BY ar.check_in_time DESC;
