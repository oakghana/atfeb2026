-- Add document_url column to leave_requests table
-- Migration: 030_add_document_url_to_leave_requests.sql

-- Add document_url column to store uploaded leave document URLs
ALTER TABLE leave_requests
ADD COLUMN IF NOT EXISTS document_url TEXT;

-- Add comment for documentation
COMMENT ON COLUMN leave_requests.document_url IS 'URL to uploaded leave document in storage';