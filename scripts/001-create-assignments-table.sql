-- Create staff_assignments table for tracking off-location work assignments
CREATE TABLE IF NOT EXISTS staff_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  assigned_by_id UUID NOT NULL REFERENCES auth.users(id),
  assignment_date DATE NOT NULL,
  reason TEXT NOT NULL,
  location_description TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  requires_confirmation BOOLEAN DEFAULT false,
  auto_checkin BOOLEAN DEFAULT false,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create assignment_approvals table for tracking approval workflow
CREATE TABLE IF NOT EXISTS assignment_approvals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_id UUID NOT NULL REFERENCES staff_assignments(id) ON DELETE CASCADE,
  approver_id UUID NOT NULL REFERENCES auth.users(id),
  approval_status TEXT NOT NULL DEFAULT 'pending',
  approval_level TEXT NOT NULL,
  comments TEXT,
  approved_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create assignment_checkins table to track auto-checkins for assignments
CREATE TABLE IF NOT EXISTS assignment_checkins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_id UUID NOT NULL REFERENCES staff_assignments(id) ON DELETE CASCADE,
  attendance_record_id UUID REFERENCES attendance_records(id) ON DELETE SET NULL,
  checkin_time TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  checkout_time TIMESTAMP WITH TIME ZONE,
  on_assignment BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_staff_assignments_user_id ON staff_assignments(user_id);
CREATE INDEX IF NOT EXISTS idx_staff_assignments_assigned_by_id ON staff_assignments(assigned_by_id);
CREATE INDEX IF NOT EXISTS idx_staff_assignments_assignment_date ON staff_assignments(assignment_date);
CREATE INDEX IF NOT EXISTS idx_staff_assignments_status ON staff_assignments(status);
CREATE INDEX IF NOT EXISTS idx_assignment_approvals_assignment_id ON assignment_approvals(assignment_id);
CREATE INDEX IF NOT EXISTS idx_assignment_approvals_approver_id ON assignment_approvals(approver_id);
CREATE INDEX IF NOT EXISTS idx_assignment_checkins_assignment_id ON assignment_checkins(assignment_id);
