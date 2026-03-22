-- ============================================
-- 20260422100100_payroll_config_tables.sql
-- Payroll: 11 configuration tables
-- Spec: Sections 1.1-1.7, 6.1-6.3
-- Depends on: 20260422100000 (payroll enums)
-- Note: holiday_calendar/holiday_entry placed before supplement_rule
--       because supplement_rule has FK to holiday_calendar.
-- ============================================

SET search_path TO public, extensions;

-- --------------------------------------------------------
-- 1. payroll_workspace_settings (1:1 with workspace)
-- General payroll configuration per workspace
-- Spec: Section 6.1 General
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.payroll_workspace_settings (
  id                              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id                    UUID NOT NULL REFERENCES workspace(workspace_id) ON DELETE CASCADE,
  default_worked_hours_salary_code TEXT,
  default_monthly_salary_code      TEXT,
  period_type                     TEXT NOT NULL DEFAULT 'monthly' CHECK (period_type IN ('monthly', 'biweekly', 'weekly')),
  period_start_day                INT NOT NULL DEFAULT 1 CHECK (period_start_day BETWEEN 1 AND 28),
  shift_grouping                  TEXT NOT NULL DEFAULT 'department' CHECK (shift_grouping IN ('department', 'wage', 'wage_type')),
  employer_social_security_pct    NUMERIC(5,2) NOT NULL DEFAULT 14.1,
  vacation_pay_pct                NUMERIC(5,2) NOT NULL DEFAULT 12.0,
  pension_pct                     NUMERIC(5,2) NOT NULL DEFAULT 2.0,
  created_at                      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                      TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_payroll_settings_workspace UNIQUE (workspace_id)
);

ALTER TABLE payroll_workspace_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "jwt_select_payroll_settings" ON payroll_workspace_settings;
CREATE POLICY "jwt_select_payroll_settings" ON payroll_workspace_settings
  FOR SELECT USING (workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid())));

DROP POLICY IF EXISTS "jwt_insert_payroll_settings" ON payroll_workspace_settings;
CREATE POLICY "jwt_insert_payroll_settings" ON payroll_workspace_settings
  FOR INSERT WITH CHECK (workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid())));

DROP POLICY IF EXISTS "jwt_update_payroll_settings" ON payroll_workspace_settings;
CREATE POLICY "jwt_update_payroll_settings" ON payroll_workspace_settings
  FOR UPDATE USING (workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid())));

DROP POLICY IF EXISTS "api_key_read_payroll_settings" ON payroll_workspace_settings;
CREATE POLICY "api_key_read_payroll_settings" ON payroll_workspace_settings
  FOR SELECT USING (workspace_id = get_api_workspace_id());

DROP POLICY IF EXISTS "service_role_payroll_settings" ON payroll_workspace_settings;
CREATE POLICY "service_role_payroll_settings" ON payroll_workspace_settings
  FOR ALL USING (auth.role() = 'service_role');

CREATE TRIGGER set_payroll_settings_updated_at
  BEFORE UPDATE ON public.payroll_workspace_settings
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Note: No JWT DELETE policy — intentional. Settings row is 1:1 with workspace and should not be deleted from UI. Reset by updating to defaults.
COMMENT ON TABLE payroll_workspace_settings IS 'Payroll: workspace-level general settings (period type, default codes, employer cost percentages). 1:1 with workspace.';

-- --------------------------------------------------------
-- 2. payroll_employee_group (Employee groups with default rates)
-- Spec: Section 1.1
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.payroll_employee_group (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id        UUID NOT NULL REFERENCES workspace(workspace_id) ON DELETE CASCADE,
  name                TEXT NOT NULL,
  description         TEXT,
  default_hourly_rate NUMERIC(8,2) NOT NULL DEFAULT 0,
  salary_code         TEXT,
  department_id       UUID REFERENCES department(department_id) ON DELETE SET NULL,
  is_active           BOOLEAN NOT NULL DEFAULT true,
  sort_order          INT NOT NULL DEFAULT 0,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE payroll_employee_group ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "jwt_select_payroll_employee_group" ON payroll_employee_group;
CREATE POLICY "jwt_select_payroll_employee_group" ON payroll_employee_group
  FOR SELECT USING (workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid())));

