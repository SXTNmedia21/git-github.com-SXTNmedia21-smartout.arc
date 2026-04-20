-- RLS / role-scoping test for v_shift_lifecycle + v_shift_lifecycle_employee.
-- Run with: psql "postgresql://postgres:postgres@localhost:54322/postgres" -f supabase/tests/rls-shift-lifecycle-view.sql
--
-- F8 (PLAN-secure-shift-lifecycle) + ADR-0077 + Council R2.
--
-- Covers:
--   1. admin role SELECTs v_shift_lifecycle → sees gross_cost.
--   2a. employee role SELECTs v_shift_lifecycle → zero rows (role gate blocks).
--   2b. employee role SELECTs v_shift_lifecycle_employee → sees row, and
--       gross_cost column does not exist in the projection.
--   3. cross-workspace admin → zero rows (workspace scoping holds).
--   4. manager role SELECTs v_shift_lifecycle → sees gross_cost.

BEGIN;

-- ── Fixtures: two workspaces, four users (admin, manager, employee, admin-in-other-ws) ─
DO $$
DECLARE
  v_company_a UUID := gen_random_uuid();
  v_company_b UUID := gen_random_uuid();
  v_ws_a      UUID := gen_random_uuid();
  v_ws_b      UUID := gen_random_uuid();
  v_dept_a    UUID := gen_random_uuid();
  v_dept_b    UUID := gen_random_uuid();

  v_admin_user    UUID := gen_random_uuid();
  v_manager_user  UUID := gen_random_uuid();
  v_employee_user UUID := gen_random_uuid();
  v_other_admin_user UUID := gen_random_uuid();

  v_admin_prof    UUID := gen_random_uuid();
  v_manager_prof  UUID := gen_random_uuid();
  v_employee_prof UUID := gen_random_uuid();
  v_other_admin_prof UUID := gen_random_uuid();

  v_shift_a UUID := gen_random_uuid();
  v_shift_b UUID := gen_random_uuid();
