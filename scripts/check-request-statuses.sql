-- SQL to check and reset any requests stuck in approved/rejected that should be pending
SELECT id, user_id, status, created_at, approved_at, rejection_reason 
FROM pending_offpremises_checkins 
ORDER BY created_at DESC 
LIMIT 10;