DROP POLICY IF EXISTS "jwt_insert_payroll_employee_group" ON payroll_employee_group;
CREATE POLICY "jwt_insert_payroll_employee_group" ON payroll_employee_group
  FOR INSERT WITH CHECK (workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid())));

DROP POLICY IF EXISTS "jwt_update_payroll_employee_group" ON payroll_employee_group;
CREATE POLICY "jwt_update_payroll_employee_group" ON payroll_employee_group
  FOR UPDATE USING (workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid())));

DROP POLICY IF EXISTS "jwt_delete_payroll_employee_group" ON payroll_employee_group;
CREATE POLICY "jwt_delete_payroll_employee_group" ON payroll_employee_group
  FOR DELETE USING (workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid())));

DROP POLICY IF EXISTS "api_key_read_payroll_employee_group" ON payroll_employee_group;
CREATE POLICY "api_key_read_payroll_employee_group" ON payroll_employee_group
  FOR SELECT USING (workspace_id = get_api_workspace_id());

DROP POLICY IF EXISTS "service_role_payroll_employee_group" ON payroll_employee_group;
CREATE POLICY "service_role_payroll_employee_group" ON payroll_employee_group
  FOR ALL USING (auth.role() = 'service_role');

CREATE TRIGGER set_payroll_employee_group_updated_at
  BEFORE UPDATE ON public.payroll_employee_group
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX IF NOT EXISTS idx_payroll_employee_group_workspace
  ON payroll_employee_group (workspace_id);

COMMENT ON TABLE payroll_employee_group IS 'Payroll: employee groups (e.g., Kokk, Servitoer) with default hourly rate and salary code mapping.';

-- --------------------------------------------------------
-- 3. payroll_employee_group_member (Employee <-> group with individual rates)
-- Spec: Section 1.1 "Per-member rates"
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.payroll_employee_group_member (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id        UUID NOT NULL REFERENCES workspace(workspace_id) ON DELETE CASCADE,
  profile_id          UUID NOT NULL REFERENCES profile(profile_id) ON DELETE CASCADE,
  employee_group_id   UUID NOT NULL REFERENCES payroll_employee_group(id) ON DELETE CASCADE,
  hourly_rate         NUMERIC(8,2),
  valid_from          DATE NOT NULL DEFAULT CURRENT_DATE,
  valid_until         DATE,
  wage_type           payroll_wage_type NOT NULL DEFAULT 'hourly',
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT chk_member_valid_dates CHECK (valid_until IS NULL OR valid_until > valid_from)
);

ALTER TABLE payroll_employee_group_member ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "jwt_select_payroll_group_member" ON payroll_employee_group_member;
CREATE POLICY "jwt_select_payroll_group_member" ON payroll_employee_group_member
  FOR SELECT USING (workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid())));

DROP POLICY IF EXISTS "jwt_insert_payroll_group_member" ON payroll_employee_group_member;
CREATE POLICY "jwt_insert_payroll_group_member" ON payroll_employee_group_member
  FOR INSERT WITH CHECK (workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid())));

DROP POLICY IF EXISTS "jwt_update_payroll_group_member" ON payroll_employee_group_member;
CREATE POLICY "jwt_update_payroll_group_member" ON payroll_employee_group_member
  FOR UPDATE USING (workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid())));

DROP POLICY IF EXISTS "jwt_delete_payroll_group_member" ON payroll_employee_group_member;
CREATE POLICY "jwt_delete_payroll_group_member" ON payroll_employee_group_member
  FOR DELETE USING (workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid())));

DROP POLICY IF EXISTS "api_key_read_payroll_group_member" ON payroll_employee_group_member;
CREATE POLICY "api_key_read_payroll_group_member" ON payroll_employee_group_member
  FOR SELECT USING (workspace_id = get_api_workspace_id());

DROP POLICY IF EXISTS "service_role_payroll_group_member" ON payroll_employee_group_member;
CREATE POLICY "service_role_payroll_group_member" ON payroll_employee_group_member
  FOR ALL USING (auth.role() = 'service_role');

CREATE TRIGGER set_payroll_group_member_updated_at
  BEFORE UPDATE ON public.payroll_employee_group_member
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX IF NOT EXISTS idx_payroll_group_member_workspace
  ON payroll_employee_group_member (workspace_id);
