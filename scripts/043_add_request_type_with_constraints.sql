-- Migration: Add request_type column to pending_offpremises_checkins table
-- Purpose: Track whether a request is for check-in or check-out operations
-- This allows better management and filtering of off-premises requests

BEGIN;

-- Add request_type column if it doesn't exist
-- DEFAULT 'checkin' for backward compatibility with existing records
ALTER TABLE public.pending_offpremises_checkins
  ADD COLUMN IF NOT EXISTS request_type TEXT DEFAULT 'checkin';

-- Add constraint to ensure only valid request types
ALTER TABLE public.pending_offpremises_checkins
  ADD CONSTRAINT check_valid_request_type 
    CHECK (request_type IN ('checkin', 'checkout'))
    NOT VALID;

-- Validate the constraint (for existing data)
ALTER TABLE public.pending_offpremises_checkins
  VALIDATE CONSTRAINT check_valid_request_type;

-- Create index for faster filtering by request_type
CREATE INDEX IF NOT EXISTS idx_pending_offpremises_request_type
  ON public.pending_offpremises_checkins(request_type);

-- Create index for common query pattern (status + request_type)
CREATE INDEX IF NOT EXISTS idx_pending_offpremises_status_request_type
  ON public.pending_offpremises_checkins(status, request_type);

COMMIT;
