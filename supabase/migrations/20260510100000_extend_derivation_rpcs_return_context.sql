SET search_path TO public, extensions;

-- ============================================================
-- 20260510100000_extend_derivation_rpcs_return_context.sql
--
-- ADR-0110 (inline): Derivation RPCs must return multi-field
-- context, not just their primary UUID.
--
-- Background (Council R2 BREAK 2):
--   shift_lifecycle_v1 step 7 emits `shift.settled` with
--   payload_from_context: ['interpretation_id', 'cost_snapshot_id',
--   'session_date', 'department_id']. The upstream RPCs
--   derive_shift_hours and snapshot_shift_cost returned only a
--   scalar UUID, so session_date and department_id were NEVER
--   written to engine_state.context. The downstream consumer
--   (department_session_lifecycle step 4 match_state) then failed
--   silently because the match keys were missing.
--
-- Decision:
--   Option A — extend the RPCs to return `jsonb` including the
--   primary key AND ancillary context. Dispatcher `call_rpc`
--   handler is updated (in the companion engine-dispatch commit)
--   to merge the returned jsonb into engine_state.context instead
--   of writing a single value under output_key.
--
-- Backward compatibility:
--   The `jsonb` return includes the UUID under both the legacy
--   output_key (e.g. `interpretation_id`) AND dedicated ancillary
--   keys (`session_date`, `department_id`, `workspace_id`). The
--   shift_lifecycle_v1 seed still uses args_from_context: ['entity_id']
--   and output_key: 'interpretation_id' — the dispatcher merges
--   the whole returned object into context, so the existing seed
--   keeps working.
--
--   A legacy shim is NOT provided: direct callers that expected
--   a scalar UUID must read `.interpretation_id` / `.cost_snapshot_id`
--   from the returned jsonb. The RPCs are SECURITY DEFINER, so
--   only the Edge Function and direct SQL callers are affected —
--   neither path has external consumers yet per ADR-0095 Phase 3.
-- ============================================================

-- ──────────────────────────────────────────────
-- 1. derive_shift_hours(p_shift_id UUID) RETURNS jsonb
-- ──────────────────────────────────────────────
-- Drop the UUID-returning prior version first because PostgreSQL
-- cannot replace a function when the return type changes.
DROP FUNCTION IF EXISTS public.derive_shift_hours(UUID);

CREATE OR REPLACE FUNCTION public.derive_shift_hours(p_shift_id UUID)
RETURNS jsonb
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
  SELECT * INTO v_shift FROM public.schedule_shift
   WHERE schedule_shift_id = p_shift_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'derive_shift_hours: shift % not found', p_shift_id;
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.public_holiday
     WHERE country_code = 'NO'
       AND holiday_date = v_shift.shift_date
  ) INTO v_is_holiday;

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

    IF v_entry.breaks IS NOT NULL THEN
      FOR v_break_rec IN SELECT * FROM jsonb_array_elements(v_entry.breaks)
      LOOP
        v_break_seconds := v_break_seconds + GREATEST(0, EXTRACT(EPOCH FROM (
          (v_break_rec->>'end')::timestamptz - (v_break_rec->>'start')::timestamptz
        )));
      END LOOP;
    END IF;

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

  v_night_hours   := LEAST(v_night_hours,   v_net_hours);
  v_weekend_hours := LEAST(v_weekend_hours, v_net_hours);

  SELECT COALESCE(MAX(derivation_version), 0) + 1
    INTO v_next_version
    FROM public.shift_hour_interpretation
   WHERE shift_id = p_shift_id;

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
    now(), 'derive_shift_hours@v2'
  )
  RETURNING interpretation_id INTO v_interpretation_id;

  -- NEW in v2 (ADR-0110): return multi-field jsonb including ancillary
  -- context for the engine-dispatch call_rpc handler to merge into
  -- engine_state.context. Fixes BREAK 2: shift.settled payload was
  -- missing session_date + department_id.
  RETURN jsonb_build_object(
    'interpretation_id',       v_interpretation_id,
    'derivation_version',      v_next_version,
    'workspace_id',            v_shift.workspace_id,
    'department_id',           v_shift.department_id,
    'session_date',            v_shift.shift_date,
    'total_interpreted_hours', v_net_hours,
    'overtime_hours',          v_overtime_hours,
    'overtime_exceeds_threshold', (v_overtime_hours > 2.0)
  );
