-- Create system_backups table for tracking backup operations
CREATE TABLE IF NOT EXISTS system_backups (
  id TEXT PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  size_bytes BIGINT NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending',
  metadata JSONB,
  error_message TEXT,
  completed_at TIMESTAMP WITH TIME ZONE
);

-- Create index for efficient querying
CREATE INDEX IF NOT EXISTS idx_system_backups_created_at ON system_backups(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_system_backups_status ON system_backups(status);

-- Add RLS policy for admin access only
ALTER TABLE system_backups ENABLE ROW LEVEL SECURITY;

-- create policy only if it doesn't already exist (avoid error on repeated runs)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'system_backups' AND policyname = 'Admin can manage backups'
  ) THEN
    CREATE POLICY "Admin can manage backups" ON system_backups
      FOR ALL USING (
        EXISTS (
          SELECT 1 FROM user_profiles 
          WHERE user_profiles.id = auth.uid() 
          AND user_profiles.role = 'admin'
        )
      );
  END IF;
END$$;
