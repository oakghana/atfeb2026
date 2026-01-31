-- Add document_url column to leave_requests table
-- This migration adds support for storing document URLs in leave requests

ALTER TABLE leave_requests
ADD COLUMN IF NOT EXISTS document_url TEXT;

-- Add comment for documentation
COMMENT ON COLUMN leave_requests.document_url IS 'URL to uploaded leave document in storage';