-- Migration: Add emergency_check_in_overrides table for audit of override requests
-- Run this in your Postgres DB (Supabase SQL editor / psql)

BEGIN;

-- Create the enum type for override categories if it doesn't already exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'override_type_enum') THEN
        CREATE TYPE override_type_enum AS ENUM (
            'time_restriction',
            'location_restriction',
            'leave_override',
            'device_sharing'
        );
    END IF;
END$$;

-- Create the table
CREATE TABLE IF NOT EXISTS public.emergency_check_in_overrides (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    check_in_time timestamptz NOT NULL,
    check_out_time timestamptz NULL,
    override_type override_type_enum NOT NULL,
    reason text NOT NULL,
    is_security_staff boolean NOT NULL DEFAULT FALSE,
    is_operational_staff boolean NOT NULL DEFAULT FALSE,
    is_transport_staff boolean NOT NULL DEFAULT FALSE,
    approved_by_manager boolean NOT NULL DEFAULT FALSE,
    manager_id uuid NULL REFERENCES auth.users(id) ON DELETE SET NULL,
    audit_notes text NULL,
    created_at timestamptz NOT NULL DEFAULT now()
);

-- Ensure index on user_id for lookup performance
CREATE INDEX IF NOT EXISTS idx_emergency_override_user ON public.emergency_check_in_overrides(user_id);

-- Enable Row Level Security and policies
ALTER TABLE public.emergency_check_in_overrides ENABLE ROW LEVEL SECURITY;

-- Policy: users can insert their own override records
CREATE POLICY "Users can insert their own overrides" ON public.emergency_check_in_overrides
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Policy: users can view their own overrides
CREATE POLICY "Users can view their own overrides" ON public.emergency_check_in_overrides
    FOR SELECT USING (auth.uid() = user_id);

-- Policy: admins/department heads/regional managers can view all overrides for auditing
CREATE POLICY "Managers can view all overrides" ON public.emergency_check_in_overrides
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.user_profiles
            WHERE id = auth.uid() AND role IN ('admin','department_head','regional_manager')
        )
    );

COMMIT;

-- After running this migration, the system will record any time/location/leave/device override attempts by eligible staff.