CREATE INDEX IF NOT EXISTS idx_payroll_group_member_profile
  ON payroll_employee_group_member (profile_id, valid_from);
CREATE INDEX IF NOT EXISTS idx_payroll_group_member_group
  ON payroll_employee_group_member (employee_group_id);

COMMENT ON TABLE payroll_employee_group_member IS 'Payroll: employee-group membership with individual rate override and rate history. NULL hourly_rate = use group default.';

-- --------------------------------------------------------
-- 4. payroll_shift_type (Shift type definitions with rate adjustments)
-- Spec: Section 1.2
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.payroll_shift_type (
  id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id                UUID NOT NULL REFERENCES workspace(workspace_id) ON DELETE CASCADE,
  name                        TEXT NOT NULL,
  color                       TEXT DEFAULT '#6B7280',
  salary_code                 TEXT,
  rate_adjustment_type        payroll_rate_adjustment_type NOT NULL DEFAULT 'none',
  rate_adjustment_value       NUMERIC(8,2) DEFAULT 0,
  count_in_payroll            BOOLEAN NOT NULL DEFAULT true,
  allow_supplements           BOOLEAN NOT NULL DEFAULT true,
  allow_breaks                BOOLEAN NOT NULL DEFAULT true,
  allow_meal_deduction        BOOLEAN NOT NULL DEFAULT true,
  affects_salaried            BOOLEAN NOT NULL DEFAULT false,
  allow_conflicting_shifts    BOOLEAN NOT NULL DEFAULT false,
  include_in_schedule_print   BOOLEAN NOT NULL DEFAULT true,
  overwrite_on_template       BOOLEAN NOT NULL DEFAULT false,
  is_active                   BOOLEAN NOT NULL DEFAULT true,
  sort_order                  INT NOT NULL DEFAULT 0,
  created_at                  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                  TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE payroll_shift_type ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "jwt_select_payroll_shift_type" ON payroll_shift_type;
CREATE POLICY "jwt_select_payroll_shift_type" ON payroll_shift_type
  FOR SELECT USING (workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid())));

DROP POLICY IF EXISTS "jwt_insert_payroll_shift_type" ON payroll_shift_type;
CREATE POLICY "jwt_insert_payroll_shift_type" ON payroll_shift_type
  FOR INSERT WITH CHECK (workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid())));

DROP POLICY IF EXISTS "jwt_update_payroll_shift_type" ON payroll_shift_type;
CREATE POLICY "jwt_update_payroll_shift_type" ON payroll_shift_type
  FOR UPDATE USING (workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid())));

DROP POLICY IF EXISTS "jwt_delete_payroll_shift_type" ON payroll_shift_type;
CREATE POLICY "jwt_delete_payroll_shift_type" ON payroll_shift_type
  FOR DELETE USING (workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid())));

DROP POLICY IF EXISTS "api_key_read_payroll_shift_type" ON payroll_shift_type;
CREATE POLICY "api_key_read_payroll_shift_type" ON payroll_shift_type
  FOR SELECT USING (workspace_id = get_api_workspace_id());

DROP POLICY IF EXISTS "service_role_payroll_shift_type" ON payroll_shift_type;
CREATE POLICY "service_role_payroll_shift_type" ON payroll_shift_type
  FOR ALL USING (auth.role() = 'service_role');

CREATE TRIGGER set_payroll_shift_type_updated_at
  BEFORE UPDATE ON public.payroll_shift_type
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX IF NOT EXISTS idx_payroll_shift_type_workspace
  ON payroll_shift_type (workspace_id);

COMMENT ON TABLE payroll_shift_type IS 'Payroll: shift type definitions (Normal, Opplaering, Sykdom, Moete) with rate adjustments and payroll feature flags.';

-- --------------------------------------------------------
-- 5. payroll_salary_code (Salary code registry / loennsarter)
-- Spec: Section 1.3
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.payroll_salary_code (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id    UUID NOT NULL REFERENCES workspace(workspace_id) ON DELETE CASCADE,
  code            TEXT NOT NULL,
  name            TEXT NOT NULL,
  description     TEXT,
  external_code   TEXT,
  category        payroll_salary_code_category NOT NULL,
  a_melding_code  TEXT,
  is_active       BOOLEAN NOT NULL DEFAULT true,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_salary_code_per_workspace UNIQUE (workspace_id, code)
);

