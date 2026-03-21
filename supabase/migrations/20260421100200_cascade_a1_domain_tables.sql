-- ============================================
-- 20260421100200_cascade_a1_domain_tables.sql
-- Cascade A1: 11 domain model tables
-- Spec: Section 4.1 (all table schemas)
-- Depends on: 20260421100000 (btree_gist), 20260421100100 (enums)
-- ============================================

SET search_path TO public, extensions;

-- --------------------------------------------------------
-- 1. planning_cycle (Year wheel container)
-- Owner: Runtime (D1)
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.planning_cycle (
  planning_cycle_id   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id        UUID NOT NULL REFERENCES workspace(workspace_id) ON DELETE CASCADE,
  name                TEXT NOT NULL,
  start_date          DATE NOT NULL,
  end_date            DATE NOT NULL,
  total_revenue_target NUMERIC(12,2),
  status              planning_cycle_status NOT NULL DEFAULT 'draft',
  created_by          UUID REFERENCES profile(profile_id),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT chk_cycle_dates CHECK (end_date > start_date),
  CONSTRAINT excl_cycle_no_overlap EXCLUDE USING gist (
    workspace_id WITH =,
    daterange(start_date, end_date, '[]') WITH &&
  )
);

ALTER TABLE planning_cycle ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "jwt_select_planning_cycle" ON planning_cycle;
CREATE POLICY "jwt_select_planning_cycle" ON planning_cycle
  FOR SELECT USING (workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid())));

DROP POLICY IF EXISTS "jwt_insert_planning_cycle" ON planning_cycle;
CREATE POLICY "jwt_insert_planning_cycle" ON planning_cycle
  FOR INSERT WITH CHECK (workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid())));

DROP POLICY IF EXISTS "jwt_update_planning_cycle" ON planning_cycle;
CREATE POLICY "jwt_update_planning_cycle" ON planning_cycle
  FOR UPDATE USING (workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid())));

DROP POLICY IF EXISTS "jwt_delete_planning_cycle" ON planning_cycle;
CREATE POLICY "jwt_delete_planning_cycle" ON planning_cycle
  FOR DELETE USING (workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid())));

DROP POLICY IF EXISTS "api_key_read_planning_cycle" ON planning_cycle;
CREATE POLICY "api_key_read_planning_cycle" ON planning_cycle
  FOR SELECT USING (workspace_id = get_api_workspace_id());

DROP POLICY IF EXISTS "service_role_planning_cycle" ON planning_cycle;
CREATE POLICY "service_role_planning_cycle" ON planning_cycle
  FOR ALL USING (auth.role() = 'service_role');

CREATE TRIGGER set_planning_cycle_updated_at
  BEFORE UPDATE ON public.planning_cycle
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX IF NOT EXISTS idx_planning_cycle_workspace
  ON planning_cycle (workspace_id);

COMMENT ON TABLE planning_cycle IS 'Cascade D1: Year wheel container. One per planning period per workspace.';

-- --------------------------------------------------------
-- 2. department_operating_hours (Consolidated weekly hours)
-- Owner: Runtime (D1)
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.department_operating_hours (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id    UUID NOT NULL REFERENCES workspace(workspace_id) ON DELETE CASCADE,
  department_id   UUID NOT NULL REFERENCES department(department_id) ON DELETE CASCADE,
  location_id     UUID REFERENCES location(location_id) ON DELETE CASCADE,
  season_id       UUID REFERENCES season(season_id) ON DELETE CASCADE,
  day_of_week     INT NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  open_time       TIME,
  close_time      TIME,
  is_closed       BOOLEAN NOT NULL DEFAULT false,
  provenance      JSONB NOT NULL DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT chk_hours_valid CHECK (is_closed = true OR (open_time IS NOT NULL AND close_time IS NOT NULL))
);

ALTER TABLE department_operating_hours
  ADD CONSTRAINT uq_dept_hours_weekly
  UNIQUE NULLS NOT DISTINCT (department_id, location_id, season_id, day_of_week);

