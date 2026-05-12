-- Derivation layer integration test (ADR-0095 Phase 3, ADR-0097).
-- Run with: psql "postgresql://postgres:postgres@localhost:54322/postgres" -f supabase/tests/derivation.sql
--
-- Covers:
--   1. Simple regular-hours shift (9-17, no overtime) → 8h regular.
--   2. Night-hours shift (22-06) → 7h night (all minutes 22:00-06:00 except last tick).
--   3. Overtime shift (8h scheduled, 10h worked) → 2h overtime.
--   4. Public holiday shift → holiday_hours populated.
--   5. Reproducibility: derive twice → v1 and v2 with identical outputs.
--   6. Cost snapshot: interpretation × tariff → correct gross_cost.
--   7. Reproducibility: snapshot twice → identical tariff_rate_snapshot.
--   8. Immutability: after interpretation exists, UPDATE on time_entry blocked.

BEGIN;

-- ── Setup: minimal fixtures ───────────────────
DO $$
DECLARE
  v_user_id      UUID := gen_random_uuid();
  v_company_id   UUID := gen_random_uuid();
  v_workspace_id UUID := gen_random_uuid();
  v_dept_id      UUID := gen_random_uuid();
  v_emp_id       UUID := gen_random_uuid();
  v_position_id  UUID := gen_random_uuid();
  v_tariff_id    UUID := gen_random_uuid();
BEGIN
  PERFORM set_config('test.workspace_id', v_workspace_id::text, false);
  PERFORM set_config('test.dept_id',      v_dept_id::text,      false);
  PERFORM set_config('test.emp_id',       v_emp_id::text,       false);
  PERFORM set_config('test.user_id',      v_user_id::text,      false);
  PERFORM set_config('test.tariff_id',    v_tariff_id::text,    false);

  INSERT INTO auth.users (id, email, aud, role, instance_id)
    VALUES (v_user_id, 'deriv+' || v_user_id || '@example.test',
            'authenticated', 'authenticated', '00000000-0000-0000-0000-000000000000');

  INSERT INTO company (company_id, name)
    VALUES (v_company_id, 'Derivation Test Co');

  INSERT INTO workspace (workspace_id, company_id, name, slug)
    VALUES (v_workspace_id, v_company_id, 'Derivation Test WS',
            'deriv-' || substr(v_workspace_id::text, 1, 8));

  INSERT INTO department (department_id, workspace_id, name, slug)
    VALUES (v_dept_id, v_workspace_id, 'Bar', 'bar-' || substr(v_dept_id::text, 1, 8));

  INSERT INTO profile (profile_id, profile_code, user_id, workspace_id, role, is_active, display_name)
    VALUES (v_emp_id, 'deriv-emp-' || substr(v_emp_id::text, 1, 8),
            v_user_id, v_workspace_id, 'employee', true, 'Deriv Emp');

  -- Platform-wide tariff row (workspace_id NULL) for a hospitality category.
  INSERT INTO tariff_rate_table (id, workspace_id, rate_type, source, effective_from, amount, unit, law_version)
    VALUES (v_tariff_id, NULL, 'deriv_test_hourly', 'riksavtalen', '2026-01-01', 200.00, 'kr/t', '2026');

  -- Payroll profile for the employee, valid for 2026.
  INSERT INTO employee_payroll_profile (
    workspace_id, profile_id, salary_type, agreed_weekly_hours, tariff_category,
    seniority_start_date, tariff_override_id, valid_from
  ) VALUES (
    v_workspace_id, v_emp_id, 'hourly', 37.5, 'deriv_test_hourly',
    '2020-01-01', v_tariff_id, '2026-01-01'
  );
END $$;

-- Helper: create a shift + single completed time_entry for given time-of-day window.
CREATE OR REPLACE FUNCTION pg_temp.mk_shift(
  p_date DATE, p_start TIME, p_end TIME, p_work_hours NUMERIC,
  p_punch_in TIMESTAMPTZ, p_punch_out TIMESTAMPTZ
)
RETURNS UUID
LANGUAGE plpgsql AS $$
DECLARE
  v_workspace_id UUID := current_setting('test.workspace_id')::uuid;
  v_dept_id UUID := current_setting('test.dept_id')::uuid;
  v_emp_id UUID := current_setting('test.emp_id')::uuid;
  v_shift_id UUID := gen_random_uuid();
  v_day_cat day_category;
