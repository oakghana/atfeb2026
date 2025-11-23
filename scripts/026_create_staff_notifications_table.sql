-- Create staff notifications table for admin and department head messages
CREATE TABLE IF NOT EXISTS staff_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  sender_role VARCHAR(50) NOT NULL,
  sender_label VARCHAR(100) NOT NULL, -- "Management of QCC" or "Department Head"
  message TEXT NOT NULL,
  notification_type VARCHAR(50) NOT NULL, -- 'no_checkin_daily', 'no_checkout_daily', 'no_checkin_weekly', 'no_checkout_weekly'
  is_read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  read_at TIMESTAMP WITH TIME ZONE,
  
  CONSTRAINT fk_recipient FOREIGN KEY (recipient_id) REFERENCES user_profiles(id) ON DELETE CASCADE,
  CONSTRAINT fk_sender FOREIGN KEY (sender_id) REFERENCES user_profiles(id) ON DELETE CASCADE
);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_staff_notifications_recipient ON staff_notifications(recipient_id);
CREATE INDEX IF NOT EXISTS idx_staff_notifications_created_at ON staff_notifications(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_staff_notifications_is_read ON staff_notifications(is_read);

-- Enable RLS
ALTER TABLE staff_notifications ENABLE ROW LEVEL SECURITY;

-- Users can view their own notifications
CREATE POLICY "Users can view their own notifications"
ON staff_notifications FOR SELECT
USING (auth.uid() = recipient_id);

-- Admins and department heads can insert notifications
CREATE POLICY "Admins and dept heads can send notifications"
ON staff_notifications FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM user_profiles
    WHERE id = auth.uid()
    AND role IN ('admin', 'department_head')
  )
);

-- Users can mark their own notifications as read
CREATE POLICY "Users can update their own notifications"
ON staff_notifications FOR UPDATE
USING (auth.uid() = recipient_id);
