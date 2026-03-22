-- ============================================
-- 20260422100600_payroll_absence_tables.sql
-- Payroll: 5 absence/leave/timebank tables
-- Covers: Module 7 (Absence payroll integration), Module 8 (Timebank/TOIL)
-- Depends on: 20260422100500 (absence enums)
-- ============================================

SET search_path TO public, extensions;

-- --------------------------------------------------------
-- 1. payroll_absence_type (Workspace-level absence type config)
-- Defines which absence types the workspace uses and their payroll rules
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.payroll_absence_type (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id            UUID NOT NULL REFERENCES workspace(workspace_id) ON DELETE CASCADE,
  category                payroll_absence_category NOT NULL,
  name                    TEXT NOT NULL,
  name_no                 TEXT,
  salary_code             TEXT,
  is_paid                 BOOLEAN NOT NULL DEFAULT true,
  affects_payroll         BOOLEAN NOT NULL DEFAULT true,
  max_days_per_year       INT,
  max_days_per_instance   INT,
  max_instances_per_year  INT,
  requires_documentation  BOOLEAN NOT NULL DEFAULT false,
  documentation_after_days INT,
  count_weekends          BOOLEAN NOT NULL DEFAULT false,
  employer_pays_days      INT,
  is_active               BOOLEAN NOT NULL DEFAULT true,
  sort_order              INT NOT NULL DEFAULT 0,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_absence_type_per_workspace UNIQUE (workspace_id, category)
);

ALTER TABLE payroll_absence_type ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "jwt_select_payroll_absence_type" ON payroll_absence_type;
CREATE POLICY "jwt_select_payroll_absence_type" ON payroll_absence_type
  FOR SELECT USING (workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid())));

DROP POLICY IF EXISTS "jwt_insert_payroll_absence_type" ON payroll_absence_type;
CREATE POLICY "jwt_insert_payroll_absence_type" ON payroll_absence_type
  FOR INSERT WITH CHECK (workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid())));

DROP POLICY IF EXISTS "jwt_update_payroll_absence_type" ON payroll_absence_type;
CREATE POLICY "jwt_update_payroll_absence_type" ON payroll_absence_type
  FOR UPDATE USING (workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid())));

DROP POLICY IF EXISTS "jwt_delete_payroll_absence_type" ON payroll_absence_type;
CREATE POLICY "jwt_delete_payroll_absence_type" ON payroll_absence_type
  FOR DELETE USING (workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid())));

DROP POLICY IF EXISTS "api_key_read_payroll_absence_type" ON payroll_absence_type;
CREATE POLICY "api_key_read_payroll_absence_type" ON payroll_absence_type
  FOR SELECT USING (workspace_id = get_api_workspace_id());

DROP POLICY IF EXISTS "service_role_payroll_absence_type" ON payroll_absence_type;
CREATE POLICY "service_role_payroll_absence_type" ON payroll_absence_type
  FOR ALL USING (auth.role() = 'service_role');

CREATE TRIGGER set_payroll_absence_type_updated_at
  BEFORE UPDATE ON public.payroll_absence_type
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX IF NOT EXISTS idx_payroll_absence_type_workspace
  ON payroll_absence_type (workspace_id);

COMMENT ON TABLE payroll_absence_type IS 'Payroll: workspace-level absence type configuration. Defines payroll rules per Norwegian absence category (vacation, sick, parental, etc.). Norwegian defaults: vacation 25 days, egenmelding max 3 days/instance max 4 instances, employer sick pay 16 days.';

-- --------------------------------------------------------
-- 2. payroll_absence_quota (Per-employee, per-year entitlements)
-- Tracks how many days of each type an employee is entitled to
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.payroll_absence_quota (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id        UUID NOT NULL REFERENCES workspace(workspace_id) ON DELETE CASCADE,
  profile_id          UUID NOT NULL REFERENCES profile(profile_id) ON DELETE CASCADE,
  absence_type_id     UUID NOT NULL REFERENCES payroll_absence_type(id) ON DELETE CASCADE,
  year                INT NOT NULL,
  entitled_days       NUMERIC(5,1) NOT NULL,
  carried_over_days   NUMERIC(5,1) NOT NULL DEFAULT 0,
  used_days           NUMERIC(5,1) NOT NULL DEFAULT 0,
  adjusted_days       NUMERIC(5,1) NOT NULL DEFAULT 0,
  expired_days        NUMERIC(5,1) NOT NULL DEFAULT 0,
  paid_out_days       NUMERIC(5,1) NOT NULL DEFAULT 0,
  remaining_days      NUMERIC(5,1) GENERATED ALWAYS AS (
    entitled_days + carried_over_days + adjusted_days - used_days - expired_days - paid_out_days
  ) STORED,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_absence_quota UNIQUE (profile_id, absence_type_id, year),
  CONSTRAINT chk_quota_year CHECK (year BETWEEN 2020 AND 2099)
);

