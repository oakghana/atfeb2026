-- Add emergency check-out fields to attendance_records table
-- This allows staff to check out within 30 minutes of check-in for genuine emergencies

ALTER TABLE public.attendance_records
ADD COLUMN IF NOT EXISTS is_emergency_checkout BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS emergency_reason TEXT;

-- Add comments for documentation
COMMENT ON COLUMN attendance_records.is_emergency_checkout IS 'Indicates if this check-out was performed as an emergency check-out (within 30 minutes of check-in)';
COMMENT ON COLUMN attendance_records.emergency_reason IS 'Reason provided for emergency check-out';

-- Create index for emergency check-outs for reporting
CREATE INDEX IF NOT EXISTS idx_attendance_records_emergency ON public.attendance_records(is_emergency_checkout) WHERE is_emergency_checkout = true;