ALTER TABLE department_operating_hours ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "jwt_select_dept_hours" ON department_operating_hours;
CREATE POLICY "jwt_select_dept_hours" ON department_operating_hours
  FOR SELECT USING (workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid())));

DROP POLICY IF EXISTS "jwt_insert_dept_hours" ON department_operating_hours;
CREATE POLICY "jwt_insert_dept_hours" ON department_operating_hours
  FOR INSERT WITH CHECK (workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid())));

DROP POLICY IF EXISTS "jwt_update_dept_hours" ON department_operating_hours;
CREATE POLICY "jwt_update_dept_hours" ON department_operating_hours
  FOR UPDATE USING (workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid())));

DROP POLICY IF EXISTS "jwt_delete_dept_hours" ON department_operating_hours;
CREATE POLICY "jwt_delete_dept_hours" ON department_operating_hours
  FOR DELETE USING (workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid())));

DROP POLICY IF EXISTS "api_key_read_dept_hours" ON department_operating_hours;
CREATE POLICY "api_key_read_dept_hours" ON department_operating_hours
  FOR SELECT USING (workspace_id = get_api_workspace_id());

DROP POLICY IF EXISTS "service_role_dept_hours" ON department_operating_hours;
CREATE POLICY "service_role_dept_hours" ON department_operating_hours
  FOR ALL USING (auth.role() = 'service_role');

CREATE TRIGGER set_dept_hours_updated_at
  BEFORE UPDATE ON public.department_operating_hours
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX IF NOT EXISTS idx_dept_hours_workspace
  ON department_operating_hours (workspace_id);
CREATE INDEX IF NOT EXISTS idx_dept_hours_dept_day
  ON department_operating_hours (department_id, day_of_week);

COMMENT ON TABLE department_operating_hours IS 'Cascade D1: Consolidated weekly operating hours per department/location/season/weekday. NULL season_id = workspace default. Replaces company_opening_hours for runtime.';

-- --------------------------------------------------------
-- 3. planning_event (Demand signal events)
-- Owner: Runtime (D4)
-- NOTE: Must be created BEFORE department_hours_override (FK reference)
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.planning_event (
  planning_event_id   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id        UUID NOT NULL REFERENCES workspace(workspace_id) ON DELETE CASCADE,
  planning_cycle_id   UUID REFERENCES planning_cycle(planning_cycle_id) ON DELETE SET NULL,
  name                TEXT NOT NULL,
  description         TEXT,
  category            planning_event_category NOT NULL,
  source              planning_event_source NOT NULL DEFAULT 'manual',
  event_date          DATE NOT NULL,
  end_date            DATE,
  demand_multiplier   NUMERIC(4,2) NOT NULL DEFAULT 1.0,
  expected_covers     INTEGER,
  confidence          NUMERIC(3,2) DEFAULT 0.5,
  is_recurring        BOOLEAN NOT NULL DEFAULT false,
  recurrence_rule     TEXT,
  external_source_url TEXT,
  hours_override_id   UUID,
  created_by          UUID REFERENCES profile(profile_id),
  provenance          JSONB NOT NULL DEFAULT '{}',
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE planning_event ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "jwt_select_planning_event" ON planning_event;
CREATE POLICY "jwt_select_planning_event" ON planning_event
  FOR SELECT USING (workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid())));

DROP POLICY IF EXISTS "jwt_insert_planning_event" ON planning_event;
CREATE POLICY "jwt_insert_planning_event" ON planning_event
  FOR INSERT WITH CHECK (workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid())));

DROP POLICY IF EXISTS "jwt_update_planning_event" ON planning_event;
CREATE POLICY "jwt_update_planning_event" ON planning_event
  FOR UPDATE USING (workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid())));

DROP POLICY IF EXISTS "jwt_delete_planning_event" ON planning_event;
CREATE POLICY "jwt_delete_planning_event" ON planning_event
  FOR DELETE USING (workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid())));

