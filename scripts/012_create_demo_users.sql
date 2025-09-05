-- Removed direct INSERT into user_profiles to avoid foreign key constraint violation
-- Create demo users for Head of Department and Administrators
-- These users are for demonstration and testing purposes
-- Note: Users must sign up through the authentication system to activate these profiles

-- Create trigger function to auto-assign roles and create profiles for demo users
CREATE OR REPLACE FUNCTION create_demo_user_profile()
RETURNS TRIGGER AS $$
BEGIN
    -- Check if this is a demo HOD user
    IF NEW.email = 'hod.academic@qccgh.com' THEN
        INSERT INTO public.user_profiles (
            id, email, first_name, last_name, employee_id, role, position, hire_date, is_active, created_at, updated_at
        ) VALUES (
            NEW.id, NEW.email, 'Dr. Kwame', 'Asante', 'QCC-HOD-001', 'department_head', 'Head of Academic Affairs', '2010-01-15', true, NOW(), NOW()
        );
    ELSIF NEW.email = 'hod.student@qccgh.com' THEN
        INSERT INTO public.user_profiles (
            id, email, first_name, last_name, employee_id, role, position, hire_date, is_active, created_at, updated_at
        ) VALUES (
            NEW.id, NEW.email, 'Mrs. Akosua', 'Mensah', 'QCC-HOD-002', 'department_head', 'Head of Student Affairs', '2012-03-01', true, NOW(), NOW()
        );
    ELSIF NEW.email = 'hod.finance@qccgh.com' THEN
        INSERT INTO public.user_profiles (
            id, email, first_name, last_name, employee_id, role, position, hire_date, is_active, created_at, updated_at
        ) VALUES (
            NEW.id, NEW.email, 'Mr. Kofi', 'Boateng', 'QCC-HOD-003', 'department_head', 'Head of Finance Department', '2015-06-01', true, NOW(), NOW()
        );
    ELSIF NEW.email = 'admin.system@qccgh.com' THEN
        INSERT INTO public.user_profiles (
            id, email, first_name, last_name, employee_id, role, position, hire_date, is_active, created_at, updated_at
        ) VALUES (
            NEW.id, NEW.email, 'Mr. Emmanuel', 'Osei', 'QCC-ADM-001', 'admin', 'System Administrator', '2018-01-10', true, NOW(), NOW()
        );
    ELSIF NEW.email = 'admin.hr@qccgh.com' THEN
        INSERT INTO public.user_profiles (
            id, email, first_name, last_name, employee_id, role, position, hire_date, is_active, created_at, updated_at
        ) VALUES (
            NEW.id, NEW.email, 'Ms. Abena', 'Adjei', 'QCC-ADM-002', 'admin', 'HR Administrator', '2016-08-15', true, NOW(), NOW()
        );
    ELSIF NEW.email = 'admin.ops@qccgh.com' THEN
        INSERT INTO public.user_profiles (
            id, email, first_name, last_name, employee_id, role, position, hire_date, is_active, created_at, updated_at
        ) VALUES (
            NEW.id, NEW.email, 'Mr. Yaw', 'Appiah', 'QCC-ADM-003', 'admin', 'Operations Administrator', '2014-04-20', true, NOW(), NOW()
        );
    END IF;
    
    -- Added audit logging for demo user creation
    IF NEW.email IN ('hod.academic@qccgh.com', 'hod.student@qccgh.com', 'hod.finance@qccgh.com', 'admin.system@qccgh.com', 'admin.hr@qccgh.com', 'admin.ops@qccgh.com') THEN
        INSERT INTO public.audit_logs (
            user_id, action, table_name, record_id, old_values, new_values, ip_address, user_agent, created_at
        ) VALUES (
            NEW.id, 'CREATE', 'user_profiles', NEW.id, '{}', 
            json_build_object('email', NEW.email, 'role', 'demo_user', 'created_via', 'demo_script'),
            '127.0.0.1', 'QCC Demo System', NOW()
        );
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop existing trigger if it exists and create new one
DROP TRIGGER IF EXISTS demo_user_role_trigger ON auth.users;

CREATE TRIGGER demo_user_profile_trigger
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION create_demo_user_profile();

-- Display instructions for demo users
DO $BODY$
BEGIN
    RAISE NOTICE 'Demo users configured successfully!';
    RAISE NOTICE 'To activate demo accounts, users must sign up at /auth/signup with these emails:';
    RAISE NOTICE '- HOD Academic Affairs: hod.academic@qccgh.com (password: pa$w0rd)';
    RAISE NOTICE '- HOD Student Affairs: hod.student@qccgh.com (password: pa$w0rd)';
    RAISE NOTICE '- HOD Finance: hod.finance@qccgh.com (password: pa$w0rd)';
    RAISE NOTICE '- System Admin: admin.system@qccgh.com (password: pa$w0rd)';
    RAISE NOTICE '- HR Admin: admin.hr@qccgh.com (password: pa$w0rd)';
    RAISE NOTICE '- Operations Admin: admin.ops@qccgh.com (password: pa$w0rd)';
END $BODY$;
