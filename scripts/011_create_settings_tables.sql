-- Create settings tables for proper database storage
-- Adding user_settings and system_settings tables for proper settings management

-- User-specific settings table
CREATE TABLE IF NOT EXISTS public.user_settings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    app_settings JSONB DEFAULT '{}',
    notification_settings JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id)
);

-- System-wide settings table (single row)
CREATE TABLE IF NOT EXISTS public.system_settings (
    id INTEGER PRIMARY KEY DEFAULT 1,
    settings JSONB DEFAULT '{}',
    geo_settings JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT single_row CHECK (id = 1)
);

-- Enable RLS
ALTER TABLE public.user_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;

-- Added conditional policy creation to prevent duplicate errors
-- RLS Policies for user_settings
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'user_settings' 
        AND policyname = 'Users can view own settings'
    ) THEN
        CREATE POLICY "Users can view own settings" ON public.user_settings
            FOR SELECT USING (auth.uid() = user_id);
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'user_settings' 
        AND policyname = 'Users can update own settings'
    ) THEN
        CREATE POLICY "Users can update own settings" ON public.user_settings
            FOR ALL USING (auth.uid() = user_id);
    END IF;
END $$;

-- RLS Policies for system_settings (admin only)
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'system_settings' 
        AND policyname = 'Admins can view system settings'
    ) THEN
        CREATE POLICY "Admins can view system settings" ON public.system_settings
            FOR SELECT USING (
                EXISTS (
                    SELECT 1 FROM public.user_profiles 
                    WHERE id = auth.uid() AND role = 'admin'
                )
            );
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'system_settings' 
        AND policyname = 'Admins can update system settings'
    ) THEN
        CREATE POLICY "Admins can update system settings" ON public.system_settings
            FOR ALL USING (
                EXISTS (
                    SELECT 1 FROM public.user_profiles 
                    WHERE id = auth.uid() AND role = 'admin'
                )
            );
    END IF;
END $$;

-- Insert default system settings
INSERT INTO public.system_settings (id, settings, geo_settings) 
VALUES (1, 
    '{"sessionTimeout": "480", "allowOfflineMode": false, "requirePhotoVerification": false, "enableAuditLog": true, "backupFrequency": "daily"}',
    '{"defaultRadius": "20", "allowManualOverride": false, "requireHighAccuracy": true, "maxLocationAge": "300000"}'
) ON CONFLICT (id) DO NOTHING;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_user_settings_user_id ON public.user_settings(user_id);
CREATE INDEX IF NOT EXISTS idx_system_settings_id ON public.system_settings(id);
