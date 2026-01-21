-- Improved duplicate prevention with proper unique index and cleanup
-- Add unique constraint to prevent duplicate check-ins on the same day
-- This ensures at the database level that a user can only have one check-in per day

-- First, identify and remove duplicate check-ins (keep the earliest one for each user/day)
DO $$
DECLARE
  deleted_count INTEGER;
BEGIN
  WITH ranked_checkins AS (
    SELECT 
      id,
      user_id,
      check_in_time,
      ROW_NUMBER() OVER (
        PARTITION BY user_id, DATE(check_in_time AT TIME ZONE 'UTC')
        ORDER BY check_in_time ASC
      ) as rn
    FROM attendance_records
    WHERE check_in_time IS NOT NULL
  )
  DELETE FROM attendance_records
  WHERE id IN (
    SELECT id FROM ranked_checkins WHERE rn > 1
  );
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RAISE NOTICE 'Removed % duplicate check-in records', deleted_count;
END $$;

-- Drop the index if it exists to recreate it properly
DROP INDEX IF EXISTS idx_unique_daily_checkin;

-- Create a unique index using a date function to prevent duplicate check-ins
-- This will cause INSERT to fail immediately if a user tries to check in twice on the same day
CREATE UNIQUE INDEX idx_unique_daily_checkin 
ON attendance_records (user_id, (DATE(check_in_time AT TIME ZONE 'UTC')))
WHERE check_in_time IS NOT NULL;

-- Add a comment explaining the constraint
COMMENT ON INDEX idx_unique_daily_checkin IS 
'Enforces one check-in per user per day. Prevents duplicate check-ins from race conditions.';

-- Create a function to check for existing check-ins (for better error messages)
CREATE OR REPLACE FUNCTION check_duplicate_checkin()
RETURNS TRIGGER AS $$
DECLARE
  existing_checkin_time TIMESTAMP;
BEGIN
  SELECT check_in_time INTO existing_checkin_time
  FROM attendance_records
  WHERE user_id = NEW.user_id
    AND DATE(check_in_time AT TIME ZONE 'UTC') = DATE(NEW.check_in_time AT TIME ZONE 'UTC')
    AND id != NEW.id;
  
  IF FOUND THEN
    RAISE EXCEPTION 'DUPLICATE_CHECKIN: User has already checked in today at %', 
      TO_CHAR(existing_checkin_time, 'HH12:MI:SS AM');
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to run before INSERT
DROP TRIGGER IF EXISTS prevent_duplicate_checkin ON attendance_records;
CREATE TRIGGER prevent_duplicate_checkin
  BEFORE INSERT ON attendance_records
  FOR EACH ROW
  EXECUTE FUNCTION check_duplicate_checkin();

-- Log the changes
DO $$
BEGIN
  RAISE NOTICE 'Duplicate check-in prevention installed successfully';
  RAISE NOTICE 'Unique index created: idx_unique_daily_checkin';
  RAISE NOTICE 'Trigger created: prevent_duplicate_checkin';
END $$;
