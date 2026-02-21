-- Add missing columns to pending_offpremises_checkins table
-- These columns are expected by the API but were missing from the initial schema

ALTER TABLE public.pending_offpremises_checkins 
ADD COLUMN IF NOT EXISTS reason TEXT,
ADD COLUMN IF NOT EXISTS request_type TEXT DEFAULT 'checkin',
ADD COLUMN IF NOT EXISTS google_maps_name TEXT;

-- Update existing records to have the default request_type
UPDATE public.pending_offpremises_checkins 
SET request_type = 'checkin' 
WHERE request_type IS NULL;

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_pending_offpremises_request_type ON public.pending_offpremises_checkins(request_type);
CREATE INDEX IF NOT EXISTS idx_pending_offpremises_google_maps_name ON public.pending_offpremises_checkins(google_maps_name);