ALTER TABLE payroll_salary_code ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "jwt_select_payroll_salary_code" ON payroll_salary_code;
CREATE POLICY "jwt_select_payroll_salary_code" ON payroll_salary_code
  FOR SELECT USING (workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid())));

DROP POLICY IF EXISTS "jwt_insert_payroll_salary_code" ON payroll_salary_code;
CREATE POLICY "jwt_insert_payroll_salary_code" ON payroll_salary_code
  FOR INSERT WITH CHECK (workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid())));

DROP POLICY IF EXISTS "jwt_update_payroll_salary_code" ON payroll_salary_code;
CREATE POLICY "jwt_update_payroll_salary_code" ON payroll_salary_code
  FOR UPDATE USING (workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid())));

DROP POLICY IF EXISTS "jwt_delete_payroll_salary_code" ON payroll_salary_code;
CREATE POLICY "jwt_delete_payroll_salary_code" ON payroll_salary_code
  FOR DELETE USING (workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid())));

DROP POLICY IF EXISTS "api_key_read_payroll_salary_code" ON payroll_salary_code;
CREATE POLICY "api_key_read_payroll_salary_code" ON payroll_salary_code
  FOR SELECT USING (workspace_id = get_api_workspace_id());

DROP POLICY IF EXISTS "service_role_payroll_salary_code" ON payroll_salary_code;
CREATE POLICY "service_role_payroll_salary_code" ON payroll_salary_code
  FOR ALL USING (auth.role() = 'service_role');

CREATE TRIGGER set_payroll_salary_code_updated_at
  BEFORE UPDATE ON public.payroll_salary_code
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX IF NOT EXISTS idx_payroll_salary_code_workspace
  ON payroll_salary_code (workspace_id);

COMMENT ON TABLE payroll_salary_code IS 'Payroll: salary code registry (loennsarter). Maps internal codes to Tripletex external codes and a-melding reporting codes.';

-- --------------------------------------------------------
-- 6. payroll_holiday_calendar (Workspace-scoped holiday calendar headers)
-- Spec: Section 1.6
-- MOVED BEFORE supplement_rule because supplement_rule has FK to this table
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.payroll_holiday_calendar (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id    UUID NOT NULL REFERENCES workspace(workspace_id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  is_default      BOOLEAN NOT NULL DEFAULT false,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE payroll_holiday_calendar ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "jwt_select_payroll_holiday_calendar" ON payroll_holiday_calendar;
CREATE POLICY "jwt_select_payroll_holiday_calendar" ON payroll_holiday_calendar
  FOR SELECT USING (workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid())));

DROP POLICY IF EXISTS "jwt_insert_payroll_holiday_calendar" ON payroll_holiday_calendar;
CREATE POLICY "jwt_insert_payroll_holiday_calendar" ON payroll_holiday_calendar
  FOR INSERT WITH CHECK (workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid())));

DROP POLICY IF EXISTS "jwt_update_payroll_holiday_calendar" ON payroll_holiday_calendar;
CREATE POLICY "jwt_update_payroll_holiday_calendar" ON payroll_holiday_calendar
  FOR UPDATE USING (workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid())));

DROP POLICY IF EXISTS "jwt_delete_payroll_holiday_calendar" ON payroll_holiday_calendar;
CREATE POLICY "jwt_delete_payroll_holiday_calendar" ON payroll_holiday_calendar
  FOR DELETE USING (workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid())));

DROP POLICY IF EXISTS "api_key_read_payroll_holiday_calendar" ON payroll_holiday_calendar;
CREATE POLICY "api_key_read_payroll_holiday_calendar" ON payroll_holiday_calendar
  FOR SELECT USING (workspace_id = get_api_workspace_id());

DROP POLICY IF EXISTS "service_role_payroll_holiday_calendar" ON payroll_holiday_calendar;
CREATE POLICY "service_role_payroll_holiday_calendar" ON payroll_holiday_calendar
  FOR ALL USING (auth.role() = 'service_role');

CREATE TRIGGER set_payroll_holiday_calendar_updated_at
  BEFORE UPDATE ON public.payroll_holiday_calendar
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX IF NOT EXISTS idx_payroll_holiday_calendar_workspace
  ON payroll_holiday_calendar (workspace_id);

