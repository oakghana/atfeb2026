-- Create staff_warnings table for formal notifications from management and department heads
-- This replaces the staff_notifications approach with a proper warnings system

CREATE TABLE IF NOT EXISTS public.staff_warnings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  sender_role VARCHAR(50) NOT NULL, -- 'admin', 'department_head'
  sender_label VARCHAR(100) NOT NULL, -- 'Management of QCC' or 'Head of [Department]'
  subject VARCHAR(255) NOT NULL,
  message TEXT NOT NULL,
  warning_type VARCHAR(50) NOT NULL, -- 'daily_absence', 'weekly_absence', 'no_checkout', 'early_checkout'
  is_read BOOLEAN DEFAULT FALSE,
  read_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  attendance_date DATE,
  department_id UUID REFERENCES public.departments(id)
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_staff_warnings_recipient ON public.staff_warnings(recipient_id);
CREATE INDEX IF NOT EXISTS idx_staff_warnings_created_at ON public.staff_warnings(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_staff_warnings_is_read ON public.staff_warnings(is_read);
CREATE INDEX IF NOT EXISTS idx_staff_warnings_sender ON public.staff_warnings(sender_id);

-- Enable RLS
ALTER TABLE public.staff_warnings ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view their own warnings
CREATE POLICY "Users can view their own warnings" ON public.staff_warnings
  FOR SELECT
  USING (recipient_id = auth.uid());

-- Policy: Admins and department heads can insert warnings
CREATE POLICY "Admins and dept heads can send warnings" ON public.staff_warnings
  FOR INSERT
  WITH CHECK (
    sender_id = auth.uid() AND
    EXISTS (
      SELECT 1 FROM public.user_profiles
      WHERE id = auth.uid() AND role IN ('admin', 'department_head')
    )
  );

-- Policy: Users can update their own warnings (mark as read)
CREATE POLICY "Users can mark warnings as read" ON public.staff_warnings
  FOR UPDATE
  USING (recipient_id = auth.uid())
  WITH CHECK (recipient_id = auth.uid());

-- Policy: Admins can view all warnings
CREATE POLICY "Admins can view all warnings" ON public.staff_warnings
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.user_profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

COMMENT ON TABLE public.staff_warnings IS 'Formal warnings and notifications sent by management and department heads to staff regarding attendance issues';