BEGIN
  v_day_cat := CASE
    WHEN EXTRACT(DOW FROM p_date) IN (0,6) THEN 'weekend'::day_category
    WHEN EXTRACT(HOUR FROM p_start) >= 21 OR EXTRACT(HOUR FROM p_start) < 6 THEN 'night'::day_category
    WHEN EXTRACT(HOUR FROM p_start) >= 17 THEN 'evening'::day_category
    WHEN EXTRACT(HOUR FROM p_start) >= 11 THEN 'midday'::day_category
    ELSE 'morning'::day_category
  END;

  INSERT INTO schedule_shift (
    schedule_shift_id, workspace_id, department_id, employee_id,
    shift_date, role, start_time, end_time, work_hours, day_category, status
  ) VALUES (
    v_shift_id, v_workspace_id, v_dept_id, v_emp_id,
    p_date, 'bartender', p_start, p_end, p_work_hours, v_day_cat, 'completed'
  );

  INSERT INTO timesheet.time_entry (
    shift_id, profile_id, workspace_id, punch_in, punch_out, status
  ) VALUES (
    v_shift_id, v_emp_id, v_workspace_id, p_punch_in, p_punch_out, 'completed'
  );

  RETURN v_shift_id;
END $$;

-- ── 1. Regular-hours shift (Tue 2026-04-07, 09:00-17:00, no overtime) ──
DO $$
DECLARE
  v_shift_id UUID;
  v_interp_id UUID;
  v_interp shift_hour_interpretation%ROWTYPE;
BEGIN
  v_shift_id := pg_temp.mk_shift(
    DATE '2026-04-07', TIME '09:00', TIME '17:00', 8.0,
    '2026-04-07 09:00:00+02'::timestamptz, '2026-04-07 17:00:00+02'::timestamptz
  );

  v_interp_id := (public.derive_shift_hours(v_shift_id) ->> 'interpretation_id')::uuid;
  SELECT * INTO v_interp FROM shift_hour_interpretation WHERE interpretation_id = v_interp_id;

  IF v_interp.total_interpreted_hours != 8.00 THEN
    RAISE EXCEPTION 'FAIL 1: expected total=8.00, got %', v_interp.total_interpreted_hours;
  END IF;
  IF v_interp.regular_hours != 8.00 THEN
    RAISE EXCEPTION 'FAIL 1: expected regular=8.00, got %', v_interp.regular_hours;
  END IF;
  IF v_interp.overtime_hours != 0 OR v_interp.night_hours != 0 OR v_interp.holiday_hours != 0 THEN
    RAISE EXCEPTION 'FAIL 1: expected overtime/night/holiday=0, got ot=% night=% hol=%',
      v_interp.overtime_hours, v_interp.night_hours, v_interp.holiday_hours;
  END IF;
  IF array_length(v_interp.time_entry_ids, 1) != 1 THEN
    RAISE EXCEPTION 'FAIL 1: expected 1 time_entry_id in provenance, got %', v_interp.time_entry_ids;
  END IF;
  RAISE NOTICE 'PASS 1: regular-hours shift → 8h regular';

  PERFORM set_config('test.shift1_id', v_shift_id::text, false);
  PERFORM set_config('test.interp1_id', v_interp_id::text, false);
END $$;

-- ── 2. Night-hours shift (Tue 2026-04-07 22:00 → Wed 2026-04-08 06:00) ──
-- 8h total, all between 21:00-06:00 → should be 8h night hours.
DO $$
DECLARE
  v_shift_id UUID;
  v_interp_id UUID;
  v_interp shift_hour_interpretation%ROWTYPE;
BEGIN
  v_shift_id := pg_temp.mk_shift(
    DATE '2026-04-07', TIME '22:00', TIME '06:00', 8.0,
    '2026-04-07 22:00:00+02'::timestamptz, '2026-04-08 06:00:00+02'::timestamptz
  );

  v_interp_id := (public.derive_shift_hours(v_shift_id) ->> 'interpretation_id')::uuid;
  SELECT * INTO v_interp FROM shift_hour_interpretation WHERE interpretation_id = v_interp_id;

  -- generate_series stops before final tick so we expect 8.00 - 0.02 = 7.98 at worst
  -- (minute-resolution loss). We assert >= 7.90 to be robust against timezone rounding.
  IF v_interp.night_hours < 7.90 OR v_interp.night_hours > 8.00 THEN
    RAISE EXCEPTION 'FAIL 2: expected night∈[7.90, 8.00], got %', v_interp.night_hours;
  END IF;
  IF v_interp.total_interpreted_hours != 8.00 THEN
    RAISE EXCEPTION 'FAIL 2: expected total=8.00, got %', v_interp.total_interpreted_hours;
  END IF;
  RAISE NOTICE 'PASS 2: night-hours shift → night=% total=%',
    v_interp.night_hours, v_interp.total_interpreted_hours;
