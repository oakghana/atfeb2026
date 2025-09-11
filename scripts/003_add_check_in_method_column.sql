-- Add check_in_method column to attendance_records table
ALTER TABLE attendance_records 
ADD COLUMN IF NOT EXISTS check_in_method VARCHAR(50) DEFAULT 'GPS';

-- Add check_out_method column to attendance_records table  
ALTER TABLE attendance_records 
ADD COLUMN IF NOT EXISTS check_out_method VARCHAR(50);

-- Update existing records to have GPS as default method
UPDATE attendance_records 
SET check_in_method = 'GPS' 
WHERE check_in_method IS NULL;

-- Add index for better performance on method queries
CREATE INDEX IF NOT EXISTS idx_attendance_records_check_in_method 
ON attendance_records(check_in_method);

-- Add comments for documentation
COMMENT ON COLUMN attendance_records.check_in_method IS 'Method used for check-in: GPS, QR_CODE, MANUAL';
COMMENT ON COLUMN attendance_records.check_out_method IS 'Method used for check-out: GPS, QR_CODE, MANUAL';
