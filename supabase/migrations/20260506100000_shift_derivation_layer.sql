-- 20260506100000_shift_derivation_layer.sql
-- ADR-0095 Phase 3: Shift Lifecycle Derivation Layer.
-- ADR-0097: time_entry is immutable after Interpretation consumes it.
-- ADR-0100: daily_close aggregates settled shifts (depends on this layer).
--
-- Purpose: introduce the missing Interpretation layer between Reality (time_entry)
-- and Derivation (shift_cost_snapshot). Every output row is version-tagged and
-- carries input provenance so payroll is reproducibly re-derivable from history.
--
-- Summary of changes:
--   1. NEW table public.shift_hour_interpretation (D6-derived).
--   2. ALTER public.shift_cost_snapshot — add interpretation_id, tariff_rate_snapshot,
--      payroll_profile_id, snapshot_version (existing rows preserved).
--   3. employee_payroll_profile is NOT changed — the existing shape already covers
--      (profile_id, workspace_id, tariff_override_id → tariff_rate_table, salary_type,
--       agreed_weekly_hours as contract_hours_weekly, valid_from/valid_until with
--       no-overlap exclusion constraint).
--   4. public.derive_shift_hours(shift_id) — deterministic Interpretation RPC.
--   5. public.snapshot_shift_cost(interpretation_id) — deterministic Derivation RPC.
--   6. timesheet.time_entry RLS update — block UPDATE after Interpretation consumes.

SET search_path TO public, extensions;

-- ──────────────────────────────────────────────
-- 1. shift_hour_interpretation (Interpretation layer, D6-derived)
-- ──────────────────────────────────────────────
-- Units: hours, NUMERIC(5,2). One decimal fraction = 0.01 h = 36 s resolution.
-- Immutability per version: a given (shift_id, derivation_version) is written once
-- and never updated. Re-derivations bump the version and write a new row.
CREATE TABLE IF NOT EXISTS public.shift_hour_interpretation (
  interpretation_id     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id          UUID NOT NULL REFERENCES workspace(workspace_id) ON DELETE CASCADE,
  shift_id              UUID NOT NULL REFERENCES schedule_shift(schedule_shift_id) ON DELETE CASCADE,
  department_id         UUID REFERENCES department(department_id),

  -- Input provenance (ADR-0097): exactly which reality rows and which D3 rules were consumed.
  time_entry_ids        UUID[] NOT NULL DEFAULT '{}',
  framework_rule_ids    UUID[] NOT NULL DEFAULT '{}',

  -- Output (hours, NUMERIC(5,2)).
  regular_hours         NUMERIC(5,2) NOT NULL DEFAULT 0,
  overtime_hours        NUMERIC(5,2) NOT NULL DEFAULT 0,
  night_hours           NUMERIC(5,2) NOT NULL DEFAULT 0,
  holiday_hours         NUMERIC(5,2) NOT NULL DEFAULT 0,
  weekend_hours         NUMERIC(5,2) NOT NULL DEFAULT 0,
  break_deductions      NUMERIC(5,2) NOT NULL DEFAULT 0,
  total_interpreted_hours NUMERIC(5,2) NOT NULL DEFAULT 0,

  -- Versioning: each re-derivation is append-only.
  derivation_version    INT NOT NULL DEFAULT 1,
  derived_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  derived_by            TEXT NOT NULL DEFAULT 'derive_shift_hours@v1',

  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT uq_interpretation_version UNIQUE (shift_id, derivation_version)
);

CREATE INDEX IF NOT EXISTS idx_interpretation_workspace_shift
  ON public.shift_hour_interpretation (workspace_id, shift_id);
CREATE INDEX IF NOT EXISTS idx_interpretation_shift_latest
  ON public.shift_hour_interpretation (shift_id, derivation_version DESC);

ALTER TABLE public.shift_hour_interpretation ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "jwt_read_interpretation" ON public.shift_hour_interpretation;
CREATE POLICY "jwt_read_interpretation" ON public.shift_hour_interpretation
  FOR SELECT USING (workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid())));

DROP POLICY IF EXISTS "api_key_read_interpretation" ON public.shift_hour_interpretation;
CREATE POLICY "api_key_read_interpretation" ON public.shift_hour_interpretation
  FOR SELECT USING (workspace_id = get_api_workspace_id());