COMMENT ON TABLE payroll_holiday_calendar IS 'Payroll: workspace-scoped holiday calendar headers. Complementary to platform-level public_holiday table. Admin manages which holidays apply to their workspace.';

-- --------------------------------------------------------
-- 7. payroll_holiday_entry (Holiday dates per calendar)
-- Spec: Section 1.6 "Holiday entries"
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.payroll_holiday_entry (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id    UUID NOT NULL REFERENCES workspace(workspace_id) ON DELETE CASCADE,
  calendar_id     UUID NOT NULL REFERENCES payroll_holiday_calendar(id) ON DELETE CASCADE,
  holiday_date    DATE NOT NULL,
  name            TEXT NOT NULL,
  name_no         TEXT,
  hours           NUMERIC(4,1) NOT NULL DEFAULT 8,
  is_full_day     BOOLEAN NOT NULL DEFAULT true,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_holiday_entry_per_calendar UNIQUE (calendar_id, holiday_date)
);

ALTER TABLE payroll_holiday_entry ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "jwt_select_payroll_holiday_entry" ON payroll_holiday_entry;
CREATE POLICY "jwt_select_payroll_holiday_entry" ON payroll_holiday_entry
  FOR SELECT USING (workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid())));

DROP POLICY IF EXISTS "jwt_insert_payroll_holiday_entry" ON payroll_holiday_entry;
CREATE POLICY "jwt_insert_payroll_holiday_entry" ON payroll_holiday_entry
  FOR INSERT WITH CHECK (workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid())));

DROP POLICY IF EXISTS "jwt_update_payroll_holiday_entry" ON payroll_holiday_entry;
CREATE POLICY "jwt_update_payroll_holiday_entry" ON payroll_holiday_entry
  FOR UPDATE USING (workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid())));

DROP POLICY IF EXISTS "jwt_delete_payroll_holiday_entry" ON payroll_holiday_entry;
CREATE POLICY "jwt_delete_payroll_holiday_entry" ON payroll_holiday_entry
  FOR DELETE USING (workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid())));

DROP POLICY IF EXISTS "api_key_read_payroll_holiday_entry" ON payroll_holiday_entry;
CREATE POLICY "api_key_read_payroll_holiday_entry" ON payroll_holiday_entry
  FOR SELECT USING (workspace_id = get_api_workspace_id());

DROP POLICY IF EXISTS "service_role_payroll_holiday_entry" ON payroll_holiday_entry;
CREATE POLICY "service_role_payroll_holiday_entry" ON payroll_holiday_entry
  FOR ALL USING (auth.role() = 'service_role');

CREATE TRIGGER set_payroll_holiday_entry_updated_at
  BEFORE UPDATE ON public.payroll_holiday_entry
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX IF NOT EXISTS idx_payroll_holiday_entry_calendar
  ON payroll_holiday_entry (calendar_id);
CREATE INDEX IF NOT EXISTS idx_payroll_holiday_entry_date
  ON payroll_holiday_entry (holiday_date);

COMMENT ON TABLE payroll_holiday_entry IS 'Payroll: individual holiday dates per workspace calendar. Admins can import from platform-level public_holiday or add custom entries.';

