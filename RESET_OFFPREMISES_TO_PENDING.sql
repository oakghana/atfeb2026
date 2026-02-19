-- RESET ALL AUTO-REJECTED OFF-PREMISES REQUESTS BACK TO PENDING
-- Run this in your Supabase SQL Editor to restore all rejected requests for proper manager review

-- Step 1: Reset all requests with rejection_reason="Rejected" (auto-rejection marker) back to pending
UPDATE pending_offpremises_checkins
SET 
  status = 'pending',
  approved_by_id = NULL,
  approved_at = NULL,
  rejection_reason = NULL
WHERE rejection_reason = 'Rejected' OR (status = 'rejected' AND rejection_reason IS NULL);

-- Step 2: Verify the reset
SELECT 
  COUNT(*) as total_records,
  COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending_count,
  COUNT(CASE WHEN status = 'approved' THEN 1 END) as approved_count,
  COUNT(CASE WHEN status = 'rejected' THEN 1 END) as rejected_count
FROM pending_offpremises_checkins;

-- Step 3: Show the restored pending requests
SELECT 
  id,
  user_id,
  current_location_name,
  status,
  created_at
FROM pending_offpremises_checkins
WHERE status = 'pending'
ORDER BY created_at DESC;
