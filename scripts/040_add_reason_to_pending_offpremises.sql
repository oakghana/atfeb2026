-- Add reason column to pending_offpremises_checkins table
ALTER TABLE public.pending_offpremises_checkins
ADD COLUMN IF NOT EXISTS reason TEXT;

-- Add google_maps_name to pending_offpremises_checkins if not exists
ALTER TABLE public.pending_offpremises_checkins
ADD COLUMN IF NOT EXISTS google_maps_name TEXT;