-- --------------------------------------------------------
-- 8. payroll_supplement_rule (All 6 supplement types in one wide table)
-- Spec: Section 1.4 (Types 1-6)
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.payroll_supplement_rule (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id            UUID NOT NULL REFERENCES workspace(workspace_id) ON DELETE CASCADE,
  name                    TEXT NOT NULL,
  supplement_type         payroll_supplement_type NOT NULL,
  salary_code             TEXT,
  is_active               BOOLEAN NOT NULL DEFAULT true,
  sort_order              INT NOT NULL DEFAULT 0,

  -- Rate calculation (all types)
  rate_type               payroll_supplement_rate_type NOT NULL DEFAULT 'fixed_per_hour',
  rate_value              NUMERIC(8,2) NOT NULL DEFAULT 0,

  -- Eligibility filters (UUID[] — empty = applies to all)
  employee_group_ids      UUID[] NOT NULL DEFAULT '{}',
  employee_types          TEXT[] NOT NULL DEFAULT '{}',
  shift_type_ids          UUID[] NOT NULL DEFAULT '{}',

  -- Shared flags
  affected_by_breaks      BOOLEAN NOT NULL DEFAULT true,
  affects_salaried        BOOLEAN NOT NULL DEFAULT false,
  enforced_payment        BOOLEAN NOT NULL DEFAULT false,
  consider_midnight       BOOLEAN NOT NULL DEFAULT true,
  valid_from              DATE,
  valid_until             DATE,

  -- Type 1: Normal supplement (time-window based)
  start_type              payroll_supplement_start_type,
  time_window_start       TIME,
  time_window_end         TIME,
  after_minutes           INT,
  weekdays                INT[] NOT NULL DEFAULT '{}',
  holiday_calendar_id     UUID REFERENCES payroll_holiday_calendar(id) ON DELETE SET NULL,

  -- Type 2: Week-based supplement
  weekly_threshold_hours  NUMERIC(5,2),
  weekly_max_hours        NUMERIC(5,2),

  -- Type 3: Day-based supplement
  daily_threshold_hours   NUMERIC(5,2),
  daily_max_hours         NUMERIC(5,2),

  -- Type 4: Manual supplement
  default_rate            NUMERIC(8,2),
  allow_rate_override     BOOLEAN NOT NULL DEFAULT true,

  -- Type 5: Holiday supplement
  -- Uses holiday_calendar_id (shared with Type 1)

  -- Type 6: Contract rule supplement
  contract_rule_id        UUID,
  evaluation_field        TEXT,
  threshold_value         NUMERIC(8,2),

  created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT chk_supplement_valid_dates CHECK (valid_until IS NULL OR valid_until > valid_from)
);

ALTER TABLE payroll_supplement_rule ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "jwt_select_payroll_supplement_rule" ON payroll_supplement_rule;
CREATE POLICY "jwt_select_payroll_supplement_rule" ON payroll_supplement_rule
  FOR SELECT USING (workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid())));

DROP POLICY IF EXISTS "jwt_insert_payroll_supplement_rule" ON payroll_supplement_rule;
CREATE POLICY "jwt_insert_payroll_supplement_rule" ON payroll_supplement_rule
  FOR INSERT WITH CHECK (workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid())));

DROP POLICY IF EXISTS "jwt_update_payroll_supplement_rule" ON payroll_supplement_rule;
CREATE POLICY "jwt_update_payroll_supplement_rule" ON payroll_supplement_rule
  FOR UPDATE USING (workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid())));

DROP POLICY IF EXISTS "jwt_delete_payroll_supplement_rule" ON payroll_supplement_rule;
CREATE POLICY "jwt_delete_payroll_supplement_rule" ON payroll_supplement_rule
  FOR DELETE USING (workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid())));

DROP POLICY IF EXISTS "api_key_read_payroll_supplement_rule" ON payroll_supplement_rule;
CREATE POLICY "api_key_read_payroll_supplement_rule" ON payroll_supplement_rule
  FOR SELECT USING (workspace_id = get_api_workspace_id());

DROP POLICY IF EXISTS "service_role_payroll_supplement_rule" ON payroll_supplement_rule;
CREATE POLICY "service_role_payroll_supplement_rule" ON payroll_supplement_rule
  FOR ALL USING (auth.role() = 'service_role');

CREATE TRIGGER set_payroll_supplement_rule_updated_at
  BEFORE UPDATE ON public.payroll_supplement_rule
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX IF NOT EXISTS idx_payroll_supplement_rule_workspace
  ON payroll_supplement_rule (workspace_id);
CREATE INDEX IF NOT EXISTS idx_payroll_supplement_rule_type
  ON payroll_supplement_rule (workspace_id, supplement_type) WHERE is_active = true;

COMMENT ON TABLE payroll_supplement_rule IS 'Payroll: supplement rule definitions for all 6 types (normal, week_based, day_based, manual, holiday, contract_rule). Wide table — type-specific columns are NULL when irrelevant.';

