-- Add mobile device tolerance to system settings
UPDATE system_settings
SET geo_settings = jsonb_set(
  COALESCE(geo_settings, '{}'::jsonb),
  '{mobileDeviceTolerance}',
  '50'
)
WHERE id = 1;

-- Verify the setting was added
SELECT 
  geo_settings->>'mobileDeviceTolerance' as mobile_tolerance,
  geo_settings->'browserTolerances'->>'edge' as edge_tolerance,
  geo_settings->'browserTolerances'->>'chrome' as chrome_tolerance
FROM system_settings
WHERE id = 1;
