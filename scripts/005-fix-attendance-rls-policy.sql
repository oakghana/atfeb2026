-- Fix the RLS policy for attendance_records UPDATE operations
-- Drop the old policy and recreate it with the WITH CHECK clause

DROP POLICY IF EXISTS "Users can update their own attendance" ON public.attendance_records;

CREATE POLICY "Users can update their own attendance" ON public.attendance_records
    FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Verify the policy was created
SELECT schemaname, tablename, policyname, permissive, roles, qual, with_check
FROM pg_policies
WHERE tablename = 'attendance_records' AND policyname = 'Users can update their own attendance';