BEGIN
  PERFORM set_config('test.ws_a',           v_ws_a::text,           false);
  PERFORM set_config('test.ws_b',           v_ws_b::text,           false);
  PERFORM set_config('test.admin_user',     v_admin_user::text,     false);
  PERFORM set_config('test.manager_user',   v_manager_user::text,   false);
  PERFORM set_config('test.employee_user',  v_employee_user::text,  false);
  PERFORM set_config('test.other_admin_user', v_other_admin_user::text, false);
  PERFORM set_config('test.shift_a',        v_shift_a::text,        false);
  PERFORM set_config('test.shift_b',        v_shift_b::text,        false);

  -- auth.users
  INSERT INTO auth.users (id, email, aud, role, instance_id) VALUES
    (v_admin_user,       'admin+'       || v_admin_user::text       || '@t.test', 'authenticated', 'authenticated', '00000000-0000-0000-0000-000000000000'),
    (v_manager_user,     'manager+'     || v_manager_user::text     || '@t.test', 'authenticated', 'authenticated', '00000000-0000-0000-0000-000000000000'),
    (v_employee_user,    'employee+'    || v_employee_user::text    || '@t.test', 'authenticated', 'authenticated', '00000000-0000-0000-0000-000000000000'),
    (v_other_admin_user, 'other_admin+' || v_other_admin_user::text || '@t.test', 'authenticated', 'authenticated', '00000000-0000-0000-0000-000000000000');

  -- companies & workspaces
  INSERT INTO company (company_id, name) VALUES
    (v_company_a, 'PII Test Co A'),
    (v_company_b, 'PII Test Co B');

  INSERT INTO workspace (workspace_id, company_id, name, slug) VALUES
    (v_ws_a, v_company_a, 'PII WS A', 'pii-a-' || substr(v_ws_a::text, 1, 8)),
    (v_ws_b, v_company_b, 'PII WS B', 'pii-b-' || substr(v_ws_b::text, 1, 8));

  INSERT INTO department (department_id, workspace_id, name, slug) VALUES
    (v_dept_a, v_ws_a, 'Kitchen A', 'kitchen-a-' || substr(v_dept_a::text, 1, 8)),
    (v_dept_b, v_ws_b, 'Kitchen B', 'kitchen-b-' || substr(v_dept_b::text, 1, 8));

  -- profiles — admin/manager/employee in WS_A, admin in WS_B
  INSERT INTO profile (profile_id, profile_code, user_id, workspace_id, role, is_active, display_name) VALUES
    (v_admin_prof,       'pii-admin-'    || substr(v_admin_prof::text, 1, 6),       v_admin_user,       v_ws_a, 'admin',    true, 'Admin A'),
    (v_manager_prof,     'pii-manager-'  || substr(v_manager_prof::text, 1, 6),     v_manager_user,     v_ws_a, 'manager',  true, 'Manager A'),
    (v_employee_prof,    'pii-employee-' || substr(v_employee_prof::text, 1, 6),    v_employee_user,    v_ws_a, 'employee', true, 'Employee A'),
    (v_other_admin_prof, 'pii-admin-b-'  || substr(v_other_admin_prof::text, 1, 6), v_other_admin_user, v_ws_b, 'admin',    true, 'Admin B');

  -- A published shift in each workspace (so row-level RLS on schedule_shift has something to return).
  INSERT INTO schedule_shift (
    schedule_shift_id, workspace_id, department_id, employee_id,
    shift_date, role, start_time, end_time, work_hours, day_category, status, is_published
  ) VALUES
    (v_shift_a, v_ws_a, v_dept_a, v_employee_prof, DATE '2026-05-15', 'cook',
     TIME '09:00', TIME '17:00', 8.0, 'morning'::day_category, 'published', true),
    (v_shift_b, v_ws_b, v_dept_b, v_other_admin_prof, DATE '2026-05-15', 'cook',
     TIME '09:00', TIME '17:00', 8.0, 'morning'::day_category, 'published', true);

  -- A cost snapshot in each workspace so gross_cost is non-NULL for the admin view.
  -- `gross_cost` column was added in 20260506100001_shift_derivation_layer.sql
  -- (renamed from 20260506100000_* to resolve a same-timestamp collision with
  -- 20260506100000_governance_provenance.sql introduced via the strom-mcp merge).
  INSERT INTO shift_cost_snapshot (
    workspace_id, schedule_shift_id, profile_id,
    base_hours, base_rate, base_cost, supplements, overtime_cost, total_cost, gross_cost
  ) VALUES
    (v_ws_a, v_shift_a, v_employee_prof,    8.0, 220.00, 1760.00, '[]'::jsonb, 0, 1760.00, 1760.00),
    (v_ws_b, v_shift_b, v_other_admin_prof, 8.0, 250.00, 2000.00, '[]'::jsonb, 0, 2000.00, 2000.00);
END $$;

-- ── Helper: act as a given user via JWT claim + authenticated role ─
-- Sets request.jwt.claim.sub so auth.uid() returns the target user.
CREATE OR REPLACE FUNCTION pg_temp.act_as(p_user_id uuid)
RETURNS VOID LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claim.sub', p_user_id::text, true);
  PERFORM set_config('request.jwt.claims',
                     json_build_object('sub', p_user_id::text)::text, true);
END $$;

-- ── 1. admin role SELECTs v_shift_lifecycle → sees gross_cost ─────
DO $$
DECLARE
  v_admin_user UUID := current_setting('test.admin_user')::uuid;
  v_shift_a    UUID := current_setting('test.shift_a')::uuid;
  v_rows INT;
  v_gross NUMERIC;
BEGIN
  PERFORM pg_temp.act_as(v_admin_user);
  SET LOCAL ROLE authenticated;

  SELECT count(*), max(gross_cost)
    INTO v_rows, v_gross
    FROM public.v_shift_lifecycle
   WHERE shift_id = v_shift_a;

  RESET ROLE;

  IF v_rows != 1 THEN
    RAISE EXCEPTION 'FAIL 1: admin expected 1 row in v_shift_lifecycle, got %', v_rows;
  END IF;
  IF v_gross IS NULL THEN
    RAISE EXCEPTION 'FAIL 1: admin expected non-NULL gross_cost, got NULL';
  END IF;
  RAISE NOTICE 'PASS 1: admin sees v_shift_lifecycle with gross_cost=%', v_gross;
END $$;

