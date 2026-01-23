-- Add working hours configuration to geofence_locations table
-- This allows admins to set custom check-in and check-out times for each location

ALTER TABLE geofence_locations
ADD COLUMN IF NOT EXISTS check_in_start_time TIME DEFAULT '08:00:00',
ADD COLUMN IF NOT EXISTS check_out_end_time TIME DEFAULT '17:00:00',
ADD COLUMN IF NOT EXISTS require_early_checkout_reason BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS working_hours_description TEXT;

-- Add comment to document the columns
COMMENT ON COLUMN geofence_locations.check_in_start_time IS 'Expected check-in start time for this location';
COMMENT ON COLUMN geofence_locations.check_out_end_time IS 'Official check-out time for this location. Leaving before this requires a reason if require_early_checkout_reason is true';
COMMENT ON COLUMN geofence_locations.require_early_checkout_reason IS 'Whether staff need to provide a reason when checking out before check_out_end_time';
COMMENT ON COLUMN geofence_locations.working_hours_description IS 'Optional description of working hours for this location';

-- Update existing locations with appropriate times
-- Tema Port: 8 AM - 4 PM
UPDATE geofence_locations
SET 
  check_in_start_time = '08:00:00',
  check_out_end_time = '16:00:00',
  require_early_checkout_reason = true,
  working_hours_description = 'Tema Port working hours: 8:00 AM - 4:00 PM'
WHERE LOWER(name) LIKE '%tema port%';

-- All other locations default to: 8 AM - 5 PM
UPDATE geofence_locations
SET 
  check_in_start_time = '08:00:00',
  check_out_end_time = '17:00:00',
  require_early_checkout_reason = true,
  working_hours_description = 'Standard working hours: 8:00 AM - 5:00 PM'
WHERE LOWER(name) NOT LIKE '%tema port%';
