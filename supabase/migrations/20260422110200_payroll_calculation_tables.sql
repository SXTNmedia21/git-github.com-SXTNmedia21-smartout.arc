-- ============================================
-- 20260422100200_payroll_calculation_tables.sql
-- Payroll: 7 period, calculation, and export tables
-- Spec: Sections 4.4, 5.4, 7.2
-- Depends on: 20260422100100 (config tables)
-- ============================================

SET search_path TO public, extensions;

-- --------------------------------------------------------
-- 1. payroll_period (Payroll period lifecycle)
-- Spec: Section 4.4
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.payroll_period (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id    UUID NOT NULL REFERENCES workspace(workspace_id) ON DELETE CASCADE,
  start_date      DATE NOT NULL,
  end_date        DATE NOT NULL,
  status          payroll_period_status NOT NULL DEFAULT 'open',
  locked_by       UUID REFERENCES profile(profile_id),
  locked_at       TIMESTAMPTZ,
  approved_by     UUID REFERENCES profile(profile_id),
  approved_at     TIMESTAMPTZ,
  exported_at     TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT chk_period_dates CHECK (end_date > start_date),
  CONSTRAINT uq_payroll_period UNIQUE (workspace_id, start_date, end_date)
);

ALTER TABLE payroll_period ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "jwt_select_payroll_period" ON payroll_period;
CREATE POLICY "jwt_select_payroll_period" ON payroll_period
  FOR SELECT USING (workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid())));

DROP POLICY IF EXISTS "jwt_insert_payroll_period" ON payroll_period;
CREATE POLICY "jwt_insert_payroll_period" ON payroll_period
  FOR INSERT WITH CHECK (workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid())));

DROP POLICY IF EXISTS "jwt_update_payroll_period" ON payroll_period;
CREATE POLICY "jwt_update_payroll_period" ON payroll_period
  FOR UPDATE USING (workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid())));

DROP POLICY IF EXISTS "api_key_read_payroll_period" ON payroll_period;
CREATE POLICY "api_key_read_payroll_period" ON payroll_period
  FOR SELECT USING (workspace_id = get_api_workspace_id());

DROP POLICY IF EXISTS "service_role_payroll_period" ON payroll_period;
CREATE POLICY "service_role_payroll_period" ON payroll_period
  FOR ALL USING (auth.role() = 'service_role');

CREATE TRIGGER set_payroll_period_updated_at
  BEFORE UPDATE ON public.payroll_period
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX IF NOT EXISTS idx_payroll_period_workspace
  ON payroll_period (workspace_id);
CREATE INDEX IF NOT EXISTS idx_payroll_period_dates
  ON payroll_period (workspace_id, start_date, end_date);

-- Note: No JWT DELETE policy — intentional. Periods are never deleted; re-open (unlock) is the recovery path.
COMMENT ON TABLE payroll_period IS 'Payroll: period lifecycle (open -> locked -> approved -> exported). Cannot approve with unacknowledged error-severity deviations.';

-- --------------------------------------------------------
-- 2. payroll_calculation (Per-shift calculation result, append-only)
-- Spec: Section 4.1 step 9
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.payroll_calculation (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id        UUID NOT NULL REFERENCES workspace(workspace_id) ON DELETE CASCADE,
  period_id           UUID NOT NULL REFERENCES payroll_period(id) ON DELETE CASCADE,
  schedule_shift_id   UUID NOT NULL REFERENCES schedule_shift(schedule_shift_id) ON DELETE CASCADE,
  profile_id          UUID NOT NULL REFERENCES profile(profile_id) ON DELETE CASCADE,
  employee_group_id   UUID REFERENCES payroll_employee_group(id),
  shift_type_id       UUID REFERENCES payroll_shift_type(id),
  shift_date          DATE NOT NULL,
  scheduled_start     TIMESTAMPTZ NOT NULL,
  scheduled_end       TIMESTAMPTZ NOT NULL,
  actual_start        TIMESTAMPTZ,
  actual_end          TIMESTAMPTZ,
  gross_minutes       INT NOT NULL,
  break_minutes_paid  INT NOT NULL DEFAULT 0,
  break_minutes_unpaid INT NOT NULL DEFAULT 0,
  net_working_minutes INT NOT NULL,
  base_rate           NUMERIC(8,2) NOT NULL,
  base_pay            NUMERIC(10,2) NOT NULL,
  total_supplements   NUMERIC(10,2) NOT NULL DEFAULT 0,
  total_deductions    NUMERIC(10,2) NOT NULL DEFAULT 0,
  total_pay           NUMERIC(10,2) NOT NULL,
  calculation_version INT NOT NULL DEFAULT 1,
  calculated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);