-- ── 2a. employee SELECTs v_shift_lifecycle → zero rows ────────────
DO $$
DECLARE
  v_employee_user UUID := current_setting('test.employee_user')::uuid;
  v_shift_a       UUID := current_setting('test.shift_a')::uuid;
  v_rows INT;
BEGIN
  PERFORM pg_temp.act_as(v_employee_user);
  SET LOCAL ROLE authenticated;

  SELECT count(*) INTO v_rows
    FROM public.v_shift_lifecycle
   WHERE shift_id = v_shift_a;

  RESET ROLE;

  IF v_rows != 0 THEN
    RAISE EXCEPTION 'FAIL 2a: employee expected 0 rows in v_shift_lifecycle, got % (gross_cost leak)', v_rows;
  END IF;
  RAISE NOTICE 'PASS 2a: employee gets 0 rows from v_shift_lifecycle';
END $$;

-- ── 2b. employee SELECTs v_shift_lifecycle_employee → sees row, no gross_cost column ─
DO $$
DECLARE
  v_employee_user UUID := current_setting('test.employee_user')::uuid;
  v_shift_a       UUID := current_setting('test.shift_a')::uuid;
  v_rows INT;
  v_has_gross_cost_column BOOLEAN;
BEGIN
  -- Column absence check runs as superuser (information_schema is always readable).
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'public'
       AND table_name   = 'v_shift_lifecycle_employee'
       AND column_name  = 'gross_cost'
  ) INTO v_has_gross_cost_column;

  IF v_has_gross_cost_column THEN
    RAISE EXCEPTION 'FAIL 2b: v_shift_lifecycle_employee must NOT expose gross_cost column';
  END IF;

  PERFORM pg_temp.act_as(v_employee_user);
  SET LOCAL ROLE authenticated;

  SELECT count(*) INTO v_rows
    FROM public.v_shift_lifecycle_employee
   WHERE shift_id = v_shift_a;

  RESET ROLE;

  IF v_rows != 1 THEN
    RAISE EXCEPTION 'FAIL 2b: employee expected 1 row in v_shift_lifecycle_employee, got %', v_rows;
  END IF;
  RAISE NOTICE 'PASS 2b: employee sees v_shift_lifecycle_employee (gross_cost column absent)';
END $$;

-- ── 3. cross-workspace admin → zero rows (workspace scoping holds) ─
DO $$
DECLARE
  v_other_admin_user UUID := current_setting('test.other_admin_user')::uuid;
  v_shift_a          UUID := current_setting('test.shift_a')::uuid;
  v_rows INT;
BEGIN
  PERFORM pg_temp.act_as(v_other_admin_user);
  SET LOCAL ROLE authenticated;

  SELECT count(*) INTO v_rows
    FROM public.v_shift_lifecycle
   WHERE shift_id = v_shift_a;

  RESET ROLE;

  IF v_rows != 0 THEN
    RAISE EXCEPTION 'FAIL 3: cross-workspace admin expected 0 rows, got % (tenant leak)', v_rows;
  END IF;
  RAISE NOTICE 'PASS 3: cross-workspace admin gets 0 rows (workspace scoping intact)';
END $$;

-- ── 4. manager role → can see gross_cost (operational metric) ─────
DO $$
DECLARE
  v_manager_user UUID := current_setting('test.manager_user')::uuid;
  v_shift_a      UUID := current_setting('test.shift_a')::uuid;
  v_rows INT;
  v_gross NUMERIC;
BEGIN
  PERFORM pg_temp.act_as(v_manager_user);
  SET LOCAL ROLE authenticated;

  SELECT count(*), max(gross_cost)
    INTO v_rows, v_gross
    FROM public.v_shift_lifecycle
   WHERE shift_id = v_shift_a;

  RESET ROLE;

  IF v_rows != 1 THEN
    RAISE EXCEPTION 'FAIL 4: manager expected 1 row in v_shift_lifecycle, got %', v_rows;
  END IF;
  IF v_gross IS NULL THEN
    RAISE EXCEPTION 'FAIL 4: manager expected non-NULL gross_cost, got NULL';
  END IF;
  RAISE NOTICE 'PASS 4: manager sees v_shift_lifecycle with gross_cost=%', v_gross;
END $$;

ROLLBACK;