END $$;

-- ── 3. Overtime shift (scheduled 8h, worked 10h) ──
DO $$
DECLARE
  v_shift_id UUID;
  v_interp_id UUID;
  v_interp shift_hour_interpretation%ROWTYPE;
BEGIN
  v_shift_id := pg_temp.mk_shift(
    DATE '2026-04-08', TIME '09:00', TIME '17:00', 8.0,
    '2026-04-08 09:00:00+02'::timestamptz, '2026-04-08 19:00:00+02'::timestamptz
  );

  v_interp_id := (public.derive_shift_hours(v_shift_id) ->> 'interpretation_id')::uuid;
  SELECT * INTO v_interp FROM shift_hour_interpretation WHERE interpretation_id = v_interp_id;

  IF v_interp.regular_hours != 8.00 THEN
    RAISE EXCEPTION 'FAIL 3: expected regular=8.00, got %', v_interp.regular_hours;
  END IF;
  IF v_interp.overtime_hours != 2.00 THEN
    RAISE EXCEPTION 'FAIL 3: expected overtime=2.00, got %', v_interp.overtime_hours;
  END IF;
  IF v_interp.total_interpreted_hours != 10.00 THEN
    RAISE EXCEPTION 'FAIL 3: expected total=10.00, got %', v_interp.total_interpreted_hours;
  END IF;
  RAISE NOTICE 'PASS 3: overtime shift → regular=8, overtime=2';
END $$;

-- ── 4. Public-holiday shift (2026-05-01 is labour day in Norway) ──
DO $$
DECLARE
  v_shift_id UUID;
  v_interp_id UUID;
  v_interp shift_hour_interpretation%ROWTYPE;
  v_has_holiday BOOLEAN;
BEGIN
  SELECT EXISTS (SELECT 1 FROM public_holiday WHERE holiday_date = DATE '2026-05-01')
    INTO v_has_holiday;

  IF NOT v_has_holiday THEN
    INSERT INTO public_holiday (country_code, holiday_date, name, name_no)
      VALUES ('NO', DATE '2026-05-01', 'Labour Day', 'Arbeidernes dag')
      ON CONFLICT (country_code, holiday_date) DO NOTHING;
  END IF;

  v_shift_id := pg_temp.mk_shift(
    DATE '2026-05-01', TIME '09:00', TIME '17:00', 8.0,
    '2026-05-01 09:00:00+02'::timestamptz, '2026-05-01 17:00:00+02'::timestamptz
  );

  v_interp_id := (public.derive_shift_hours(v_shift_id) ->> 'interpretation_id')::uuid;
  SELECT * INTO v_interp FROM shift_hour_interpretation WHERE interpretation_id = v_interp_id;

  IF v_interp.holiday_hours != 8.00 THEN
    RAISE EXCEPTION 'FAIL 4: expected holiday_hours=8.00, got %', v_interp.holiday_hours;
  END IF;
  RAISE NOTICE 'PASS 4: public-holiday shift → holiday=8h';
END $$;

-- ── 5. Reproducibility of derive_shift_hours ──
-- Re-derive shift 1: v2 must hold identical output numbers to v1.
DO $$
DECLARE
  v_shift_id UUID := current_setting('test.shift1_id')::uuid;
  v_interp1_id UUID := current_setting('test.interp1_id')::uuid;
  v_interp2_id UUID;
  v1 shift_hour_interpretation%ROWTYPE;
  v2 shift_hour_interpretation%ROWTYPE;
BEGIN
  v_interp2_id := (public.derive_shift_hours(v_shift_id) ->> 'interpretation_id')::uuid;

  SELECT * INTO v1 FROM shift_hour_interpretation WHERE interpretation_id = v_interp1_id;
  SELECT * INTO v2 FROM shift_hour_interpretation WHERE interpretation_id = v_interp2_id;

  IF v1.derivation_version != 1 OR v2.derivation_version != 2 THEN
    RAISE EXCEPTION 'FAIL 5: expected versions 1 and 2, got % and %',
      v1.derivation_version, v2.derivation_version;
  END IF;
  IF v1.total_interpreted_hours != v2.total_interpreted_hours
     OR v1.regular_hours != v2.regular_hours
     OR v1.overtime_hours != v2.overtime_hours
     OR v1.night_hours != v2.night_hours
     OR v1.holiday_hours != v2.holiday_hours
     OR v1.break_deductions != v2.break_deductions THEN
    RAISE EXCEPTION 'FAIL 5: reproducibility violated — v1=% vs v2=%',
      row_to_json(v1), row_to_json(v2);
  END IF;
  RAISE NOTICE 'PASS 5: reproducibility — v1 and v2 identical';
