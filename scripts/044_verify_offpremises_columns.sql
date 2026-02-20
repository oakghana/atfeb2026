-- Verify and execute migration to add off-premises workflow columns if not already present
-- Check if columns exist and add them if missing

-- Add approval_status column if it doesn't exist
ALTER TABLE attendance_records
ADD COLUMN IF NOT EXISTS approval_status TEXT DEFAULT 'normal_checkin';

-- Add off_premises_request_id column if it doesn't exist  
ALTER TABLE attendance_records
ADD COLUMN IF NOT EXISTS off_premises_request_id UUID;

-- Add supervisor_approval_remarks column if it doesn't exist
ALTER TABLE attendance_records
ADD COLUMN IF NOT EXISTS supervisor_approval_remarks TEXT;

-- Add on_official_duty_outside_premises column if it doesn't exist
ALTER TABLE attendance_records
ADD COLUMN IF NOT EXISTS on_official_duty_outside_premises BOOLEAN DEFAULT false;

-- Verify the columns were added
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'attendance_records'
AND column_name IN ('approval_status', 'off_premises_request_id', 'supervisor_approval_remarks', 'on_official_duty_outside_premises')
ORDER BY ordinal_position;