-- Writes are system-driven (derive_shift_hours is SECURITY DEFINER). Lock out direct writes.
DROP POLICY IF EXISTS "service_role_interpretation" ON public.shift_hour_interpretation;
CREATE POLICY "service_role_interpretation" ON public.shift_hour_interpretation
  FOR ALL USING (auth.role() = 'service_role');

DROP TRIGGER IF EXISTS set_interpretation_updated_at ON public.shift_hour_interpretation;
CREATE TRIGGER set_interpretation_updated_at
  BEFORE UPDATE ON public.shift_hour_interpretation
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

COMMENT ON TABLE public.shift_hour_interpretation IS
  'ADR-0095 Interpretation layer: deterministic application of D3 rules to Reality (time_entry). '
  'Immutable per derivation_version. Full provenance via time_entry_ids + framework_rule_ids.';

-- ──────────────────────────────────────────────
-- 2. Extend shift_cost_snapshot (Derivation layer, C3) with interpretation link
-- ──────────────────────────────────────────────
-- Existing table (migration 20260421100200) already exposes base_hours/base_rate/base_cost/
-- supplements/overtime_cost/total_cost/calculation_version. We add:
--   - interpretation_id (FK) — binds cost to the exact Interpretation it was derived from.
--   - payroll_profile_id (FK, nullable) — which payroll profile was in effect.
--   - tariff_rate_snapshot (jsonb) — frozen tariff rows applied at snapshot time.
--   - snapshot_version (alias for existing calculation_version; we reuse it).
--   - regular_cost / night_cost / holiday_cost — per-bucket breakdown for payroll export.
ALTER TABLE public.shift_cost_snapshot
  ADD COLUMN IF NOT EXISTS interpretation_id    UUID REFERENCES public.shift_hour_interpretation(interpretation_id);

ALTER TABLE public.shift_cost_snapshot
  ADD COLUMN IF NOT EXISTS payroll_profile_id   UUID REFERENCES public.employee_payroll_profile(id);

ALTER TABLE public.shift_cost_snapshot
  ADD COLUMN IF NOT EXISTS tariff_rate_snapshot JSONB NOT NULL DEFAULT '{}';

ALTER TABLE public.shift_cost_snapshot
  ADD COLUMN IF NOT EXISTS regular_cost         NUMERIC(10,2) NOT NULL DEFAULT 0;

ALTER TABLE public.shift_cost_snapshot
  ADD COLUMN IF NOT EXISTS night_cost           NUMERIC(10,2) NOT NULL DEFAULT 0;

ALTER TABLE public.shift_cost_snapshot
  ADD COLUMN IF NOT EXISTS holiday_cost         NUMERIC(10,2) NOT NULL DEFAULT 0;

ALTER TABLE public.shift_cost_snapshot
  ADD COLUMN IF NOT EXISTS gross_cost           NUMERIC(10,2) NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_cost_snapshot_interpretation
  ON public.shift_cost_snapshot (interpretation_id);

-- Uniqueness: one snapshot per (shift, calculation_version). Existing data has only the
-- FK, version defaults 1, so this unique constraint is safe to add.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'uq_cost_snapshot_version'
       AND conrelid = 'public.shift_cost_snapshot'::regclass
  ) THEN
    ALTER TABLE public.shift_cost_snapshot
      ADD CONSTRAINT uq_cost_snapshot_version UNIQUE (schedule_shift_id, calculation_version);
  END IF;
END $$;

-- Admin-only read: cost snapshot contains salary data. Replace the broad jwt_select policy.
DROP POLICY IF EXISTS "jwt_select_cost_snapshot" ON public.shift_cost_snapshot;
DROP POLICY IF EXISTS "admin_select_cost_snapshot" ON public.shift_cost_snapshot;
CREATE POLICY "admin_select_cost_snapshot" ON public.shift_cost_snapshot
  FOR SELECT USING (
    workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid()))
    AND EXISTS (
      SELECT 1 FROM public.profile
       WHERE user_id = auth.uid()
         AND workspace_id = shift_cost_snapshot.workspace_id
         AND role IN ('admin', 'owner')
         AND is_active = true
    )
  );

