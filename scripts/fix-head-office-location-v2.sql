-- Fix Head Office location - Version 2
-- Remove ON CONFLICT since there's no unique constraint on name
-- Instead, check if location exists and update or insert accordingly

-- First, deactivate existing incorrect Head Office entries
UPDATE geofence_locations 
SET is_active = false, updated_at = NOW()
WHERE name IN ('HEAD OFFICE SWANZY ARCADE', 'Head Office,Accra,Ghana')
AND (latitude != 5.5519688 OR longitude != -0.21158002);

-- Insert the correct Head Office location
-- Use a simple INSERT since we're deactivating conflicting entries above
INSERT INTO geofence_locations (
    id,
    name,
    address,
    latitude,
    longitude,
    radius_meters,
    is_active,
    created_at,
    updated_at
) VALUES (
    gen_random_uuid(),
    'QCC Head Office',
    'Head Office, Accra, Ghana',
    5.5519688,
    -0.21158002,
    50,
    true,
    NOW(),
    NOW()
);

-- Verify the changes
SELECT name, address, latitude, longitude, radius_meters, is_active
FROM geofence_locations 
WHERE name ILIKE '%head office%' OR name ILIKE '%office%'
ORDER BY is_active DESC, name;