END $$;

-- ── 6. Cost snapshot: gross_cost = regular_hours × hourly_rate (200kr) = 1600kr ──
DO $$
DECLARE
  v_interp_id UUID := current_setting('test.interp1_id')::uuid;
  v_snap_id UUID;
  v_snap shift_cost_snapshot%ROWTYPE;
BEGIN
  v_snap_id := (public.snapshot_shift_cost(v_interp_id) ->> 'cost_snapshot_id')::uuid;
  SELECT * INTO v_snap FROM shift_cost_snapshot WHERE id = v_snap_id;

  -- 8h × 200kr = 1600kr regular. No overtime/night/holiday. Gross = 1600.
  IF v_snap.regular_cost != 1600.00 THEN
    RAISE EXCEPTION 'FAIL 6: expected regular_cost=1600, got %', v_snap.regular_cost;
  END IF;
  IF v_snap.gross_cost != 1600.00 THEN
    RAISE EXCEPTION 'FAIL 6: expected gross_cost=1600, got %', v_snap.gross_cost;
  END IF;
  IF v_snap.interpretation_id != v_interp_id THEN
    RAISE EXCEPTION 'FAIL 6: interpretation_id FK wrong';
  END IF;
  IF (v_snap.tariff_rate_snapshot->>'base_rate')::numeric != 200.00 THEN
    RAISE EXCEPTION 'FAIL 6: tariff snapshot missing base_rate=200, got %', v_snap.tariff_rate_snapshot;
  END IF;
  RAISE NOTICE 'PASS 6: cost snapshot → regular=1600, gross=1600';

  PERFORM set_config('test.snap1_id', v_snap_id::text, false);
END $$;

-- ── 7. Cost snapshot reproducibility ──
DO $$
DECLARE
  v_interp_id UUID := current_setting('test.interp1_id')::uuid;
  v_snap1_id UUID := current_setting('test.snap1_id')::uuid;
  v_snap2_id UUID;
  s1 shift_cost_snapshot%ROWTYPE;
  s2 shift_cost_snapshot%ROWTYPE;
BEGIN
  v_snap2_id := (public.snapshot_shift_cost(v_interp_id) ->> 'cost_snapshot_id')::uuid;
  SELECT * INTO s1 FROM shift_cost_snapshot WHERE id = v_snap1_id;
  SELECT * INTO s2 FROM shift_cost_snapshot WHERE id = v_snap2_id;

  IF s1.calculation_version >= s2.calculation_version THEN
    RAISE EXCEPTION 'FAIL 7: expected v2 > v1, got v1=% v2=%',
      s1.calculation_version, s2.calculation_version;
  END IF;
  IF s1.tariff_rate_snapshot::text != s2.tariff_rate_snapshot::text THEN
    RAISE EXCEPTION 'FAIL 7: tariff_rate_snapshot differs between versions — not reproducible';
  END IF;
  IF s1.gross_cost != s2.gross_cost THEN
    RAISE EXCEPTION 'FAIL 7: gross_cost differs v1=% v2=%', s1.gross_cost, s2.gross_cost;
  END IF;
  RAISE NOTICE 'PASS 7: snapshot reproducibility — tariff + cost identical across versions';
END $$;

-- ── 8. time_entry immutability after Interpretation consumes ──
-- With service_role bypass disabled via SET ROLE, an UPDATE must fail.
DO $$
DECLARE
  v_shift_id UUID := current_setting('test.shift1_id')::uuid;
  v_rows INT;
  v_user_id UUID := current_setting('test.user_id')::uuid;
BEGIN
  -- Pretend to be the authenticated user that owns the profile.
  PERFORM set_config('request.jwt.claim.sub', v_user_id::text, true);
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_user_id::text)::text, true);
  SET LOCAL ROLE authenticated;

  -- Attempt UPDATE — RLS should match 0 rows because the interpretation consumed the entry.
  UPDATE timesheet.time_entry
     SET punch_out = punch_out + INTERVAL '10 minutes'
   WHERE shift_id = v_shift_id;

  GET DIAGNOSTICS v_rows = ROW_COUNT;
  RESET ROLE;

  IF v_rows != 0 THEN
    RAISE EXCEPTION 'FAIL 8: expected 0 rows updated after Interpretation consumes, got %', v_rows;
  END IF;
  RAISE NOTICE 'PASS 8: time_entry UPDATE blocked after Interpretation consumes';
END $$;

ROLLBACK;