COMMENT ON COLUMN public.shift_cost_snapshot.interpretation_id IS
  'ADR-0095: binds this cost row to the exact Interpretation row it was derived from.';
COMMENT ON COLUMN public.shift_cost_snapshot.tariff_rate_snapshot IS
  'Frozen copy of tariff_rate_table rows applied at snapshot time. Reproducibility guarantee.';

-- ──────────────────────────────────────────────
-- 3. derive_shift_hours(shift_id) — pure Interpretation RPC
-- ──────────────────────────────────────────────
-- Rules applied:
--   - Night window (AML §10-11 / Riksavtalen §6): 21:00-06:00 → night_hours.
--   - Weekend (Riksavtalen §6): Saturday 15:00 → Sunday 24:00 → weekend_hours.
--   - Public holiday: shift_date ∈ public_holiday → total counts as holiday_hours.
--   - Overtime (AML §10-6): anything beyond the shift's scheduled work_hours on a
--     single shift counts as overtime.
--   - Break deductions: sum of breaks from time_entry.breaks jsonb intervals.
--
-- Determinism: the function reads only the shift_date, time_entry punches, and framework
-- rule rows. No call to now(). Same inputs → same outputs.
CREATE OR REPLACE FUNCTION public.derive_shift_hours(p_shift_id UUID)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_shift                 public.schedule_shift%ROWTYPE;
  v_framework_id          UUID;
  v_entry                 RECORD;
  v_time_entry_ids        UUID[] := '{}';
  v_framework_rule_ids    UUID[] := '{}';
  v_worked_seconds        NUMERIC := 0;
  v_break_seconds         NUMERIC := 0;
  v_night_seconds         NUMERIC := 0;
  v_weekend_seconds       NUMERIC := 0;
  v_is_holiday            BOOLEAN := false;
  v_scheduled_hours       NUMERIC;
  v_worked_hours          NUMERIC;
  v_net_hours             NUMERIC;
  v_overtime_hours        NUMERIC;
  v_regular_hours         NUMERIC;
  v_break_hours           NUMERIC;
  v_night_hours           NUMERIC;
  v_holiday_hours         NUMERIC := 0;
  v_weekend_hours         NUMERIC;
  v_next_version          INT;
  v_interpretation_id     UUID;
  v_break_rec             JSONB;