-- Append-only: new calculation = new row. Never UPDATE.

ALTER TABLE payroll_calculation ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "jwt_select_payroll_calculation" ON payroll_calculation;
CREATE POLICY "jwt_select_payroll_calculation" ON payroll_calculation
  FOR SELECT USING (workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid())));

DROP POLICY IF EXISTS "jwt_insert_payroll_calculation" ON payroll_calculation;
CREATE POLICY "jwt_insert_payroll_calculation" ON payroll_calculation
  FOR INSERT WITH CHECK (workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid())));

DROP POLICY IF EXISTS "api_key_read_payroll_calculation" ON payroll_calculation;
CREATE POLICY "api_key_read_payroll_calculation" ON payroll_calculation
  FOR SELECT USING (workspace_id = get_api_workspace_id());

DROP POLICY IF EXISTS "service_role_payroll_calculation" ON payroll_calculation;
CREATE POLICY "service_role_payroll_calculation" ON payroll_calculation
  FOR ALL USING (auth.role() = 'service_role');

-- No updated_at trigger — append-only table
CREATE INDEX IF NOT EXISTS idx_payroll_calc_workspace
  ON payroll_calculation (workspace_id);
CREATE INDEX IF NOT EXISTS idx_payroll_calc_period
  ON payroll_calculation (period_id);
CREATE INDEX IF NOT EXISTS idx_payroll_calc_shift
  ON payroll_calculation (schedule_shift_id, calculated_at DESC);
CREATE INDEX IF NOT EXISTS idx_payroll_calc_profile
  ON payroll_calculation (profile_id, shift_date);

COMMENT ON TABLE payroll_calculation IS 'Payroll: per-shift calculation result. Append-only — never UPDATE, insert new version. Latest = MAX(calculated_at) per shift.';

-- --------------------------------------------------------
-- 3. payroll_calculation_line (Per-item line in calculation)
-- Spec: Section 4.1 step 7
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.payroll_calculation_line (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id    UUID NOT NULL REFERENCES workspace(workspace_id) ON DELETE CASCADE,
  calculation_id  UUID NOT NULL REFERENCES payroll_calculation(id) ON DELETE CASCADE,
  salary_code     TEXT NOT NULL,
  line_type       TEXT NOT NULL CHECK (line_type IN ('base', 'supplement', 'deduction', 'overtime', 'meal')),
  description     TEXT NOT NULL,
  hours           NUMERIC(6,2),
  rate            NUMERIC(8,2),
  amount          NUMERIC(10,2) NOT NULL,
  supplement_rule_id UUID REFERENCES payroll_supplement_rule(id),
  metadata        JSONB DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
-- Append-only: lives and dies with parent payroll_calculation row

ALTER TABLE payroll_calculation_line ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "jwt_select_payroll_calc_line" ON payroll_calculation_line;
CREATE POLICY "jwt_select_payroll_calc_line" ON payroll_calculation_line
  FOR SELECT USING (workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid())));

DROP POLICY IF EXISTS "jwt_insert_payroll_calc_line" ON payroll_calculation_line;
CREATE POLICY "jwt_insert_payroll_calc_line" ON payroll_calculation_line
  FOR INSERT WITH CHECK (workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid())));

