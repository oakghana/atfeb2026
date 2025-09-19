-- Add is_remote_checkout column to attendance_records table
ALTER TABLE attendance_records 
ADD COLUMN IF NOT EXISTS is_remote_checkout BOOLEAN DEFAULT FALSE;

-- Update existing records to set is_remote_checkout based on location differences
UPDATE attendance_records 
SET is_remote_checkout = (
  CASE 
    WHEN check_in_location_id != check_out_location_id THEN TRUE
    WHEN check_out_location_id IS NULL THEN TRUE
    ELSE FALSE
  END
)
WHERE check_out_time IS NOT NULL;

-- Add comment to the column
COMMENT ON COLUMN attendance_records.is_remote_checkout IS 'Indicates if the checkout was done remotely (not at assigned location)';