DROP POLICY IF EXISTS "api_key_read_planning_event" ON planning_event;
CREATE POLICY "api_key_read_planning_event" ON planning_event
  FOR SELECT USING (workspace_id = get_api_workspace_id());

DROP POLICY IF EXISTS "service_role_planning_event" ON planning_event;
CREATE POLICY "service_role_planning_event" ON planning_event
  FOR ALL USING (auth.role() = 'service_role');

CREATE TRIGGER set_planning_event_updated_at
  BEFORE UPDATE ON public.planning_event
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX IF NOT EXISTS idx_planning_event_workspace
  ON planning_event (workspace_id);
CREATE INDEX IF NOT EXISTS idx_planning_event_date
  ON planning_event (workspace_id, event_date);

COMMENT ON TABLE planning_event IS 'Cascade D4: External/internal demand events with multipliers. Linked to planning cycles.';

-- --------------------------------------------------------
-- 4. department_hours_override (Date-specific exceptions)
-- Owner: Runtime (D1)
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.department_hours_override (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id    UUID NOT NULL REFERENCES workspace(workspace_id) ON DELETE CASCADE,
  department_id   UUID NOT NULL REFERENCES department(department_id) ON DELETE CASCADE,
  location_id     UUID REFERENCES location(location_id) ON DELETE CASCADE,
  season_id       UUID REFERENCES season(season_id) ON DELETE CASCADE,
  override_date   DATE NOT NULL,
  open_time       TIME,
  close_time      TIME,
  is_closed       BOOLEAN NOT NULL DEFAULT false,
  reason          TEXT,
  planning_event_id UUID REFERENCES planning_event(planning_event_id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT chk_override_hours_valid CHECK (is_closed = true OR (open_time IS NOT NULL AND close_time IS NOT NULL))
);

ALTER TABLE department_hours_override
  ADD CONSTRAINT uq_dept_hours_override
  UNIQUE NULLS NOT DISTINCT (department_id, location_id, override_date);

ALTER TABLE department_hours_override ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "jwt_select_dept_override" ON department_hours_override;
CREATE POLICY "jwt_select_dept_override" ON department_hours_override
  FOR SELECT USING (workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid())));

DROP POLICY IF EXISTS "jwt_insert_dept_override" ON department_hours_override;
CREATE POLICY "jwt_insert_dept_override" ON department_hours_override
  FOR INSERT WITH CHECK (workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid())));

DROP POLICY IF EXISTS "jwt_update_dept_override" ON department_hours_override;
CREATE POLICY "jwt_update_dept_override" ON department_hours_override
  FOR UPDATE USING (workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid())));

DROP POLICY IF EXISTS "jwt_delete_dept_override" ON department_hours_override;
CREATE POLICY "jwt_delete_dept_override" ON department_hours_override
  FOR DELETE USING (workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid())));

DROP POLICY IF EXISTS "api_key_read_dept_override" ON department_hours_override;
CREATE POLICY "api_key_read_dept_override" ON department_hours_override
  FOR SELECT USING (workspace_id = get_api_workspace_id());

DROP POLICY IF EXISTS "service_role_dept_override" ON department_hours_override;
CREATE POLICY "service_role_dept_override" ON department_hours_override
  FOR ALL USING (auth.role() = 'service_role');

CREATE TRIGGER set_dept_override_updated_at
  BEFORE UPDATE ON public.department_hours_override
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX IF NOT EXISTS idx_dept_override_workspace
  ON department_hours_override (workspace_id);
CREATE INDEX IF NOT EXISTS idx_dept_override_date
  ON department_hours_override (department_id, override_date);

COMMENT ON TABLE department_hours_override IS 'Cascade D1: Date-specific exceptions to operating hours (holidays, events, closures).';