DROP POLICY IF EXISTS "api_key_read_payroll_calc_line" ON payroll_calculation_line;
CREATE POLICY "api_key_read_payroll_calc_line" ON payroll_calculation_line
  FOR SELECT USING (workspace_id = get_api_workspace_id());

DROP POLICY IF EXISTS "service_role_payroll_calc_line" ON payroll_calculation_line;
CREATE POLICY "service_role_payroll_calc_line" ON payroll_calculation_line
  FOR ALL USING (auth.role() = 'service_role');

CREATE INDEX IF NOT EXISTS idx_payroll_calc_line_calc
  ON payroll_calculation_line (calculation_id);

COMMENT ON TABLE payroll_calculation_line IS 'Payroll: individual line items in a shift calculation. Each line = one salary code entry (base, supplement, deduction, overtime, meal).';

-- --------------------------------------------------------
-- 4. payroll_deviation (Error/warning/info flags)
-- Spec: Section 5.4
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.payroll_deviation (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id      UUID NOT NULL REFERENCES workspace(workspace_id) ON DELETE CASCADE,
  check_id          TEXT NOT NULL,
  severity          payroll_deviation_severity NOT NULL,
  calculation_id    UUID REFERENCES payroll_calculation(id) ON DELETE SET NULL,
  schedule_shift_id UUID REFERENCES schedule_shift(schedule_shift_id) ON DELETE SET NULL,
  profile_id        UUID REFERENCES profile(profile_id) ON DELETE SET NULL,
  period_id         UUID REFERENCES payroll_period(id) ON DELETE CASCADE,
  message           TEXT NOT NULL,
  details           JSONB DEFAULT '{}',
  acknowledged_by   UUID REFERENCES profile(profile_id),
  acknowledged_at   TIMESTAMPTZ,
  resolution        TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE payroll_deviation ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "jwt_select_payroll_deviation" ON payroll_deviation;
CREATE POLICY "jwt_select_payroll_deviation" ON payroll_deviation
  FOR SELECT USING (workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid())));

DROP POLICY IF EXISTS "jwt_insert_payroll_deviation" ON payroll_deviation;
CREATE POLICY "jwt_insert_payroll_deviation" ON payroll_deviation
  FOR INSERT WITH CHECK (workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid())));

DROP POLICY IF EXISTS "jwt_update_payroll_deviation" ON payroll_deviation;
CREATE POLICY "jwt_update_payroll_deviation" ON payroll_deviation
  FOR UPDATE USING (workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid())));

DROP POLICY IF EXISTS "api_key_read_payroll_deviation" ON payroll_deviation;
CREATE POLICY "api_key_read_payroll_deviation" ON payroll_deviation
  FOR SELECT USING (workspace_id = get_api_workspace_id());

DROP POLICY IF EXISTS "service_role_payroll_deviation" ON payroll_deviation;
CREATE POLICY "service_role_payroll_deviation" ON payroll_deviation
  FOR ALL USING (auth.role() = 'service_role');

CREATE INDEX IF NOT EXISTS idx_payroll_deviation_workspace
  ON payroll_deviation (workspace_id);
CREATE INDEX IF NOT EXISTS idx_payroll_deviation_period
  ON payroll_deviation (period_id);
CREATE INDEX IF NOT EXISTS idx_payroll_deviation_severity
  ON payroll_deviation (workspace_id, severity) WHERE acknowledged_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_payroll_deviation_check
  ON payroll_deviation (check_id);

CREATE TRIGGER set_payroll_deviation_updated_at
  BEFORE UPDATE ON public.payroll_deviation
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

COMMENT ON TABLE payroll_deviation IS 'Payroll: control check flags. Error-severity deviations block period approval until acknowledged. Check IDs: P01-P10 (pre-calc), C01-C10 (post-calc), W01-W06 (working time).';