END;
$$;

COMMENT ON FUNCTION public.derive_shift_hours(UUID) IS
  'ADR-0095 Interpretation RPC. Deterministic: same time_entry + framework rules → same output. '
  'Version-bumps on each call so re-derivations are append-only. '
  'ADR-0110: returns jsonb with interpretation_id plus ancillary context '
  '(session_date, department_id, workspace_id) for engine-dispatch call_rpc '
  'context merge. overtime_exceeds_threshold gates shift_lifecycle_v1 step 5.';

GRANT EXECUTE ON FUNCTION public.derive_shift_hours(UUID) TO service_role, authenticated;

-- ──────────────────────────────────────────────
-- 2. snapshot_shift_cost(p_interpretation_id UUID) RETURNS jsonb
-- ──────────────────────────────────────────────
DROP FUNCTION IF EXISTS public.snapshot_shift_cost(UUID);

CREATE OR REPLACE FUNCTION public.snapshot_shift_cost(p_interpretation_id UUID)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_interp          public.shift_hour_interpretation%ROWTYPE;
  v_shift           public.schedule_shift%ROWTYPE;
  v_profile         public.employee_payroll_profile%ROWTYPE;
  v_base_rate       NUMERIC(10,2) := 0;
  v_night_premium   NUMERIC(10,2) := 15.65;
  v_holiday_premium NUMERIC(10,2) := 100;
  v_overtime_mult   NUMERIC(10,2) := 1.50;
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

  SELECT * INTO v_profile
    FROM public.employee_payroll_profile
   WHERE profile_id = v_shift.employee_id
     AND workspace_id = v_shift.workspace_id
     AND valid_from <= v_shift.shift_date
     AND (valid_until IS NULL OR valid_until >= v_shift.shift_date)
   ORDER BY valid_from DESC
   LIMIT 1;

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

  v_regular_cost  := ROUND(v_interp.regular_hours  * v_base_rate, 2);
  v_overtime_cost := ROUND(v_interp.overtime_hours * v_base_rate * v_overtime_mult, 2);
  v_night_cost    := ROUND(v_interp.night_hours    * v_night_premium, 2);
  v_holiday_cost  := ROUND(v_interp.holiday_hours  * v_base_rate * (v_holiday_premium / 100.0), 2);
  v_gross_cost    := v_regular_cost + v_overtime_cost + v_night_cost + v_holiday_cost;

  v_tariff_snapshot := jsonb_build_object(
    'base_rate',           v_base_rate,
    'night_premium',       v_night_premium,
    'holiday_premium',     v_holiday_premium,
    'overtime_multiplier', v_overtime_mult,
    'resolved_at',         v_shift.shift_date,
    'payroll_profile_id',  COALESCE(v_profile.id::text, null)
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

  -- ADR-0110: multi-field return. session_date + department_id flow
  -- forward into engine_state.context so the downstream emit_event
  -- step can populate shift.settled payload keys that
  -- department_session_lifecycle match_state depends on.
  RETURN jsonb_build_object(
    'cost_snapshot_id',    v_snapshot_id,
    'calculation_version', v_next_version,
    'workspace_id',        v_interp.workspace_id,
    'department_id',       v_shift.department_id,
    'session_date',        v_shift.shift_date,
    'gross_cost',          v_gross_cost
  );
END;
$$;

COMMENT ON FUNCTION public.snapshot_shift_cost(UUID) IS
  'ADR-0095 Derivation RPC. Pure function of (interpretation, payroll_profile, tariff). '
  'Append-only via calculation_version; tariff_rate_snapshot freezes inputs for reproducibility. '
  'ADR-0110: returns jsonb with cost_snapshot_id + ancillary context '
  '(session_date, department_id, workspace_id) for engine-dispatch call_rpc merge.';

GRANT EXECUTE ON FUNCTION public.snapshot_shift_cost(UUID) TO service_role, authenticated;