-- --------------------------------------------------------
-- 5. tariff_rate_table (Versioned rates)
-- Owner: K1a (platform baseline) / K1b (workspace override)
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.tariff_rate_table (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id    UUID,
  rate_type       TEXT NOT NULL,
  source          tariff_source NOT NULL DEFAULT 'riksavtalen',
  effective_from  DATE NOT NULL,
  effective_until DATE,
  seniority_years INT,
  amount          NUMERIC(10,2) NOT NULL,
  unit            TEXT NOT NULL DEFAULT 'kr/t',
  metadata        JSONB DEFAULT '{}',
  provenance      JSONB NOT NULL DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT excl_tariff_no_overlap EXCLUDE USING gist (
    rate_type WITH =,
    COALESCE(workspace_id, '00000000-0000-0000-0000-000000000000'::uuid) WITH =,
    daterange(effective_from, COALESCE(effective_until, '9999-12-31'::date), '[]') WITH &&
  )
);

-- tariff_rate_table has nullable workspace_id (NULL = platform-wide K1a)
-- RLS: workspace-scoped rows use standard pattern; platform rows visible to all authenticated
ALTER TABLE tariff_rate_table ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "jwt_select_tariff" ON tariff_rate_table;
CREATE POLICY "jwt_select_tariff" ON tariff_rate_table
  FOR SELECT USING (
    workspace_id IS NULL
    OR workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid()))
  );

DROP POLICY IF EXISTS "api_key_read_tariff" ON tariff_rate_table;
CREATE POLICY "api_key_read_tariff" ON tariff_rate_table
  FOR SELECT USING (
    workspace_id IS NULL
    OR workspace_id = get_api_workspace_id()
  );

DROP POLICY IF EXISTS "service_role_tariff" ON tariff_rate_table;
CREATE POLICY "service_role_tariff" ON tariff_rate_table
  FOR ALL USING (auth.role() = 'service_role');

CREATE TRIGGER set_tariff_updated_at
  BEFORE UPDATE ON public.tariff_rate_table
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX IF NOT EXISTS idx_tariff_rate_type
  ON tariff_rate_table (rate_type, effective_from);
CREATE INDEX IF NOT EXISTS idx_tariff_workspace
  ON tariff_rate_table (workspace_id) WHERE workspace_id IS NOT NULL;

COMMENT ON TABLE tariff_rate_table IS 'Cascade K1a/K1b: Versioned framework-defined rates. NULL workspace_id = platform baseline. Workspace rows override platform rows.';

-- --------------------------------------------------------
-- 6. employee_payroll_profile
-- Owner: Runtime (D2/D3)
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.employee_payroll_profile (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id            UUID NOT NULL REFERENCES workspace(workspace_id) ON DELETE CASCADE,
  profile_id              UUID NOT NULL REFERENCES profile(profile_id) ON DELETE CASCADE,
  employment_contract_id  UUID REFERENCES employment_contract(contract_id),
  salary_type             TEXT NOT NULL CHECK (salary_type IN ('hourly', 'monthly')),
  agreed_weekly_hours     NUMERIC(4,2) NOT NULL,
  tariff_category         TEXT NOT NULL,
  seniority_start_date    DATE NOT NULL,
  sector_experience_years INTEGER NOT NULL DEFAULT 0,
  has_fagbrev             BOOLEAN NOT NULL DEFAULT false,
  tariff_override_id      UUID REFERENCES tariff_rate_table(id),
  valid_from              DATE NOT NULL,
  valid_until             DATE,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_payroll_profile UNIQUE (profile_id, valid_from),
  CONSTRAINT excl_payroll_no_overlap EXCLUDE USING gist (
    profile_id WITH =,
    daterange(valid_from, COALESCE(valid_until, '9999-12-31'::date), '[]') WITH &&
  )
);

-- Note: employment_contract FK references contract_id (the actual PK name), not employment_contract_id

ALTER TABLE employee_payroll_profile ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "jwt_select_payroll_profile" ON employee_payroll_profile;
CREATE POLICY "jwt_select_payroll_profile" ON employee_payroll_profile
  FOR SELECT USING (workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid())));