ALTER TABLE payroll_absence_quota ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "jwt_select_payroll_absence_quota" ON payroll_absence_quota;
CREATE POLICY "jwt_select_payroll_absence_quota" ON payroll_absence_quota
  FOR SELECT USING (workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid())));

DROP POLICY IF EXISTS "jwt_insert_payroll_absence_quota" ON payroll_absence_quota;
CREATE POLICY "jwt_insert_payroll_absence_quota" ON payroll_absence_quota
  FOR INSERT WITH CHECK (workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid())));

DROP POLICY IF EXISTS "jwt_update_payroll_absence_quota" ON payroll_absence_quota;
CREATE POLICY "jwt_update_payroll_absence_quota" ON payroll_absence_quota
  FOR UPDATE USING (workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid())));

DROP POLICY IF EXISTS "api_key_read_payroll_absence_quota" ON payroll_absence_quota;
CREATE POLICY "api_key_read_payroll_absence_quota" ON payroll_absence_quota
  FOR SELECT USING (workspace_id = get_api_workspace_id());

DROP POLICY IF EXISTS "service_role_payroll_absence_quota" ON payroll_absence_quota;
CREATE POLICY "service_role_payroll_absence_quota" ON payroll_absence_quota
  FOR ALL USING (auth.role() = 'service_role');

CREATE TRIGGER set_payroll_absence_quota_updated_at
  BEFORE UPDATE ON public.payroll_absence_quota
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX IF NOT EXISTS idx_payroll_absence_quota_workspace
  ON payroll_absence_quota (workspace_id);
CREATE INDEX IF NOT EXISTS idx_payroll_absence_quota_profile_year
  ON payroll_absence_quota (profile_id, year);

-- Note: No JWT DELETE policy — intentional. Quotas are updated, not deleted. Admin adjusts via adjustment_days.
COMMENT ON TABLE payroll_absence_quota IS 'Payroll: per-employee per-year absence entitlements. remaining_days is computed (entitled + carried_over + adjusted - used - expired - paid_out). Norwegian vacation default: 25 days/year.';

-- --------------------------------------------------------
-- 3. payroll_absence_ledger (Individual absence transactions)
-- Every change to an absence balance is recorded here
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.payroll_absence_ledger (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id        UUID NOT NULL REFERENCES workspace(workspace_id) ON DELETE CASCADE,
  profile_id          UUID NOT NULL REFERENCES profile(profile_id) ON DELETE CASCADE,
  absence_type_id     UUID NOT NULL REFERENCES payroll_absence_type(id) ON DELETE CASCADE,
  quota_id            UUID NOT NULL REFERENCES payroll_absence_quota(id) ON DELETE CASCADE,
  entry_type          payroll_absence_ledger_type NOT NULL,
  days                NUMERIC(5,1) NOT NULL,
  effective_date      DATE NOT NULL,
  schedule_absence_id UUID, -- Soft ref to schedule_absence. No FK: absence may be re-approved/deleted independently; integrity enforced at app layer.
  description         TEXT,
  created_by          UUID REFERENCES profile(profile_id),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);
-- Append-only ledger. Balance is derived from SUM of entries per quota.

ALTER TABLE payroll_absence_ledger ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "jwt_select_payroll_absence_ledger" ON payroll_absence_ledger;
CREATE POLICY "jwt_select_payroll_absence_ledger" ON payroll_absence_ledger
  FOR SELECT USING (workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid())));