-- --------------------------------------------------------
-- 5. payroll_manual_supplement (Admin-added per-shift supplements)
-- Spec: Section 1.4 Type 4
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.payroll_manual_supplement (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id        UUID NOT NULL REFERENCES workspace(workspace_id) ON DELETE CASCADE,
  schedule_shift_id   UUID NOT NULL REFERENCES schedule_shift(schedule_shift_id) ON DELETE CASCADE,
  supplement_rule_id  UUID REFERENCES payroll_supplement_rule(id),
  salary_code         TEXT,
  description         TEXT NOT NULL,
  amount              NUMERIC(8,2) NOT NULL,
  added_by            UUID NOT NULL REFERENCES profile(profile_id),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE payroll_manual_supplement ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "jwt_select_payroll_manual_supp" ON payroll_manual_supplement;
CREATE POLICY "jwt_select_payroll_manual_supp" ON payroll_manual_supplement
  FOR SELECT USING (workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid())));

DROP POLICY IF EXISTS "jwt_insert_payroll_manual_supp" ON payroll_manual_supplement;
CREATE POLICY "jwt_insert_payroll_manual_supp" ON payroll_manual_supplement
  FOR INSERT WITH CHECK (workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid())));

DROP POLICY IF EXISTS "jwt_update_payroll_manual_supp" ON payroll_manual_supplement;
CREATE POLICY "jwt_update_payroll_manual_supp" ON payroll_manual_supplement
  FOR UPDATE USING (workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid())));

DROP POLICY IF EXISTS "jwt_delete_payroll_manual_supp" ON payroll_manual_supplement;
CREATE POLICY "jwt_delete_payroll_manual_supp" ON payroll_manual_supplement
  FOR DELETE USING (workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid())));

DROP POLICY IF EXISTS "api_key_read_payroll_manual_supp" ON payroll_manual_supplement;
CREATE POLICY "api_key_read_payroll_manual_supp" ON payroll_manual_supplement
  FOR SELECT USING (workspace_id = get_api_workspace_id());

DROP POLICY IF EXISTS "service_role_payroll_manual_supp" ON payroll_manual_supplement;
CREATE POLICY "service_role_payroll_manual_supp" ON payroll_manual_supplement
  FOR ALL USING (auth.role() = 'service_role');

CREATE TRIGGER set_payroll_manual_supp_updated_at
  BEFORE UPDATE ON public.payroll_manual_supplement
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX IF NOT EXISTS idx_payroll_manual_supp_shift
  ON payroll_manual_supplement (schedule_shift_id);
CREATE INDEX IF NOT EXISTS idx_payroll_manual_supp_workspace
  ON payroll_manual_supplement (workspace_id);

COMMENT ON TABLE payroll_manual_supplement IS 'Payroll: admin-added one-off supplements per shift. Tips, bonuses, special event pay.';

-- --------------------------------------------------------
-- 6. payroll_export_event (Export history)
-- Spec: Section 7.2
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.payroll_export_event (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id    UUID NOT NULL REFERENCES workspace(workspace_id) ON DELETE CASCADE,
  period_id       UUID NOT NULL REFERENCES payroll_period(id) ON DELETE CASCADE,
  export_format   TEXT NOT NULL CHECK (export_format IN ('tripletex_api', 'csv', 'pdf', 'excel')),
  status          TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  error_message   TEXT,
  exported_by     UUID NOT NULL REFERENCES profile(profile_id),
  started_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at    TIMESTAMPTZ,
  metadata        JSONB DEFAULT '{}',
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE payroll_export_event ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "jwt_select_payroll_export_event" ON payroll_export_event;
CREATE POLICY "jwt_select_payroll_export_event" ON payroll_export_event
  FOR SELECT USING (workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid())));

DROP POLICY IF EXISTS "jwt_insert_payroll_export_event" ON payroll_export_event;
CREATE POLICY "jwt_insert_payroll_export_event" ON payroll_export_event
  FOR INSERT WITH CHECK (workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid())));

