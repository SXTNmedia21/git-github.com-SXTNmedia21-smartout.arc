-- payroll-sync-trigger-writes-rate-columns.sql
--
-- Verify that sync_payroll_on_contract_signed() writes rate columns
-- (hourly_rate, monthly_salary, remuneration_type, currency) added in
-- 20260601000000 when a contract transitions to 'signed'.
--
-- Run with:
--   psql "postgresql://postgres:postgres@localhost:54322/postgres" \
--        -f supabase/tests/payroll-sync-trigger-writes-rate-columns.sql
--
-- Convention: plain SQL with RAISE EXCEPTION on assertion failure.
-- SAVEPOINT/ROLLBACK TO SAVEPOINT outside DO blocks (matching gate-action.sql pattern).
--
-- SMA-344 S2a — schema unblocker regression tests.

BEGIN;

-- ── Setup: seed minimal fixtures (gen_random_uuid for test isolation) ────────

DO $$
DECLARE
  v_user_id    UUID := gen_random_uuid();
  v_co_id      UUID := gen_random_uuid();
  v_ws_id      UUID := gen_random_uuid();
  v_prof_id    UUID := gen_random_uuid();
BEGIN
  PERFORM set_config('sync_test.user_id',    v_user_id::text,  false);
  PERFORM set_config('sync_test.company_id', v_co_id::text,    false);
  PERFORM set_config('sync_test.ws_id',      v_ws_id::text,    false);
  PERFORM set_config('sync_test.prof_id',    v_prof_id::text,  false);

  -- Auth user (required by user_identity FK in some paths)
  INSERT INTO auth.users (id, email, aud, role, instance_id)
  VALUES (v_user_id,
          'sync-trigger-test+' || v_user_id || '@example.test',
          'authenticated', 'authenticated',
          '00000000-0000-0000-0000-000000000000');

  -- user_identity (updated, not inserted — seeded by auth trigger)
  UPDATE public.user_identity
  SET first_name = 'Sync', last_name = 'Test'
  WHERE user_id = v_user_id;

  -- Company
  INSERT INTO public.company (company_id, name)
  VALUES (v_co_id, 'Sync Trigger Test Co');

  -- Workspace
  INSERT INTO public.workspace (workspace_id, company_id, name, slug)
  VALUES (v_ws_id, v_co_id, 'Sync Trigger Test WS',
          'sync-trigger-' || substr(v_ws_id::text, 1, 8));

  -- Profile
  INSERT INTO public.profile (profile_id, profile_code, user_id, workspace_id, role, is_active, display_name)
  VALUES (v_prof_id,
          'stest-' || substr(v_prof_id::text, 1, 8),
          v_user_id, v_ws_id,
          'employee', true, 'Sync Test Employee');

  -- employee_payroll_profile (no rate columns — trigger should fill them)
  INSERT INTO public.employee_payroll_profile (
    workspace_id, profile_id,
    salary_type, agreed_weekly_hours,
    tariff_category, seniority_start_date, valid_from
  ) VALUES (
    v_ws_id, v_prof_id,
    'hourly', 37.5,
    'standard', '2025-01-01', '2025-01-01'
  );
END $$;


-- ─────────────────────────────────────────────────────────────────────────────
-- TEST 1 — hourlyWage contract syncs hourly_rate + remuneration_type='hourly'
-- ─────────────────────────────────────────────────────────────────────────────

SAVEPOINT before_test1;

DO $$
DECLARE
  v_ws_id       UUID := current_setting('sync_test.ws_id')::UUID;
  v_prof_id     UUID := current_setting('sync_test.prof_id')::UUID;
  v_contract_id UUID := gen_random_uuid();
  v_hourly_rate   NUMERIC;
  v_remun_type    TEXT;
  v_currency      TEXT;
BEGIN
  INSERT INTO public.employment_contract (
    contract_id, workspace_id, profile_id,
    status, contract_status,
    position_title, employment_category, employment_form,
    hourly_rate, monthly_salary, remuneration_type,
    agreed_weekly_hours, start_date, employment_role
  ) VALUES (
    v_contract_id, v_ws_id, v_prof_id,
    'draft', 'draft',
    'Server', 'fast', 'permanent',
    285.50, NULL, 'hourlyWage',
    37.5, '2025-01-01', 'main'
  );

  -- Fire trigger: transition to 'signed'
  UPDATE public.employment_contract
  SET status = 'signed', signed_at = NOW()
  WHERE contract_id = v_contract_id;

  SELECT hourly_rate, remuneration_type, currency
  INTO v_hourly_rate, v_remun_type, v_currency
  FROM public.employee_payroll_profile
  WHERE profile_id = v_prof_id AND workspace_id = v_ws_id;

  IF v_hourly_rate IS DISTINCT FROM 285.50 THEN
    RAISE EXCEPTION '[TEST 1 FAIL] hourlyWage: expected hourly_rate=285.50, got %', v_hourly_rate;
  END IF;
  IF v_remun_type IS DISTINCT FROM 'hourly' THEN
    RAISE EXCEPTION '[TEST 1 FAIL] hourlyWage: expected remuneration_type=''hourly'', got %', v_remun_type;
  END IF;
  IF v_currency IS DISTINCT FROM 'NOK' THEN
    RAISE EXCEPTION '[TEST 1 FAIL] hourlyWage: expected currency=''NOK'', got %', v_currency;
  END IF;

  RAISE NOTICE '[TEST 1 PASS] hourlyWage contract: hourly_rate=% remuneration_type=% currency=%',
    v_hourly_rate, v_remun_type, v_currency;