DROP POLICY IF EXISTS "jwt_insert_payroll_absence_ledger" ON payroll_absence_ledger;
CREATE POLICY "jwt_insert_payroll_absence_ledger" ON payroll_absence_ledger
  FOR INSERT WITH CHECK (workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid())));

DROP POLICY IF EXISTS "api_key_read_payroll_absence_ledger" ON payroll_absence_ledger;
CREATE POLICY "api_key_read_payroll_absence_ledger" ON payroll_absence_ledger
  FOR SELECT USING (workspace_id = get_api_workspace_id());

DROP POLICY IF EXISTS "service_role_payroll_absence_ledger" ON payroll_absence_ledger;
CREATE POLICY "service_role_payroll_absence_ledger" ON payroll_absence_ledger
  FOR ALL USING (auth.role() = 'service_role');

-- No updated_at trigger — append-only ledger
CREATE INDEX IF NOT EXISTS idx_payroll_absence_ledger_workspace
  ON payroll_absence_ledger (workspace_id);
CREATE INDEX IF NOT EXISTS idx_payroll_absence_ledger_quota
  ON payroll_absence_ledger (quota_id);
CREATE INDEX IF NOT EXISTS idx_payroll_absence_ledger_profile
  ON payroll_absence_ledger (profile_id, effective_date);

COMMENT ON TABLE payroll_absence_ledger IS 'Payroll: append-only absence transaction ledger. Every entitlement, usage, adjustment, carry-over, expiry, and payout is recorded. Balance on payroll_absence_quota is the materialized summary.';

-- --------------------------------------------------------
-- 4. payroll_sick_leave_period (Detailed sick leave tracking)
-- Tracks employer period (16 days) vs NAV, graded leave, follow-up milestones
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.payroll_sick_leave_period (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id            UUID NOT NULL REFERENCES workspace(workspace_id) ON DELETE CASCADE,
  profile_id              UUID NOT NULL REFERENCES profile(profile_id) ON DELETE CASCADE,
  absence_type_id         UUID NOT NULL REFERENCES payroll_absence_type(id),
  start_date              DATE NOT NULL,
  end_date                DATE,
  grade                   payroll_sick_leave_grade NOT NULL DEFAULT 'full',
  custom_grade_pct        INT,
  is_egenmelding          BOOLEAN NOT NULL DEFAULT false,
  egenmelding_instance    INT,
  employer_days           INT NOT NULL DEFAULT 16,
  employer_period_end     DATE,
  nav_takeover_date       DATE,
  nav_refund_amount       NUMERIC(10,2),
  followup_4w_date        DATE,
  followup_4w_completed   BOOLEAN NOT NULL DEFAULT false,
  followup_7w_date        DATE,
  followup_7w_completed   BOOLEAN NOT NULL DEFAULT false,
  doctor_note_received    BOOLEAN NOT NULL DEFAULT false,
  doctor_note_date        DATE,
  notes                   TEXT,
  schedule_absence_id     UUID, -- Soft ref to schedule_absence. No FK: sick leave is a legal record; absence scheduling is independent.
  created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT chk_sick_grade CHECK (
    grade != 'graded_custom' OR custom_grade_pct IS NOT NULL
  ),
  CONSTRAINT chk_custom_grade_range CHECK (
    custom_grade_pct IS NULL OR (custom_grade_pct BETWEEN 1 AND 99)
  )
);

ALTER TABLE payroll_sick_leave_period ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "jwt_select_payroll_sick_period" ON payroll_sick_leave_period;
CREATE POLICY "jwt_select_payroll_sick_period" ON payroll_sick_leave_period
  FOR SELECT USING (workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid())));

DROP POLICY IF EXISTS "jwt_insert_payroll_sick_period" ON payroll_sick_leave_period;
CREATE POLICY "jwt_insert_payroll_sick_period" ON payroll_sick_leave_period
  FOR INSERT WITH CHECK (workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid())));

DROP POLICY IF EXISTS "jwt_update_payroll_sick_period" ON payroll_sick_leave_period;
CREATE POLICY "jwt_update_payroll_sick_period" ON payroll_sick_leave_period
  FOR UPDATE USING (workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid())));

DROP POLICY IF EXISTS "api_key_read_payroll_sick_period" ON payroll_sick_leave_period;
CREATE POLICY "api_key_read_payroll_sick_period" ON payroll_sick_leave_period
  FOR SELECT USING (workspace_id = get_api_workspace_id());