DROP POLICY IF EXISTS "jwt_insert_payroll_profile" ON employee_payroll_profile;
CREATE POLICY "jwt_insert_payroll_profile" ON employee_payroll_profile
  FOR INSERT WITH CHECK (workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid())));

DROP POLICY IF EXISTS "jwt_update_payroll_profile" ON employee_payroll_profile;
CREATE POLICY "jwt_update_payroll_profile" ON employee_payroll_profile
  FOR UPDATE USING (workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid())));

DROP POLICY IF EXISTS "api_key_read_payroll_profile" ON employee_payroll_profile;
CREATE POLICY "api_key_read_payroll_profile" ON employee_payroll_profile
  FOR SELECT USING (workspace_id = get_api_workspace_id());

DROP POLICY IF EXISTS "service_role_payroll_profile" ON employee_payroll_profile;
CREATE POLICY "service_role_payroll_profile" ON employee_payroll_profile
  FOR ALL USING (auth.role() = 'service_role');

CREATE TRIGGER set_payroll_profile_updated_at
  BEFORE UPDATE ON public.employee_payroll_profile
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX IF NOT EXISTS idx_payroll_profile_workspace
  ON employee_payroll_profile (workspace_id);
CREATE INDEX IF NOT EXISTS idx_payroll_profile_employee
  ON employee_payroll_profile (profile_id, valid_from);

COMMENT ON TABLE employee_payroll_profile IS 'Cascade D2/D3: Links contract to payroll calculation via tariff categories. Base rate resolved at query time from tariff_rate_table.';

-- --------------------------------------------------------
-- 7. shift_cost_snapshot (Append-only cost audit)
-- Owner: Control (C3)
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.shift_cost_snapshot (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id        UUID NOT NULL REFERENCES workspace(workspace_id) ON DELETE CASCADE,
  schedule_shift_id   UUID NOT NULL REFERENCES schedule_shift(schedule_shift_id) ON DELETE CASCADE,
  profile_id          UUID REFERENCES profile(profile_id),
  base_hours          NUMERIC(5,2) NOT NULL,
  base_rate           NUMERIC(8,2) NOT NULL,
  base_cost           NUMERIC(10,2) NOT NULL,
  supplements         JSONB NOT NULL DEFAULT '[]',
  overtime_cost       NUMERIC(10,2) NOT NULL DEFAULT 0,
  total_cost          NUMERIC(10,2) NOT NULL,
  calculated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  calculation_version INT NOT NULL DEFAULT 1
);
-- Append-only: new calculation = new row. Never UPDATE.

ALTER TABLE shift_cost_snapshot ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "jwt_select_cost_snapshot" ON shift_cost_snapshot;
CREATE POLICY "jwt_select_cost_snapshot" ON shift_cost_snapshot
  FOR SELECT USING (workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid())));

DROP POLICY IF EXISTS "api_key_read_cost_snapshot" ON shift_cost_snapshot;
CREATE POLICY "api_key_read_cost_snapshot" ON shift_cost_snapshot
  FOR SELECT USING (workspace_id = get_api_workspace_id());

DROP POLICY IF EXISTS "service_role_cost_snapshot" ON shift_cost_snapshot;
CREATE POLICY "service_role_cost_snapshot" ON shift_cost_snapshot
  FOR ALL USING (auth.role() = 'service_role');

-- No updated_at trigger — append-only table
CREATE INDEX IF NOT EXISTS idx_cost_snapshot_shift
  ON shift_cost_snapshot (schedule_shift_id, calculated_at DESC);
CREATE INDEX IF NOT EXISTS idx_cost_snapshot_workspace
  ON shift_cost_snapshot (workspace_id);

COMMENT ON TABLE shift_cost_snapshot IS 'Cascade C3: Append-only per-shift cost audit trail. Never UPDATE — new calc = new row.';

