-- Create three test users: Staff, Administrator, and Head of Department
-- Each user will be auto-configured when they sign up with their respective emails

-- Clear any existing test users first
DELETE FROM user_profiles WHERE email IN (
    'staff.user@qccgh.com',
    'admin.user@qccgh.com', 
    'hod.user@qccgh.com'
);

-- Create trigger function for the three test users
CREATE OR REPLACE FUNCTION setup_three_test_users()
RETURNS TRIGGER AS $$
BEGIN
    -- Staff User
    IF NEW.email = 'staff.user@qccgh.com' THEN
        INSERT INTO user_profiles (
            id,
            employee_id,
            first_name,
            last_name,
            email,
            phone,
            department_id,
            position,
            role,
            hire_date,
            is_active,
            created_at,
            updated_at
        ) VALUES (
            NEW.id,
            '2000001',
            'John',
            'Mensah',
            NEW.email,
            '+233244123456',
            (SELECT id FROM departments WHERE code = 'OPS' LIMIT 1),
            'Operations Officer',
            'staff',
            '2024-01-15',
            true,
            NOW(),
            NOW()
        ) ON CONFLICT (id) DO UPDATE SET
            employee_id = EXCLUDED.employee_id,
            first_name = EXCLUDED.first_name,
            last_name = EXCLUDED.last_name,
            role = EXCLUDED.role,
            department_id = EXCLUDED.department_id,
            position = EXCLUDED.position,
            is_active = true,
            updated_at = NOW();
            
        -- Log the staff user creation
        INSERT INTO audit_logs (
            user_id,
            action,
            table_name,
            record_id,
            old_values,
            new_values,
            ip_address,
            user_agent,
            created_at
        ) VALUES (
            NEW.id,
            'CREATE',
            'user_profiles',
            NEW.id::text,
            '{}',
            jsonb_build_object(
                'email', NEW.email,
                'role', 'staff',
                'employee_id', '2000001'
            ),
            '127.0.0.1',
            'System Auto-Setup',
            NOW()
        );
        
    -- Administrator User
    ELSIF NEW.email = 'admin.user@qccgh.com' THEN
        INSERT INTO user_profiles (
            id,
            employee_id,
            first_name,
            last_name,
            email,
            phone,
            department_id,
            position,
            role,
            hire_date,
            is_active,
            created_at,
            updated_at
        ) VALUES (
            NEW.id,
            '1000001',
            'Sarah',
            'Asante',
            NEW.email,
            '+233244987654',
            (SELECT id FROM departments WHERE code = 'IT' LIMIT 1),
            'System Administrator',
            'admin',
            '2023-06-01',
            true,
            NOW(),
            NOW()
        ) ON CONFLICT (id) DO UPDATE SET
            employee_id = EXCLUDED.employee_id,
            first_name = EXCLUDED.first_name,
            last_name = EXCLUDED.last_name,
            role = EXCLUDED.role,
            department_id = EXCLUDED.department_id,
            position = EXCLUDED.position,
            is_active = true,
            updated_at = NOW();
            
        -- Log the admin user creation
        INSERT INTO audit_logs (
            user_id,
            action,
            table_name,
            record_id,
            old_values,
            new_values,
            ip_address,
            user_agent,
            created_at
        ) VALUES (
            NEW.id,
            'CREATE',
            'user_profiles',
            NEW.id::text,
            '{}',
            jsonb_build_object(
                'email', NEW.email,
                'role', 'admin',
                'employee_id', '1000001'
            ),
            '127.0.0.1',
            'System Auto-Setup',
            NOW()
        );
        
    -- Head of Department User
    ELSIF NEW.email = 'hod.user@qccgh.com' THEN
        INSERT INTO user_profiles (
            id,
            employee_id,
            first_name,
            last_name,
            email,
            phone,
            department_id,
            position,
            role,
            hire_date,
            is_active,
            created_at,
            updated_at
        ) VALUES (
            NEW.id,
            '3000001',
            'Michael',
            'Osei',
            NEW.email,
            '+233244555777',
            (SELECT id FROM departments WHERE code = 'HR' LIMIT 1),
            'Head of Human Resources',
            'department_head',
            '2022-03-10',
            true,
            NOW(),
            NOW()
        ) ON CONFLICT (id) DO UPDATE SET
            employee_id = EXCLUDED.employee_id,
            first_name = EXCLUDED.first_name,
            last_name = EXCLUDED.last_name,
            role = EXCLUDED.role,
            department_id = EXCLUDED.department_id,
            position = EXCLUDED.position,
            is_active = true,
            updated_at = NOW();
            
        -- Log the HOD user creation
        INSERT INTO audit_logs (
            user_id,
            action,
            table_name,
            record_id,
            old_values,
            new_values,
            ip_address,
            user_agent,
            created_at
        ) VALUES (
            NEW.id,
            'CREATE',
            'user_profiles',
            NEW.id::text,
            '{}',
            jsonb_build_object(
                'email', NEW.email,
                'role', 'department_head',
                'employee_id', '3000001'
            ),
            '127.0.0.1',
            'System Auto-Setup',
            NOW()
        );
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for the three test users
DROP TRIGGER IF EXISTS setup_three_test_users_trigger ON auth.users;
CREATE TRIGGER setup_three_test_users_trigger
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION setup_three_test_users();

-- Create a view to show the three test users information
CREATE OR REPLACE VIEW three_test_users_info AS
SELECT 
    'staff.user@qccgh.com' as email,
    '2000001' as staff_number,
    'pa$$w0rd' as password,
    'staff' as role,
    'John Mensah' as full_name,
    'Operations Officer' as position,
    'Must sign up first at /auth/signup' as login_note
UNION ALL
SELECT 
    'admin.user@qccgh.com' as email,
    '1000001' as staff_number,
    'pa$$w0rd' as password,
    'admin' as role,
    'Sarah Asante' as full_name,
    'System Administrator' as position,
    'Must sign up first at /auth/signup' as login_note
UNION ALL
SELECT 
    'hod.user@qccgh.com' as email,
    '3000001' as staff_number,
    'pa$$w0rd' as password,
    'department_head' as role,
    'Michael Osei' as full_name,
    'Head of Human Resources' as position,
    'Must sign up first at /auth/signup' as login_note;

-- Grant permissions
GRANT SELECT ON three_test_users_info TO authenticated;
GRANT SELECT ON three_test_users_info TO anon;

COMMENT ON VIEW three_test_users_info IS 'Information about the three test users for QCC Electronic Attendance App';