-- --------------------------------------------------------
-- 9. payroll_break_rule (Automatic break assignment)
-- Spec: Section 1.5
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.payroll_break_rule (
  id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id                UUID NOT NULL REFERENCES workspace(workspace_id) ON DELETE CASCADE,
  name                        TEXT NOT NULL,
  trigger_type                payroll_break_trigger_type NOT NULL,
  trigger_minutes             INT,
  trigger_time                TIME,
  duration_minutes            INT NOT NULL,
  min_shift_duration_minutes  INT NOT NULL DEFAULT 0,
  is_paid                     BOOLEAN NOT NULL DEFAULT false,
  department_ids              UUID[] NOT NULL DEFAULT '{}',
  employee_group_ids          UUID[] NOT NULL DEFAULT '{}',
  weekdays                    INT[] NOT NULL DEFAULT '{}',
  is_active                   BOOLEAN NOT NULL DEFAULT true,
  valid_from                  DATE,
  valid_until                 DATE,
  created_at                  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                  TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT chk_break_trigger CHECK (
    (trigger_type = 'after_duration' AND trigger_minutes IS NOT NULL)
    OR (trigger_type = 'time_of_day' AND trigger_time IS NOT NULL)
  ),
  CONSTRAINT chk_break_valid_dates CHECK (valid_until IS NULL OR valid_until > valid_from)
);

ALTER TABLE payroll_break_rule ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "jwt_select_payroll_break_rule" ON payroll_break_rule;
CREATE POLICY "jwt_select_payroll_break_rule" ON payroll_break_rule
  FOR SELECT USING (workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid())));

DROP POLICY IF EXISTS "jwt_insert_payroll_break_rule" ON payroll_break_rule;
CREATE POLICY "jwt_insert_payroll_break_rule" ON payroll_break_rule
  FOR INSERT WITH CHECK (workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid())));

DROP POLICY IF EXISTS "jwt_update_payroll_break_rule" ON payroll_break_rule;
CREATE POLICY "jwt_update_payroll_break_rule" ON payroll_break_rule
  FOR UPDATE USING (workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid())));

DROP POLICY IF EXISTS "jwt_delete_payroll_break_rule" ON payroll_break_rule;
CREATE POLICY "jwt_delete_payroll_break_rule" ON payroll_break_rule
  FOR DELETE USING (workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid())));

DROP POLICY IF EXISTS "api_key_read_payroll_break_rule" ON payroll_break_rule;
CREATE POLICY "api_key_read_payroll_break_rule" ON payroll_break_rule
  FOR SELECT USING (workspace_id = get_api_workspace_id());

DROP POLICY IF EXISTS "service_role_payroll_break_rule" ON payroll_break_rule;
CREATE POLICY "service_role_payroll_break_rule" ON payroll_break_rule
  FOR ALL USING (auth.role() = 'service_role');

CREATE TRIGGER set_payroll_break_rule_updated_at
  BEFORE UPDATE ON public.payroll_break_rule
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX IF NOT EXISTS idx_payroll_break_rule_workspace
  ON payroll_break_rule (workspace_id);

COMMENT ON TABLE payroll_break_rule IS 'Payroll: automatic break assignment rules. Triggers after duration or at fixed time. Break is paid or unpaid.';

-- --------------------------------------------------------
-- 10. payroll_meal_rule (Meal deductions and contributions)
-- Spec: Section 1.7
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.payroll_meal_rule (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id        UUID NOT NULL REFERENCES workspace(workspace_id) ON DELETE CASCADE,
  name                TEXT NOT NULL,
  meal_type           payroll_meal_rule_type NOT NULL,
  salary_code         TEXT,
  amount              NUMERIC(8,2) NOT NULL,
  min_shift_hours     NUMERIC(4,1) NOT NULL DEFAULT 0,
  department_ids      UUID[] NOT NULL DEFAULT '{}',
  employee_group_ids  UUID[] NOT NULL DEFAULT '{}',
  shift_type_ids      UUID[] NOT NULL DEFAULT '{}',
  is_active           BOOLEAN NOT NULL DEFAULT true,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE payroll_meal_rule ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "jwt_select_payroll_meal_rule" ON payroll_meal_rule;
CREATE POLICY "jwt_select_payroll_meal_rule" ON payroll_meal_rule
  FOR SELECT USING (workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid())));

DROP POLICY IF EXISTS "jwt_insert_payroll_meal_rule" ON payroll_meal_rule;
CREATE POLICY "jwt_insert_payroll_meal_rule" ON payroll_meal_rule
  FOR INSERT WITH CHECK (workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid())));

DROP POLICY IF EXISTS "jwt_update_payroll_meal_rule" ON payroll_meal_rule;
CREATE POLICY "jwt_update_payroll_meal_rule" ON payroll_meal_rule
  FOR UPDATE USING (workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid())));

