-- Cascade Foundation Phase B — New tables + ALTER statements
-- Spec: docs/superpowers/specs/2026-03-22-cascade-foundation-completion-design.md

-- ========================================
-- 0. Enum additions
-- ========================================
ALTER TYPE change_proposal_status ADD VALUE IF NOT EXISTS 'failed';

-- ========================================
-- 1. workspace_operating_hours (base hours)
-- ========================================
CREATE TABLE IF NOT EXISTS public.workspace_operating_hours (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspace(workspace_id) ON DELETE CASCADE,
  day_of_week INT NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),  -- 0=Mon..6=Sun (ISO)
  open_time TIME,
  close_time TIME,
  is_closed BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, day_of_week)
);

CREATE TRIGGER set_workspace_operating_hours_updated_at
  BEFORE UPDATE ON public.workspace_operating_hours
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

ALTER TABLE workspace_operating_hours ENABLE ROW LEVEL SECURITY;

CREATE POLICY "jwt_select_workspace_hours" ON workspace_operating_hours
  FOR SELECT USING (workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid())));
CREATE POLICY "jwt_insert_workspace_hours" ON workspace_operating_hours
  FOR INSERT WITH CHECK (workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid())));
CREATE POLICY "jwt_update_workspace_hours" ON workspace_operating_hours
  FOR UPDATE USING (workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid())));
CREATE POLICY "api_key_read_workspace_hours" ON workspace_operating_hours
  FOR SELECT USING (workspace_id = (current_setting('app.workspace_id', true))::uuid);

COMMENT ON TABLE workspace_operating_hours IS 'Cascade D1: Workspace base operating hours. One row per weekday. Departments derive hours from these via offsets.';

-- ========================================
-- 2. payroll_profile_template
-- ========================================
CREATE TABLE IF NOT EXISTS public.payroll_profile_template (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspace(workspace_id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  salary_type TEXT NOT NULL CHECK (salary_type IN ('hourly', 'monthly')),
  agreed_weekly_hours NUMERIC(4,2),
  tariff_category TEXT,
  employment_category TEXT,
  is_system_template BOOLEAN DEFAULT false,
  is_locked BOOLEAN DEFAULT false,
  seed_source TEXT,
  seed_version TEXT,
  seeded_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, name)
);

CREATE TRIGGER set_payroll_profile_template_updated_at
  BEFORE UPDATE ON public.payroll_profile_template
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

ALTER TABLE payroll_profile_template ENABLE ROW LEVEL SECURITY;

CREATE POLICY "jwt_select_payroll_template" ON payroll_profile_template
  FOR SELECT USING (workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid())));
CREATE POLICY "jwt_insert_payroll_template" ON payroll_profile_template
  FOR INSERT WITH CHECK (workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid())));
CREATE POLICY "jwt_update_payroll_template" ON payroll_profile_template
  FOR UPDATE USING (workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid())));
CREATE POLICY "api_key_read_payroll_template" ON payroll_profile_template
  FOR SELECT USING (workspace_id = (current_setting('app.workspace_id', true))::uuid);

COMMENT ON TABLE payroll_profile_template IS 'Cascade D2: Pre-defined payroll configurations. Seeded from I1 hospitality package, admin-managed at runtime.';

-- ========================================
-- 3. workspace_bootstrap_run
-- ========================================
CREATE TABLE IF NOT EXISTS public.workspace_bootstrap_run (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspace(workspace_id) ON DELETE CASCADE,
  source_path TEXT NOT NULL CHECK (source_path IN ('onboarding', 'join', 'manual')),
  status TEXT NOT NULL CHECK (status IN ('running', 'completed', 'failed', 'partial')),
  current_step TEXT,
  steps_completed TEXT[] DEFAULT '{}',
  warnings JSONB DEFAULT '[]',
  error_payload JSONB,
  framework_binding_id UUID REFERENCES workspace_framework_binding(id),
  started_at TIMESTAMPTZ DEFAULT now(),
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TRIGGER set_workspace_bootstrap_run_updated_at
  BEFORE UPDATE ON public.workspace_bootstrap_run
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

ALTER TABLE workspace_bootstrap_run ENABLE ROW LEVEL SECURITY;

CREATE POLICY "jwt_select_bootstrap_run" ON workspace_bootstrap_run
  FOR SELECT USING (workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid())));
CREATE POLICY "service_role_bootstrap_run" ON workspace_bootstrap_run
  FOR ALL USING (current_setting('role') = 'service_role');
CREATE POLICY "api_key_read_bootstrap_run" ON workspace_bootstrap_run
  FOR SELECT USING (workspace_id = (current_setting('app.workspace_id', true))::uuid);

COMMENT ON TABLE workspace_bootstrap_run IS 'Cascade I1: Audit log for bootstrap executions. Idempotent, resumable, auditable.';

-- ========================================
-- 4. ALTER department_operating_hours
-- ========================================
ALTER TABLE department_operating_hours
  ADD COLUMN IF NOT EXISTS open_offset_minutes INT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS close_offset_minutes INT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS is_derived BOOLEAN DEFAULT true;

COMMENT ON COLUMN department_operating_hours.is_derived IS
  'true = absolute times recomputed from workspace base + offsets on cascade. false = manually controlled.';

-- ========================================
-- 5. ALTER department — classification
-- ========================================
ALTER TABLE department
  ADD COLUMN IF NOT EXISTS classification_source TEXT
    CHECK (classification_source IN ('industry_package', 'admin_confirmed', 'manual')),
  ADD COLUMN IF NOT EXISTS classification_confidence TEXT
    CHECK (classification_confidence IN ('high', 'medium', 'low'));

-- ========================================
-- 6. ALTER invitation — invite_employment_type
-- ========================================
ALTER TABLE invitation
  ADD COLUMN IF NOT EXISTS invite_employment_type TEXT
    CHECK (invite_employment_type IN ('employee', 'guest'));

-- ========================================
-- 7. ALTER employee_payroll_profile — provenance
-- ========================================
ALTER TABLE employee_payroll_profile
  ADD COLUMN IF NOT EXISTS seeded_from_template_id UUID REFERENCES payroll_profile_template(id),
  ADD COLUMN IF NOT EXISTS seeded_at TIMESTAMPTZ;

-- ========================================
-- 8. ALTER tariff_rate_table — provenance
-- ========================================
ALTER TABLE tariff_rate_table
  ADD COLUMN IF NOT EXISTS seeded_from_framework_binding_id UUID,
  ADD COLUMN IF NOT EXISTS seeded_at TIMESTAMPTZ;

-- ========================================
-- 9. ALTER season_budget — target_margin
-- ========================================
ALTER TABLE season_budget
  ADD COLUMN IF NOT EXISTS target_margin NUMERIC(5,2);

COMMENT ON COLUMN season_budget.target_margin IS
  'Profitability target (%). Independent from target_labor_percentage which is a cost ratio.';