BEGIN
  -- 1. Load the shift (immutable inputs).
  SELECT * INTO v_shift FROM public.schedule_shift
   WHERE schedule_shift_id = p_shift_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'derive_shift_hours: shift % not found', p_shift_id;
  END IF;

  -- 2. Holiday check (date-only, deterministic).
  SELECT EXISTS (
    SELECT 1 FROM public.public_holiday
     WHERE country_code = 'NO'
       AND holiday_date = v_shift.shift_date
  ) INTO v_is_holiday;

  -- 3. Active framework → rule provenance (union of rules that could have applied).
  SELECT framework_id INTO v_framework_id
    FROM public.workspace_framework_binding
   WHERE workspace_id = v_shift.workspace_id
     AND is_active = true
   LIMIT 1;

  IF v_framework_id IS NOT NULL THEN
    SELECT COALESCE(array_agg(rule_id), '{}'::UUID[])
      INTO v_framework_rule_ids
      FROM public.framework_rule
     WHERE framework_id = v_framework_id
       AND code IN (
         'aml.night_work',
         'aml.sunday_holiday_work',
         'aml.overtime_50',
         'riksavtalen.overtime_100',
         'riksavtalen.kveldstillegg',
         'riksavtalen.helgetillegg',
         'riksavtalen.helligdagstillegg'
       );
  END IF;

  -- 4. Sum punches — completed entries only (ADR-0097 Reality rows in their final form).
  -- Worked + break seconds aggregated in this loop. Night + weekend are tallied from
  -- minute-tick generate_series in the nested subqueries so we stay deterministic.
  FOR v_entry IN
    SELECT time_entry_id, punch_in, punch_out, breaks
      FROM timesheet.time_entry
     WHERE shift_id = p_shift_id
       AND status = 'completed'
       AND punch_in IS NOT NULL
       AND punch_out IS NOT NULL
     ORDER BY punch_in
  LOOP
    v_time_entry_ids := array_append(v_time_entry_ids, v_entry.time_entry_id);
    v_worked_seconds := v_worked_seconds + EXTRACT(EPOCH FROM (v_entry.punch_out - v_entry.punch_in));

    -- Break sum (jsonb array of {start,end}).
    IF v_entry.breaks IS NOT NULL THEN
      FOR v_break_rec IN SELECT * FROM jsonb_array_elements(v_entry.breaks)
      LOOP
        v_break_seconds := v_break_seconds + GREATEST(0, EXTRACT(EPOCH FROM (
          (v_break_rec->>'end')::timestamptz - (v_break_rec->>'start')::timestamptz
        )));
      END LOOP;
    END IF;

    -- Night minutes: 21:00-06:00 in Europe/Oslo local clock (jurisdiction 'NO').
    v_night_seconds := v_night_seconds + COALESCE((
      SELECT SUM(
        CASE
          WHEN EXTRACT(HOUR FROM tick AT TIME ZONE 'Europe/Oslo') >= 21
            OR EXTRACT(HOUR FROM tick AT TIME ZONE 'Europe/Oslo') < 6
          THEN 60
          ELSE 0
        END
      )::NUMERIC
        FROM generate_series(
          date_trunc('minute', v_entry.punch_in),
          date_trunc('minute', v_entry.punch_out) - INTERVAL '1 minute',
          INTERVAL '1 minute'
        ) AS tick
    ), 0);

    -- Weekend minutes: Saturday 15:00 → Sunday 24:00 in Europe/Oslo.
    v_weekend_seconds := v_weekend_seconds + COALESCE((
      SELECT SUM(
        CASE
          WHEN (EXTRACT(DOW FROM tick AT TIME ZONE 'Europe/Oslo') = 6
                AND EXTRACT(HOUR FROM tick AT TIME ZONE 'Europe/Oslo') >= 15)
            OR (EXTRACT(DOW FROM tick AT TIME ZONE 'Europe/Oslo') = 0)
          THEN 60
          ELSE 0
        END
      )::NUMERIC
        FROM generate_series(
          date_trunc('minute', v_entry.punch_in),
          date_trunc('minute', v_entry.punch_out) - INTERVAL '1 minute',
          INTERVAL '1 minute'
        ) AS tick
    ), 0);
  END LOOP;

  -- 5. Derive hours in NUMERIC(5,2).
  v_break_hours   := ROUND((v_break_seconds   / 3600.0)::NUMERIC, 2);
  v_night_hours   := ROUND((v_night_seconds   / 3600.0)::NUMERIC, 2);
  v_weekend_hours := ROUND((v_weekend_seconds / 3600.0)::NUMERIC, 2);
  v_worked_hours  := ROUND((v_worked_seconds  / 3600.0)::NUMERIC, 2);
  v_net_hours     := GREATEST(0, v_worked_hours - v_break_hours);

  v_scheduled_hours := COALESCE(v_shift.work_hours, 0);
  IF v_net_hours > v_scheduled_hours AND v_scheduled_hours > 0 THEN
    v_overtime_hours := ROUND(v_net_hours - v_scheduled_hours, 2);
    v_regular_hours  := v_scheduled_hours;
  ELSE
    v_overtime_hours := 0;
    v_regular_hours  := v_net_hours;
  END IF;

  IF v_is_holiday THEN
    v_holiday_hours := v_net_hours;
  END IF;

  -- Clamp night/weekend to net worked hours (they are *components*, not extras).
  v_night_hours   := LEAST(v_night_hours,   v_net_hours);
  v_weekend_hours := LEAST(v_weekend_hours, v_net_hours);

  -- 6. Compute next version atomically.
  SELECT COALESCE(MAX(derivation_version), 0) + 1
    INTO v_next_version
    FROM public.shift_hour_interpretation
   WHERE shift_id = p_shift_id;

  -- 7. Write the interpretation row (append-only per version).
  INSERT INTO public.shift_hour_interpretation (
    workspace_id, shift_id, department_id,
    time_entry_ids, framework_rule_ids,
    regular_hours, overtime_hours, night_hours, holiday_hours, weekend_hours,
    break_deductions, total_interpreted_hours,
    derivation_version, derived_at, derived_by
  ) VALUES (
    v_shift.workspace_id, p_shift_id, v_shift.department_id,
    v_time_entry_ids, v_framework_rule_ids,
    v_regular_hours, v_overtime_hours, v_night_hours, v_holiday_hours, v_weekend_hours,
    v_break_hours, v_net_hours,
    v_next_version,
    -- derived_at is deterministic w.r.t. the row's identity; we use now() only as the
    -- wall-clock marker. Derivation outputs do NOT depend on it.
    now(), 'derive_shift_hours@v1'
  )
  RETURNING interpretation_id INTO v_interpretation_id;

  RETURN v_interpretation_id;
