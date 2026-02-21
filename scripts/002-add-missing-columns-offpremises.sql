-- Add missing columns to pending_offpremises_checkins table
-- These columns are expected by the API but were missing from the initial schema

ALTER TABLE public.pending_offpremises_checkins 
ADD COLUMN IF NOT EXISTS reason TEXT,
ADD COLUMN IF NOT EXISTS request_type TEXT DEFAULT 'checkin';

-- Update existing records to have the default request_type
UPDATE public.pending_offpremises_checkins 
SET request_type = 'checkin' 
WHERE request_type IS NULL;

-- Add a check constraint to ensure valid request types
ALTER TABLE public.pending_offpremises_checkins 
ADD CONSTRAINT check_request_type CHECK (request_type IN ('checkin', 'checkout'));

-- Create an index on request_type for filtering
CREATE INDEX IF NOT EXISTS idx_pending_offpremises_request_type ON public.pending_offpremises_checkins(request_type);