DROP POLICY IF EXISTS "jwt_delete_payroll_meal_rule" ON payroll_meal_rule;
CREATE POLICY "jwt_delete_payroll_meal_rule" ON payroll_meal_rule
  FOR DELETE USING (workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid())));

DROP POLICY IF EXISTS "api_key_read_payroll_meal_rule" ON payroll_meal_rule;
CREATE POLICY "api_key_read_payroll_meal_rule" ON payroll_meal_rule
  FOR SELECT USING (workspace_id = get_api_workspace_id());

DROP POLICY IF EXISTS "service_role_payroll_meal_rule" ON payroll_meal_rule;
CREATE POLICY "service_role_payroll_meal_rule" ON payroll_meal_rule
  FOR ALL USING (auth.role() = 'service_role');

CREATE TRIGGER set_payroll_meal_rule_updated_at
  BEFORE UPDATE ON public.payroll_meal_rule
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX IF NOT EXISTS idx_payroll_meal_rule_workspace
  ON payroll_meal_rule (workspace_id);

COMMENT ON TABLE payroll_meal_rule IS 'Payroll: meal deduction/contribution rules. Deductions reduce pay for provided meals, contributions add employer meal support.';

-- --------------------------------------------------------
-- 11. payroll_working_time_rule (AML compliance rules)
-- Spec: Section 2.5 and Section 5.3
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.payroll_working_time_rule (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id        UUID NOT NULL REFERENCES workspace(workspace_id) ON DELETE CASCADE,
  code                TEXT NOT NULL,
  name                TEXT NOT NULL,
  description         TEXT,
  severity            payroll_rule_severity NOT NULL DEFAULT 'warn',
  threshold_value     NUMERIC(6,2) NOT NULL,
  scope_type          TEXT NOT NULL DEFAULT 'workspace' CHECK (scope_type IN ('workspace', 'department', 'employee_group')),
  scope_id            UUID,
  is_active           BOOLEAN NOT NULL DEFAULT true,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_working_time_rule UNIQUE NULLS NOT DISTINCT (workspace_id, code, scope_type, scope_id)
);

ALTER TABLE payroll_working_time_rule ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "jwt_select_payroll_working_time_rule" ON payroll_working_time_rule;
CREATE POLICY "jwt_select_payroll_working_time_rule" ON payroll_working_time_rule
  FOR SELECT USING (workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid())));

DROP POLICY IF EXISTS "jwt_insert_payroll_working_time_rule" ON payroll_working_time_rule;
CREATE POLICY "jwt_insert_payroll_working_time_rule" ON payroll_working_time_rule
  FOR INSERT WITH CHECK (workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid())));

DROP POLICY IF EXISTS "jwt_update_payroll_working_time_rule" ON payroll_working_time_rule;
CREATE POLICY "jwt_update_payroll_working_time_rule" ON payroll_working_time_rule
  FOR UPDATE USING (workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid())));

DROP POLICY IF EXISTS "jwt_delete_payroll_working_time_rule" ON payroll_working_time_rule;
CREATE POLICY "jwt_delete_payroll_working_time_rule" ON payroll_working_time_rule
  FOR DELETE USING (workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid())));

DROP POLICY IF EXISTS "api_key_read_payroll_working_time_rule" ON payroll_working_time_rule;
CREATE POLICY "api_key_read_payroll_working_time_rule" ON payroll_working_time_rule
  FOR SELECT USING (workspace_id = get_api_workspace_id());

DROP POLICY IF EXISTS "service_role_payroll_working_time_rule" ON payroll_working_time_rule;
CREATE POLICY "service_role_payroll_working_time_rule" ON payroll_working_time_rule
  FOR ALL USING (auth.role() = 'service_role');

CREATE TRIGGER set_payroll_working_time_rule_updated_at
  BEFORE UPDATE ON public.payroll_working_time_rule
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX IF NOT EXISTS idx_payroll_working_time_rule_workspace
  ON payroll_working_time_rule (workspace_id);

COMMENT ON TABLE payroll_working_time_rule IS 'Payroll: workspace-configurable AML working time rules. Codes: W01-W06. Admin sets thresholds and block/warn severity per scope. Complementary to Cascade framework_rule (governance layer).';