END $$;

ROLLBACK TO SAVEPOINT before_test1;


-- ─────────────────────────────────────────────────────────────────────────────
-- TEST 2 — monthlyWage contract syncs monthly_salary + remuneration_type='monthly'
-- ─────────────────────────────────────────────────────────────────────────────

SAVEPOINT before_test2;

DO $$
DECLARE
  v_ws_id         UUID := current_setting('sync_test.ws_id')::UUID;
  v_prof_id       UUID := current_setting('sync_test.prof_id')::UUID;
  v_contract_id   UUID := gen_random_uuid();
  v_monthly_salary  NUMERIC;
  v_remun_type      TEXT;
BEGIN
  INSERT INTO public.employment_contract (
    contract_id, workspace_id, profile_id,
    status, contract_status,
    position_title, employment_category, employment_form,
    hourly_rate, monthly_salary, remuneration_type,
    agreed_weekly_hours, start_date, employment_role
  ) VALUES (
    v_contract_id, v_ws_id, v_prof_id,
    'draft', 'draft',
    'Chef de Partie', 'fast', 'permanent',
    NULL, 42000.00, 'monthlyWage',
    40.0, '2025-01-01', 'main'
  );

  UPDATE public.employment_contract
  SET status = 'signed', signed_at = NOW()
  WHERE contract_id = v_contract_id;

  SELECT monthly_salary, remuneration_type
  INTO v_monthly_salary, v_remun_type
  FROM public.employee_payroll_profile
  WHERE profile_id = v_prof_id AND workspace_id = v_ws_id;

  IF v_monthly_salary IS DISTINCT FROM 42000.00 THEN
    RAISE EXCEPTION '[TEST 2 FAIL] monthlyWage: expected monthly_salary=42000, got %', v_monthly_salary;
  END IF;
  IF v_remun_type IS DISTINCT FROM 'monthly' THEN
    RAISE EXCEPTION '[TEST 2 FAIL] monthlyWage: expected remuneration_type=''monthly'', got %', v_remun_type;
  END IF;

  RAISE NOTICE '[TEST 2 PASS] monthlyWage contract: monthly_salary=% remuneration_type=%',
    v_monthly_salary, v_remun_type;
END $$;

ROLLBACK TO SAVEPOINT before_test2;


-- ─────────────────────────────────────────────────────────────────────────────
-- TEST 3 — commissionOnly contract maps to remuneration_type='mixed'
-- ─────────────────────────────────────────────────────────────────────────────

SAVEPOINT before_test3;

DO $$
DECLARE
  v_ws_id        UUID := current_setting('sync_test.ws_id')::UUID;
  v_prof_id      UUID := current_setting('sync_test.prof_id')::UUID;
  v_contract_id  UUID := gen_random_uuid();
  v_remun_type   TEXT;
BEGIN
  INSERT INTO public.employment_contract (
    contract_id, workspace_id, profile_id,
    status, contract_status,
    position_title, employment_category, employment_form,
    hourly_rate, monthly_salary, remuneration_type,
    minimum_guaranteed_amount, agreed_weekly_hours, start_date, employment_role
  ) VALUES (
    v_contract_id, v_ws_id, v_prof_id,
    'draft', 'draft',
    'Bar Manager', 'fast', 'permanent',
    200.00, NULL, 'commissionOnly',
    15000.00, 40.0, '2025-01-01', 'main'
  );

  UPDATE public.employment_contract
  SET status = 'signed', signed_at = NOW()
  WHERE contract_id = v_contract_id;

  SELECT remuneration_type
  INTO v_remun_type
  FROM public.employee_payroll_profile
  WHERE profile_id = v_prof_id AND workspace_id = v_ws_id;

  IF v_remun_type IS DISTINCT FROM 'mixed' THEN
    RAISE EXCEPTION '[TEST 3 FAIL] commissionOnly: expected remuneration_type=''mixed'', got %', v_remun_type;
  END IF;

  RAISE NOTICE '[TEST 3 PASS] commissionOnly contract: remuneration_type=%', v_remun_type;
END $$;

ROLLBACK TO SAVEPOINT before_test3;

DO $$ BEGIN
  RAISE NOTICE 'ALL 3 TESTS PASSED: sync_payroll_on_contract_signed() writes rate columns correctly';
END $$;

ROLLBACK;
