-- Add request_type column to pending_offpremises_checkins table (check-in / checkout)
ALTER TABLE public.pending_offpremises_checkins
  ADD COLUMN IF NOT EXISTS request_type TEXT DEFAULT 'checkin';

-- Optional index to speed filtering by request_type
CREATE INDEX IF NOT EXISTS idx_pending_offpremises_request_type
  ON public.pending_offpremises_checkins(request_type);
