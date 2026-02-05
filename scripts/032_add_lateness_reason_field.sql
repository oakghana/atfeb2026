-- Add lateness_reason field to attendance_records table
ALTER TABLE attendance_records
ADD COLUMN IF NOT EXISTS lateness_reason TEXT;

-- Add comment to explain the field
COMMENT ON COLUMN attendance_records.lateness_reason IS 'Reason provided by staff when checking in after 9:00 AM';