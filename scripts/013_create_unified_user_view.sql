-- Create a comprehensive view that shows all user information in one place
-- This gives you a single table view while maintaining security

-- Drop existing view if it exists
DROP VIEW IF EXISTS public.unified_user_management;

-- Simplified view creation without direct auth.users access and RLS policies
CREATE OR REPLACE VIEW public.unified_user_management AS
SELECT 
    up.id as user_id,
    up.employee_id,
    up.first_name,
    up.last_name,
    (up.first_name || ' ' || up.last_name) as full_name,
    up.email,
    up.phone,
    up.role,
    up.position,
    up.is_active,
    up.hire_date,
    up.created_at as profile_created,
    up.updated_at as profile_updated,
    
    -- Department information
    d.name as department_name,
    d.code as department_code,
    
    -- Simplified authentication status without direct auth.users access
    CASE 
        WHEN up.is_active = true THEN 'Active'
        ELSE 'Pending Activation'
    END as auth_status,
    
    -- Last login information from audit logs
    COALESCE(
        (SELECT MAX(created_at) 
         FROM audit_logs al 
         WHERE al.user_id = up.id 
         AND al.action = 'login'
        ), 
        up.created_at
    ) as last_login,
    
    -- Login method preference
    CASE 
        WHEN up.employee_id IS NOT NULL THEN 'Staff Number: ' || up.employee_id
        ELSE 'Email Only'
    END as login_method,
    
    -- Account setup status
    CASE 
        WHEN up.is_active = false THEN 'Inactive'
        WHEN up.is_active = true THEN 'Ready'
        ELSE 'Pending Setup'
    END as account_status

FROM user_profiles up
LEFT JOIN departments d ON up.department_id = d.id
ORDER BY up.created_at DESC;

-- Grant access to authenticated users
GRANT SELECT ON public.unified_user_management TO authenticated;

-- Removed RLS policy creation on view (not supported) and moved to table level

-- Create function to get user count by role
CREATE OR REPLACE FUNCTION get_user_stats()
RETURNS TABLE (
    total_users bigint,
    active_users bigint,
    admin_users bigint,
    staff_users bigint,
    department_heads bigint
) 
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        COUNT(*) as total_users,
        COUNT(*) FILTER (WHERE is_active = true) as active_users,
        COUNT(*) FILTER (WHERE role = 'admin') as admin_users,
        COUNT(*) FILTER (WHERE role = 'staff') as staff_users,
        COUNT(*) FILTER (WHERE role = 'department_head') as department_heads
    FROM user_profiles;
END;
$$;

-- Create function to get user password reset status
CREATE OR REPLACE FUNCTION get_user_auth_info(user_email text)
RETURNS TABLE (
    email_confirmed boolean,
    last_sign_in timestamp with time zone,
    created_at timestamp with time zone
) 
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        au.email_confirmed_at IS NOT NULL as email_confirmed,
        au.last_sign_in_at,
        au.created_at
    FROM auth.users au
    WHERE au.email = user_email;
END;
$$;

-- Create comprehensive user management functions
CREATE OR REPLACE FUNCTION create_complete_user(
    p_email text,
    p_first_name text,
    p_last_name text,
    p_employee_id text DEFAULT NULL,
    p_role text DEFAULT 'staff',
    p_department_id uuid DEFAULT NULL,
    p_position text DEFAULT NULL,
    p_phone text DEFAULT NULL
)
RETURNS uuid
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
    new_user_id uuid;
BEGIN
    -- Generate new UUID for user
    new_user_id := gen_random_uuid();
    
    -- Insert user profile
    INSERT INTO user_profiles (
        id,
        email,
        first_name,
        last_name,
        employee_id,
        role,
        department_id,
        position,
        phone,
        is_active
    ) VALUES (
        new_user_id,
        p_email,
        p_first_name,
        p_last_name,
        p_employee_id,
        p_role,
        p_department_id,
        p_position,
        p_phone,
        true
    );
    
    -- Log the user creation
    INSERT INTO audit_logs (
        user_id,
        action,
        table_name,
        new_values
    ) VALUES (
        auth.uid(),
        'create_user',
        'user_profiles',
        jsonb_build_object(
            'new_user_id', new_user_id,
            'email', p_email,
            'role', p_role
        )
    );
    
    RETURN new_user_id;
END;
$$;

-- Create function to activate/deactivate users
CREATE OR REPLACE FUNCTION toggle_user_status(
    p_user_id uuid,
    p_is_active boolean
)
RETURNS boolean
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
    -- Update user status
    UPDATE user_profiles 
    SET 
        is_active = p_is_active,
        updated_at = now()
    WHERE id = p_user_id;
    
    -- Log the status change
    INSERT INTO audit_logs (
        user_id,
        action,
        table_name,
        record_id,
        new_values
    ) VALUES (
        auth.uid(),
        'status_change',
        'user_profiles',
        p_user_id,
        jsonb_build_object('is_active', p_is_active)
    );
    
    RETURN true;
END;
$$;

-- Create notification for admin about user management improvements
DO $$
BEGIN
    RAISE NOTICE '=== UNIFIED USER MANAGEMENT SYSTEM CREATED ===';
    RAISE NOTICE '';
    RAISE NOTICE 'New Features Available:';
    RAISE NOTICE '1. unified_user_management VIEW - See all users in one table';
    RAISE NOTICE '2. create_complete_user() - Add users easily';
    RAISE NOTICE '3. toggle_user_status() - Activate/deactivate users';
    RAISE NOTICE '4. get_user_auth_info() - Check authentication status';
    RAISE NOTICE '5. get_user_stats() - Get user statistics by role';
    RAISE NOTICE '';
    RAISE NOTICE 'Access the unified view: SELECT * FROM unified_user_management;';
    RAISE NOTICE '';
    RAISE NOTICE 'SECURITY NOTE: Passwords remain secure in auth.users table';
    RAISE NOTICE 'This is required for security - passwords are encrypted/hashed';
END;
$$;
