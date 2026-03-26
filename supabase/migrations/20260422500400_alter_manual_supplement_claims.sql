-- Employee-initiated supplement claims with approval workflow
-- Employees can submit supplement claims via ShiftClock; leaders approve or reject

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'supplement_claim_status') THEN
    CREATE TYPE supplement_claim_status AS ENUM ('pending', 'approved', 'rejected');
  END IF;
END $$;

ALTER TABLE payroll.manual_supplement
  ADD COLUMN IF NOT EXISTS employee_comment TEXT,
  ADD COLUMN IF NOT EXISTS status supplement_claim_status DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS reviewed_by UUID REFERENCES profile(profile_id),
  ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ;

COMMENT ON COLUMN payroll.manual_supplement.employee_comment IS 'Required for employee-initiated claims via ShiftClock, nullable for admin-created supplements';
COMMENT ON COLUMN payroll.manual_supplement.status IS 'Approval workflow: pending → approved/rejected by leader';
COMMENT ON COLUMN payroll.manual_supplement.reviewed_by IS 'Profile (leader/admin) who reviewed the claim';
COMMENT ON COLUMN payroll.manual_supplement.reviewed_at IS 'When the claim was reviewed';