DROP POLICY IF EXISTS "service_role_payroll_sick_period" ON payroll_sick_leave_period;
CREATE POLICY "service_role_payroll_sick_period" ON payroll_sick_leave_period
  FOR ALL USING (auth.role() = 'service_role');

CREATE TRIGGER set_payroll_sick_period_updated_at
  BEFORE UPDATE ON public.payroll_sick_leave_period
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX IF NOT EXISTS idx_payroll_sick_period_workspace
  ON payroll_sick_leave_period (workspace_id);
CREATE INDEX IF NOT EXISTS idx_payroll_sick_period_profile
  ON payroll_sick_leave_period (profile_id, start_date);

-- Note: No JWT DELETE policy — intentional. Sick leave periods are legal records and must not be deleted from UI.
COMMENT ON TABLE payroll_sick_leave_period IS 'Payroll: detailed sick leave tracking per instance. Norwegian law: employer pays first 16 calendar days, then NAV takes over. Tracks egenmelding instances (max 3 days/instance, max 4/year without IA), graded return, and mandatory follow-up at 4 and 7 weeks.';

-- --------------------------------------------------------
-- 5. payroll_timebank_entry (Overtime bank / TOIL ledger)
-- Every overtime accrual, TOIL withdrawal, and balance change
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.payroll_timebank_entry (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id            UUID NOT NULL REFERENCES workspace(workspace_id) ON DELETE CASCADE,
  profile_id              UUID NOT NULL REFERENCES profile(profile_id) ON DELETE CASCADE,
  entry_type              payroll_timebank_entry_type NOT NULL,
  hours                   NUMERIC(6,2) NOT NULL,
  effective_date          DATE NOT NULL,
  expiry_date             DATE,
  payroll_calculation_id  UUID REFERENCES payroll_calculation(id),
  schedule_absence_id     UUID, -- Soft ref to schedule_absence. No FK: TOIL scheduling is independent of timebank accounting.
  description             TEXT,
  created_by              UUID REFERENCES profile(profile_id),
  created_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);
-- Append-only ledger. Balance = SUM(hours) where entry_type IN (accrual, carry_over, adjustment) minus SUM(hours) where entry_type IN (withdrawal, expiry, payout).

ALTER TABLE payroll_timebank_entry ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "jwt_select_payroll_timebank" ON payroll_timebank_entry;
CREATE POLICY "jwt_select_payroll_timebank" ON payroll_timebank_entry
  FOR SELECT USING (workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid())));

DROP POLICY IF EXISTS "jwt_insert_payroll_timebank" ON payroll_timebank_entry;
CREATE POLICY "jwt_insert_payroll_timebank" ON payroll_timebank_entry
  FOR INSERT WITH CHECK (workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid())));

DROP POLICY IF EXISTS "api_key_read_payroll_timebank" ON payroll_timebank_entry;
CREATE POLICY "api_key_read_payroll_timebank" ON payroll_timebank_entry
  FOR SELECT USING (workspace_id = get_api_workspace_id());

DROP POLICY IF EXISTS "service_role_payroll_timebank" ON payroll_timebank_entry;
CREATE POLICY "service_role_payroll_timebank" ON payroll_timebank_entry
  FOR ALL USING (auth.role() = 'service_role');

-- No updated_at trigger — append-only ledger
CREATE INDEX IF NOT EXISTS idx_payroll_timebank_workspace
  ON payroll_timebank_entry (workspace_id);
CREATE INDEX IF NOT EXISTS idx_payroll_timebank_profile
  ON payroll_timebank_entry (profile_id, effective_date);
CREATE INDEX IF NOT EXISTS idx_payroll_timebank_expiry
  ON payroll_timebank_entry (expiry_date) WHERE expiry_date IS NOT NULL AND entry_type = 'accrual';

COMMENT ON TABLE payroll_timebank_entry IS 'Payroll: append-only overtime bank (TOIL / avspasering) ledger. Accruals from overtime worked, withdrawals when TOIL taken, payouts when overtime paid instead. Balance = SUM(credits) - SUM(debits). Expiry_date enables configurable timebank expiry per workspace.';