DROP POLICY IF EXISTS "jwt_update_payroll_export_event" ON payroll_export_event;
CREATE POLICY "jwt_update_payroll_export_event" ON payroll_export_event
  FOR UPDATE USING (workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid())));

DROP POLICY IF EXISTS "api_key_read_payroll_export_event" ON payroll_export_event;
CREATE POLICY "api_key_read_payroll_export_event" ON payroll_export_event
  FOR SELECT USING (workspace_id = get_api_workspace_id());

DROP POLICY IF EXISTS "service_role_payroll_export_event" ON payroll_export_event;
CREATE POLICY "service_role_payroll_export_event" ON payroll_export_event
  FOR ALL USING (auth.role() = 'service_role');

CREATE INDEX IF NOT EXISTS idx_payroll_export_event_period
  ON payroll_export_event (period_id);
CREATE INDEX IF NOT EXISTS idx_payroll_export_event_workspace
  ON payroll_export_event (workspace_id);

CREATE TRIGGER set_payroll_export_event_updated_at
  BEFORE UPDATE ON public.payroll_export_event
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

COMMENT ON TABLE payroll_export_event IS 'Payroll: export history tracking. One row per export attempt. Supports Tripletex API, CSV, PDF, Excel.';

-- --------------------------------------------------------
-- 7. payroll_export_line (Per-item in export)
-- Spec: Section 7.2
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.payroll_export_line (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id        UUID NOT NULL REFERENCES workspace(workspace_id) ON DELETE CASCADE,
  export_event_id     UUID NOT NULL REFERENCES payroll_export_event(id) ON DELETE CASCADE,
  calculation_line_id UUID REFERENCES payroll_calculation_line(id),
  profile_id          UUID NOT NULL REFERENCES profile(profile_id),
  salary_code         TEXT NOT NULL,
  external_code       TEXT,
  hours               NUMERIC(6,2),
  rate                NUMERIC(8,2),
  amount              NUMERIC(10,2) NOT NULL,
  external_id         TEXT,
  sync_status         TEXT NOT NULL DEFAULT 'pending' CHECK (sync_status IN ('pending', 'synced', 'failed', 'skipped')),
  error_message       TEXT,
  metadata            JSONB DEFAULT '{}',
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE payroll_export_line ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "jwt_select_payroll_export_line" ON payroll_export_line;
CREATE POLICY "jwt_select_payroll_export_line" ON payroll_export_line
  FOR SELECT USING (workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid())));

DROP POLICY IF EXISTS "jwt_insert_payroll_export_line" ON payroll_export_line;
CREATE POLICY "jwt_insert_payroll_export_line" ON payroll_export_line
  FOR INSERT WITH CHECK (workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid())));

DROP POLICY IF EXISTS "jwt_update_payroll_export_line" ON payroll_export_line;
CREATE POLICY "jwt_update_payroll_export_line" ON payroll_export_line
  FOR UPDATE USING (workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid())));

DROP POLICY IF EXISTS "api_key_read_payroll_export_line" ON payroll_export_line;
CREATE POLICY "api_key_read_payroll_export_line" ON payroll_export_line
  FOR SELECT USING (workspace_id = get_api_workspace_id());

DROP POLICY IF EXISTS "service_role_payroll_export_line" ON payroll_export_line;
CREATE POLICY "service_role_payroll_export_line" ON payroll_export_line
  FOR ALL USING (auth.role() = 'service_role');

CREATE INDEX IF NOT EXISTS idx_payroll_export_line_event
  ON payroll_export_line (export_event_id);
CREATE INDEX IF NOT EXISTS idx_payroll_export_line_profile
  ON payroll_export_line (profile_id);
CREATE INDEX IF NOT EXISTS idx_payroll_export_line_workspace
  ON payroll_export_line (workspace_id);

CREATE TRIGGER set_payroll_export_line_updated_at
  BEFORE UPDATE ON public.payroll_export_line
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

COMMENT ON TABLE payroll_export_line IS 'Payroll: individual line items per export event. Tracks sync status per line for reconciliation with Tripletex.';