END;
$$;

COMMENT ON FUNCTION public.derive_shift_hours(UUID) IS
  'ADR-0095 Interpretation RPC. Deterministic: same time_entry + framework rules → same output. '
  'Version-bumps on each call so re-derivations are append-only.';

GRANT EXECUTE ON FUNCTION public.derive_shift_hours(UUID) TO service_role, authenticated;

-- ──────────────────────────────────────────────
-- 4. snapshot_shift_cost(interpretation_id) — pure Derivation RPC
-- ──────────────────────────────────────────────
-- Reads: interpretation row, active employee_payroll_profile for the shift_date,
-- resolved tariff_rate_table rows. Writes ONE frozen shift_cost_snapshot row.
CREATE OR REPLACE FUNCTION public.snapshot_shift_cost(p_interpretation_id UUID)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_interp          public.shift_hour_interpretation%ROWTYPE;
  v_shift           public.schedule_shift%ROWTYPE;
  v_profile         public.employee_payroll_profile%ROWTYPE;
  v_base_rate       NUMERIC(10,2) := 0;
  v_night_premium   NUMERIC(10,2) := 15.65;    -- Riksavtalen §6 default
  v_holiday_premium NUMERIC(10,2) := 100;      -- percent of base (Riksavtalen §6)
  v_overtime_mult   NUMERIC(10,2) := 1.50;     -- AML §10-6(11) / Riksavtalen §7
  v_regular_cost    NUMERIC(10,2);
  v_overtime_cost   NUMERIC(10,2);
  v_night_cost      NUMERIC(10,2);
  v_holiday_cost    NUMERIC(10,2);
  v_gross_cost      NUMERIC(10,2);
  v_tariff_snapshot JSONB := '{}';
  v_next_version    INT;
  v_snapshot_id     UUID;
