-- Add assigned_location_id field to user_profiles table
ALTER TABLE public.user_profiles 
ADD COLUMN IF NOT EXISTS assigned_location_id UUID REFERENCES public.geofence_locations(id);

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_user_profiles_assigned_location ON public.user_profiles(assigned_location_id);

-- Update RLS policies to allow admins to manage location assignments
CREATE POLICY "Admins can update all profiles" ON public.user_profiles
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM public.user_profiles 
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

CREATE POLICY "Admins can insert profiles" ON public.user_profiles
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.user_profiles 
            WHERE id = auth.uid() AND role = 'admin'
        )
    );
