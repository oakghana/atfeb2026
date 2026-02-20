-- Add off-premises workflow columns to attendance_records table
-- These columns enable tracking of pending supervisor approvals and off-premises status

ALTER TABLE attendance_records
ADD COLUMN IF NOT EXISTS off_premises_request_id UUID REFERENCES pending_offpremises_checkins(id) ON DELETE SET NULL;

ALTER TABLE attendance_records
ADD COLUMN IF NOT EXISTS approval_status VARCHAR DEFAULT 'normal_checkin' CHECK (approval_status IN ('pending_supervisor_approval', 'approved_offpremises', 'normal_checkin'));

ALTER TABLE attendance_records
ADD COLUMN IF NOT EXISTS supervisor_approval_remarks TEXT;

-- Create index for faster lookups of pending approvals
CREATE INDEX IF NOT EXISTS idx_attendance_approval_status ON attendance_records(user_id, approval_status, attendance_date);

CREATE INDEX IF NOT EXISTS idx_attendance_offpremises_request ON attendance_records(off_premises_request_id);

-- Add column to track if user is on official duty outside premises
ALTER TABLE attendance_records
ADD COLUMN IF NOT EXISTS on_official_duty_outside_premises BOOLEAN DEFAULT false;

-- Log completion
SELECT 'Off-premises workflow columns added successfully' AS status;