-- --------------------------------------------------------
-- 8. change_proposal (Terraform-style saved plan)
-- Owner: Control (C4)
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.change_proposal (
  change_proposal_id  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id        UUID NOT NULL REFERENCES workspace(workspace_id) ON DELETE CASCADE,
  initiated_by        UUID NOT NULL REFERENCES profile(profile_id),
  trigger_type        TEXT NOT NULL,               -- TEXT in A1; cannot use framework_trigger_type enum yet (defined in A2)
  trigger_entity_type TEXT NOT NULL,
  trigger_entity_id   UUID,
  created_by_plane    cascade_initiator NOT NULL DEFAULT 'admin_manual',
  status              change_proposal_status NOT NULL DEFAULT 'pending',
  changes             JSONB NOT NULL DEFAULT '{}',
  preview             JSONB NOT NULL DEFAULT '{}',
  input_state_hash    TEXT,
  risk_score          NUMERIC(3,2),
  policy_decision     evaluation_outcome,
  policy_rule_ids     TEXT[],
  approval_required   BOOLEAN NOT NULL DEFAULT false,
  approved_by         UUID REFERENCES profile(profile_id),
  approved_at         TIMESTAMPTZ,
  rejected_at         TIMESTAMPTZ,
  rejection_reason    TEXT,
  affected_employee_count INTEGER DEFAULT 0,
  affected_shift_count    INTEGER DEFAULT 0,
  conflict_count          INTEGER DEFAULT 0,
  applied_at          TIMESTAMPTZ,
  expires_at          TIMESTAMPTZ,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Note: framework_trigger_id FK omitted here — it references A2 framework tables.
-- Will be added via ALTER TABLE in the A2 migration.

ALTER TABLE change_proposal ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "jwt_select_change_proposal" ON change_proposal;
CREATE POLICY "jwt_select_change_proposal" ON change_proposal
  FOR SELECT USING (workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid())));

DROP POLICY IF EXISTS "jwt_insert_change_proposal" ON change_proposal;
CREATE POLICY "jwt_insert_change_proposal" ON change_proposal
  FOR INSERT WITH CHECK (workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid())));

DROP POLICY IF EXISTS "jwt_update_change_proposal" ON change_proposal;
CREATE POLICY "jwt_update_change_proposal" ON change_proposal
  FOR UPDATE USING (workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid())));

DROP POLICY IF EXISTS "api_key_read_change_proposal" ON change_proposal;
CREATE POLICY "api_key_read_change_proposal" ON change_proposal
  FOR SELECT USING (workspace_id = get_api_workspace_id());

DROP POLICY IF EXISTS "service_role_change_proposal" ON change_proposal;
CREATE POLICY "service_role_change_proposal" ON change_proposal
  FOR ALL USING (auth.role() = 'service_role');

CREATE TRIGGER set_change_proposal_updated_at
  BEFORE UPDATE ON public.change_proposal
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX IF NOT EXISTS idx_change_proposal_workspace
  ON change_proposal (workspace_id);
CREATE INDEX IF NOT EXISTS idx_change_proposal_status
  ON change_proposal (workspace_id, status) WHERE status = 'pending';

COMMENT ON TABLE change_proposal IS 'Cascade C4: Persisted cascade preview (Terraform saved plan). changes/preview/input_state_hash are immutable after creation.';

-- --------------------------------------------------------
-- 9. public_holiday (Framework-defined calendar days)
-- Owner: K1a (platform)
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.public_holiday (
  country_code    CHAR(2) NOT NULL DEFAULT 'NO',
  holiday_date    DATE NOT NULL,
  name            TEXT NOT NULL,
  name_no         TEXT NOT NULL,
  is_full_day     BOOLEAN NOT NULL DEFAULT true,
  PRIMARY KEY (country_code, holiday_date)
);

-- Platform-managed, no workspace_id — visible to all authenticated users
ALTER TABLE public_holiday ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "authenticated_select_public_holiday" ON public_holiday;
CREATE POLICY "authenticated_select_public_holiday" ON public_holiday
  FOR SELECT USING (auth.role() IN ('authenticated', 'service_role'));

