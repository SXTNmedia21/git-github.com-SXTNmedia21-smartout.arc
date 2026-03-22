-- ============================================
-- 20260422100300_payroll_alter_existing.sql
-- Payroll: new fields on existing tables
-- Spec: Section 9 "Extended Existing Tables"
-- Depends on: 20260422100100 (payroll_shift_type exists)
-- ============================================

SET search_path TO public, extensions;

-- --------------------------------------------------------
-- 1. schedule_shift — add payroll fields
-- Already has: department_id, location_id (Cascade A1)
-- Adding: shift_type_id, custom_rate, custom_rate_type, approved_at, approved_by
-- --------------------------------------------------------
ALTER TABLE schedule_shift
  ADD COLUMN IF NOT EXISTS shift_type_id UUID REFERENCES payroll_shift_type(id) ON DELETE SET NULL;

ALTER TABLE schedule_shift
  ADD COLUMN IF NOT EXISTS custom_rate NUMERIC(8,2);

ALTER TABLE schedule_shift
  ADD COLUMN IF NOT EXISTS custom_rate_type payroll_custom_rate_type;

ALTER TABLE schedule_shift
  ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ;

ALTER TABLE schedule_shift
  ADD COLUMN IF NOT EXISTS approved_by UUID REFERENCES profile(profile_id) ON DELETE SET NULL;

COMMENT ON COLUMN schedule_shift.shift_type_id IS 'Payroll: FK to payroll_shift_type. NULL = Normal (default type).';
COMMENT ON COLUMN schedule_shift.custom_rate IS 'Payroll: per-shift rate override. NULL = use employee group rate.';
COMMENT ON COLUMN schedule_shift.custom_rate_type IS 'Payroll: how custom_rate is interpreted — per_hour or per_shift.';
COMMENT ON COLUMN schedule_shift.approved_at IS 'Payroll: when this shift was approved for payroll.';
COMMENT ON COLUMN schedule_shift.approved_by IS 'Payroll: who approved this shift for payroll.';

CREATE INDEX IF NOT EXISTS idx_schedule_shift_type
  ON schedule_shift (shift_type_id) WHERE shift_type_id IS NOT NULL;

-- --------------------------------------------------------
-- 2. profile — add payroll fields
-- Already has: seniority_start_date, has_fagbrev (Cascade A1)
-- Adding: salary_identifier, contracted_weekly_hours
-- --------------------------------------------------------
ALTER TABLE profile
  ADD COLUMN IF NOT EXISTS salary_identifier TEXT;

ALTER TABLE profile
  ADD COLUMN IF NOT EXISTS contracted_weekly_hours NUMERIC(4,1);

COMMENT ON COLUMN profile.salary_identifier IS 'Payroll: employee identifier for Tripletex/external payroll system mapping.';
COMMENT ON COLUMN profile.contracted_weekly_hours IS 'Payroll: contracted weekly hours for schedule compliance display (green/yellow/red). Operational value — may differ from employment_contract.agreed_weekly_hours during transitions.';