BEGIN
  SELECT * INTO v_interp FROM public.shift_hour_interpretation
   WHERE interpretation_id = p_interpretation_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'snapshot_shift_cost: interpretation % not found', p_interpretation_id;
  END IF;

  SELECT * INTO v_shift FROM public.schedule_shift
   WHERE schedule_shift_id = v_interp.shift_id;

  -- Pick the active payroll profile for this employee on the shift date.
  SELECT * INTO v_profile
    FROM public.employee_payroll_profile
   WHERE profile_id = v_shift.employee_id
     AND workspace_id = v_shift.workspace_id
     AND valid_from <= v_shift.shift_date
     AND (valid_until IS NULL OR valid_until >= v_shift.shift_date)
   ORDER BY valid_from DESC
   LIMIT 1;

  -- Resolve base hourly rate from tariff_rate_table (workspace override → platform baseline).
  IF FOUND AND v_profile.tariff_override_id IS NOT NULL THEN
    SELECT amount INTO v_base_rate FROM public.tariff_rate_table
     WHERE id = v_profile.tariff_override_id;
  ELSIF FOUND THEN
    SELECT amount INTO v_base_rate FROM public.tariff_rate_table
     WHERE rate_type = v_profile.tariff_category
       AND (workspace_id = v_shift.workspace_id OR workspace_id IS NULL)
       AND effective_from <= v_shift.shift_date
       AND (effective_until IS NULL OR effective_until >= v_shift.shift_date)
     ORDER BY workspace_id NULLS LAST, effective_from DESC
     LIMIT 1;
  END IF;

  v_base_rate := COALESCE(v_base_rate, 0);

  -- Costs (numeric, hours × rate).
  v_regular_cost  := ROUND(v_interp.regular_hours  * v_base_rate, 2);
  v_overtime_cost := ROUND(v_interp.overtime_hours * v_base_rate * v_overtime_mult, 2);
  v_night_cost    := ROUND(v_interp.night_hours    * v_night_premium, 2);
  v_holiday_cost  := ROUND(v_interp.holiday_hours  * v_base_rate * (v_holiday_premium / 100.0), 2);
  v_gross_cost    := v_regular_cost + v_overtime_cost + v_night_cost + v_holiday_cost;

  -- Frozen tariff snapshot — captures the exact rates applied.
  v_tariff_snapshot := jsonb_build_object(
    'base_rate',         v_base_rate,
    'night_premium',     v_night_premium,
    'holiday_premium',   v_holiday_premium,
    'overtime_multiplier', v_overtime_mult,
    'resolved_at',       v_shift.shift_date,
    'payroll_profile_id', COALESCE(v_profile.id::text, null)
  );

  SELECT COALESCE(MAX(calculation_version), 0) + 1
    INTO v_next_version
    FROM public.shift_cost_snapshot
   WHERE schedule_shift_id = v_interp.shift_id;

  INSERT INTO public.shift_cost_snapshot (
    workspace_id, schedule_shift_id, profile_id,
    interpretation_id, payroll_profile_id,
    base_hours, base_rate, base_cost,
    supplements, overtime_cost, total_cost,
    regular_cost, night_cost, holiday_cost, gross_cost,
    tariff_rate_snapshot, calculation_version
  ) VALUES (
    v_interp.workspace_id, v_interp.shift_id, v_shift.employee_id,
    p_interpretation_id, v_profile.id,
    v_interp.regular_hours, v_base_rate, v_regular_cost,
    '[]'::jsonb, v_overtime_cost, v_gross_cost,
    v_regular_cost, v_night_cost, v_holiday_cost, v_gross_cost,
    v_tariff_snapshot, v_next_version
  )
  RETURNING id INTO v_snapshot_id;

  RETURN v_snapshot_id;
END;
$$;

COMMENT ON FUNCTION public.snapshot_shift_cost(UUID) IS
  'ADR-0095 Derivation RPC. Pure function of (interpretation, payroll_profile, tariff). '
  'Append-only via calculation_version; tariff_rate_snapshot freezes inputs for reproducibility.';

GRANT EXECUTE ON FUNCTION public.snapshot_shift_cost(UUID) TO service_role, authenticated;

-- ──────────────────────────────────────────────
-- 5. time_entry immutability (ADR-0097)
-- ──────────────────────────────────────────────
-- Once a completed time_entry has been consumed by Interpretation, UPDATE is forbidden
-- for all non-service roles. Manager corrections flow through shift_approval override
-- artifacts instead. INSERT of the row (and punch-out UPDATE during 'clocked_in') is
-- still allowed via the existing policies — the new policy only blocks UPDATE after
-- the row has been consumed.
DROP POLICY IF EXISTS "jwt_update_own_time_entry" ON timesheet.time_entry;
CREATE POLICY "jwt_update_own_time_entry" ON timesheet.time_entry
  FOR UPDATE
  USING (
    profile_id IN (
      SELECT profile_id FROM public.profile WHERE user_id = auth.uid()
    )
    AND workspace_id IN (SELECT public.get_workspace_ids_for_user(auth.uid()))
    -- ADR-0097: immutable once Interpretation has consumed the completed row.
    AND NOT EXISTS (
      SELECT 1 FROM public.shift_hour_interpretation shi
       WHERE shi.shift_id = timesheet.time_entry.shift_id
         AND time_entry.time_entry_id = ANY(shi.time_entry_ids)
    )
  )
  WITH CHECK (
    profile_id IN (
      SELECT profile_id FROM public.profile WHERE user_id = auth.uid()
    )
    AND workspace_id IN (SELECT public.get_workspace_ids_for_user(auth.uid()))
  );

COMMENT ON POLICY "jwt_update_own_time_entry" ON timesheet.time_entry IS
  'ADR-0097: append-only after Interpretation consumes. Manager corrections use '
  'shift_approval.edit_justification at the Decision layer.';