DROP POLICY IF EXISTS "service_role_public_holiday" ON public_holiday;
CREATE POLICY "service_role_public_holiday" ON public_holiday
  FOR ALL USING (auth.role() = 'service_role');

CREATE INDEX IF NOT EXISTS idx_public_holiday_date
  ON public_holiday (holiday_date);

COMMENT ON TABLE public_holiday IS 'Cascade K1a: Framework-defined calendar days for supplement calculation. Norway-only for now. Composite PK (country_code, holiday_date).';

-- --------------------------------------------------------
-- 10. planning_factors (Planned vs actual tracking)
-- Owner: Control (C1/K1b)
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.planning_factors (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id    UUID NOT NULL REFERENCES workspace(workspace_id) ON DELETE CASCADE,
  season_id       UUID REFERENCES season(season_id),
  factor_type     TEXT NOT NULL,
  dimension       TEXT NOT NULL,
  period_date     DATE NOT NULL,
  planned_value   NUMERIC(12,2) NOT NULL,
  actual_value    NUMERIC(12,2),
  variance_pct    NUMERIC(6,2) GENERATED ALWAYS AS (
    CASE WHEN planned_value != 0 AND actual_value IS NOT NULL
      THEN ((actual_value - planned_value) / planned_value * 100)
      ELSE NULL
    END
  ) STORED,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_planning_factor UNIQUE (workspace_id, factor_type, dimension, period_date)
);

ALTER TABLE planning_factors ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "jwt_select_planning_factors" ON planning_factors;
CREATE POLICY "jwt_select_planning_factors" ON planning_factors
  FOR SELECT USING (workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid())));

DROP POLICY IF EXISTS "service_role_planning_factors" ON planning_factors;
CREATE POLICY "service_role_planning_factors" ON planning_factors
  FOR ALL USING (auth.role() = 'service_role');

CREATE TRIGGER set_planning_factors_updated_at
  BEFORE UPDATE ON public.planning_factors
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX IF NOT EXISTS idx_planning_factors_workspace
  ON planning_factors (workspace_id, factor_type, period_date);

COMMENT ON TABLE planning_factors IS 'Cascade C1/K1b: Planned vs actual tracking for the learning loop. variance_pct is auto-calculated.';

-- --------------------------------------------------------
-- 11. adjustment_factors (EWMA learning state)
-- Owner: Control (C1/K1b)
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.adjustment_factors (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id      UUID NOT NULL REFERENCES workspace(workspace_id) ON DELETE CASCADE,
  season_id         UUID REFERENCES season(season_id),
  factor_type       TEXT NOT NULL,
  dimension         TEXT NOT NULL,
  adjustment_ratio  NUMERIC(6,4) NOT NULL DEFAULT 1.0,
  alpha             NUMERIC(4,3) NOT NULL DEFAULT 0.5,
  observation_count INTEGER NOT NULL DEFAULT 0,
  confidence        NUMERIC(3,2) NOT NULL DEFAULT 0.0,
  last_actual       NUMERIC(12,2),
  last_planned      NUMERIC(12,2),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_adjustment_factor UNIQUE (workspace_id, season_id, factor_type, dimension)
);

ALTER TABLE adjustment_factors ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "service_role_adjustment_factors" ON adjustment_factors;
CREATE POLICY "service_role_adjustment_factors" ON adjustment_factors
  FOR ALL USING (auth.role() = 'service_role');

-- C1 EWMA engine writes only — no direct user access
-- Read access for admins via service role or explicit JWT policy if needed later

CREATE TRIGGER set_adjustment_factors_updated_at
  BEFORE UPDATE ON public.adjustment_factors
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX IF NOT EXISTS idx_adjustment_factors_workspace
  ON adjustment_factors (workspace_id, factor_type);

COMMENT ON TABLE adjustment_factors IS 'Cascade C1/K1b: EWMA learning state. Service-role only — written by calibration engine.';
