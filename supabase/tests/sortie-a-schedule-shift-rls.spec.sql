-- pgTAP regression: schedule_shift UPDATE RLS invariants (Sortie A / ADR-0299)
--
-- Locks the existing two-policy composition on schedule_shift.  No migration
-- was needed (both policies already carry WITH CHECK — spec §3.1 and §4.2).
-- This spec is the audit evidence that today's predicate holds, and ensures
-- future migrations cannot silently degrade it.
--
-- Policies under test:
--   jwt_update_schedule_shift         — admin/owner, any row in workspace
--   jwt_employee_confirm_own_shift    — employee, own rows only (employee_id = self)
-- Both carry symmetric USING + WITH CHECK.
--
-- Positive cases (must PASS RLS — rows are updated):
--   P1: admin updates any column on any row in own workspace
--   P2: employee updates confirmed_at on own row (clock-in confirm path)
--
-- Negative cases (must fail RLS — 0 rows affected or exception):
--   N1: employee tries to UPDATE a row where employee_id != self
--   N2: employee tries to flip workspace_id to a foreign workspace
--   N3: employee tries to flip employee_id to a colleague's profile_id
--   N4: non-member updates any row → reject
--
-- Run with:
--   psql "postgresql://postgres:postgres@localhost:54322/postgres" \
--        -f supabase/tests/sortie-a-schedule-shift-rls.spec.sql

BEGIN;

-- ── Fixtures ─────────────────────────────────────────────────────────────────
DO $$
DECLARE
  v_company_a       UUID := gen_random_uuid();
  v_company_b       UUID := gen_random_uuid();
  v_ws_a            UUID := gen_random_uuid();
  v_ws_b            UUID := gen_random_uuid();
  v_dept_a          UUID := gen_random_uuid();
  v_dept_b          UUID := gen_random_uuid();

  v_admin_user      UUID := gen_random_uuid();
  v_employee_user   UUID := gen_random_uuid();  -- owns v_shift_own
  v_colleague_user  UUID := gen_random_uuid();  -- owns v_shift_other
  v_outsider_user   UUID := gen_random_uuid();  -- no workspace membership

  v_admin_prof      UUID := gen_random_uuid();
  v_employee_prof   UUID := gen_random_uuid();
  v_colleague_prof  UUID := gen_random_uuid();

  v_shift_own       UUID := gen_random_uuid();  -- owned by v_employee_prof in ws_a
  v_shift_other     UUID := gen_random_uuid();  -- owned by v_colleague_prof in ws_a
BEGIN
  PERFORM set_config('ss.ws_a',           v_ws_a::text,           false);
  PERFORM set_config('ss.ws_b',           v_ws_b::text,           false);
  PERFORM set_config('ss.admin_user',     v_admin_user::text,     false);
  PERFORM set_config('ss.employee_user',  v_employee_user::text,  false);
  PERFORM set_config('ss.colleague_user', v_colleague_user::text, false);
  PERFORM set_config('ss.outsider_user',  v_outsider_user::text,  false);
  PERFORM set_config('ss.employee_prof',  v_employee_prof::text,  false);
  PERFORM set_config('ss.colleague_prof', v_colleague_prof::text, false);
  PERFORM set_config('ss.shift_own',      v_shift_own::text,      false);
  PERFORM set_config('ss.shift_other',    v_shift_other::text,    false);

  INSERT INTO auth.users (id, email, aud, role, instance_id) VALUES
    (v_admin_user,     'ss-admin+'     || substr(v_admin_user::text,     1,8) || '@t.test', 'authenticated', 'authenticated', '00000000-0000-0000-0000-000000000000'),
    (v_employee_user,  'ss-employee+'  || substr(v_employee_user::text,  1,8) || '@t.test', 'authenticated', 'authenticated', '00000000-0000-0000-0000-000000000000'),
    (v_colleague_user, 'ss-colleague+' || substr(v_colleague_user::text, 1,8) || '@t.test', 'authenticated', 'authenticated', '00000000-0000-0000-0000-000000000000'),
    (v_outsider_user,  'ss-outsider+'  || substr(v_outsider_user::text,  1,8) || '@t.test', 'authenticated', 'authenticated', '00000000-0000-0000-0000-000000000000');

  INSERT INTO company (company_id, name) VALUES
    (v_company_a, 'SS Test Co A'),
    (v_company_b, 'SS Test Co B');

  INSERT INTO workspace (workspace_id, company_id, name, slug) VALUES
    (v_ws_a, v_company_a, 'SS WS A', 'ss-a-' || substr(v_ws_a::text, 1, 8)),
    (v_ws_b, v_company_b, 'SS WS B', 'ss-b-' || substr(v_ws_b::text, 1, 8));

  INSERT INTO department (department_id, workspace_id, name, slug) VALUES
    (v_dept_a, v_ws_a, 'Kitchen A', 'kitch-ss-a-' || substr(v_dept_a::text, 1, 6)),
    (v_dept_b, v_ws_b, 'Kitchen B', 'kitch-ss-b-' || substr(v_dept_b::text, 1, 6));

  INSERT INTO profile (profile_id, profile_code, user_id, workspace_id, role, is_active, display_name) VALUES
    (v_admin_prof,     'ss-admin-'    || substr(v_admin_prof::text,    1,6), v_admin_user,     v_ws_a, 'admin',    true, 'SS Admin'),
    (v_employee_prof,  'ss-employee-' || substr(v_employee_prof::text, 1,6), v_employee_user,  v_ws_a, 'employee', true, 'SS Employee'),
    (v_colleague_prof, 'ss-colleague-'|| substr(v_colleague_prof::text,1,6), v_colleague_user, v_ws_a, 'employee', true, 'SS Colleague');

  -- Two shifts in ws_a, each owned by a different employee
  INSERT INTO schedule_shift (
    schedule_shift_id, workspace_id, department_id, employee_id,
    shift_date, role, start_time, end_time, work_hours, day_category, status, is_published
  ) VALUES
    (v_shift_own,   v_ws_a, v_dept_a, v_employee_prof,  DATE '2030-08-01',
     'cook', TIME '08:00', TIME '16:00', 8.0, 'morning'::day_category, 'published', true),
    (v_shift_other, v_ws_a, v_dept_a, v_colleague_prof, DATE '2030-08-01',
     'cook', TIME '08:00', TIME '16:00', 8.0, 'morning'::day_category, 'published', true);
END $$;

-- ── Helper: simulate JWT caller ───────────────────────────────────────────────
CREATE OR REPLACE FUNCTION pg_temp.act_as(p_user_id uuid)
RETURNS VOID LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claim.sub', p_user_id::text, true);
  PERFORM set_config('request.jwt.claims',
                     json_build_object('sub', p_user_id::text)::text, true);
END $$;

-- ── P1: admin updates any column on own-workspace row ────────────────────────
DO $$
DECLARE
  v_admin_user UUID := current_setting('ss.admin_user')::uuid;
  v_shift_own  UUID := current_setting('ss.shift_own')::uuid;
  v_rows       INT;
  v_status     TEXT;
BEGIN
  PERFORM pg_temp.act_as(v_admin_user);
  SET LOCAL ROLE authenticated;

  UPDATE schedule_shift
     SET status = 'created', updated_at = now()
   WHERE schedule_shift_id = v_shift_own;

  GET DIAGNOSTICS v_rows = ROW_COUNT;
  RESET ROLE;

  IF v_rows != 1 THEN
    RAISE EXCEPTION 'FAIL P1: admin UPDATE expected 1 row affected, got % (jwt_update_schedule_shift blocked)', v_rows;
  END IF;

  -- restore for subsequent tests
  UPDATE schedule_shift SET status = 'published' WHERE schedule_shift_id = v_shift_own;
  RAISE NOTICE 'PASS P1: admin can UPDATE any schedule_shift row in own workspace';
END $$;

-- ── P2: employee updates confirmed_at on own row ──────────────────────────────
DO $$
DECLARE
  v_employee_user UUID := current_setting('ss.employee_user')::uuid;
  v_shift_own     UUID := current_setting('ss.shift_own')::uuid;
  v_rows          INT;
  v_confirmed     TIMESTAMPTZ;
BEGIN
  PERFORM pg_temp.act_as(v_employee_user);
  SET LOCAL ROLE authenticated;

  UPDATE schedule_shift
     SET confirmed_at = now(), updated_at = now()
   WHERE schedule_shift_id = v_shift_own;

  GET DIAGNOSTICS v_rows = ROW_COUNT;
  RESET ROLE;

  IF v_rows != 1 THEN
    RAISE EXCEPTION 'FAIL P2: employee self-confirm expected 1 row, got % (jwt_employee_confirm_own_shift blocked)', v_rows;
  END IF;

  SELECT confirmed_at INTO v_confirmed FROM schedule_shift WHERE schedule_shift_id = v_shift_own;
  IF v_confirmed IS NULL THEN
    RAISE EXCEPTION 'FAIL P2: confirmed_at not written after successful UPDATE';
  END IF;

  RAISE NOTICE 'PASS P2: employee can confirm own shift (confirmed_at set)';
END $$;

-- ── N1: employee tries to UPDATE a row where employee_id != self ──────────────
DO $$
DECLARE
  v_employee_user UUID := current_setting('ss.employee_user')::uuid;
  v_shift_other   UUID := current_setting('ss.shift_other')::uuid;  -- owned by colleague
  v_rows          INT;
BEGIN
  PERFORM pg_temp.act_as(v_employee_user);
  SET LOCAL ROLE authenticated;

  UPDATE schedule_shift
     SET confirmed_at = now(), updated_at = now()
   WHERE schedule_shift_id = v_shift_other;

  GET DIAGNOSTICS v_rows = ROW_COUNT;
  RESET ROLE;

  IF v_rows != 0 THEN
    RAISE EXCEPTION 'FAIL N1: employee updating colleague shift expected 0 rows, got % (USING not enforced)', v_rows;
  END IF;
  RAISE NOTICE 'PASS N1: employee cannot UPDATE another employee''s shift (USING blocks)';
END $$;

-- ── N2: employee tries to flip workspace_id to foreign workspace ───────────────
DO $$
DECLARE
  v_employee_user UUID := current_setting('ss.employee_user')::uuid;
  v_shift_own     UUID := current_setting('ss.shift_own')::uuid;
  v_ws_b          UUID := current_setting('ss.ws_b')::uuid;
  v_rows          INT;
  v_ws_after      UUID;
BEGIN
  PERFORM pg_temp.act_as(v_employee_user);
  SET LOCAL ROLE authenticated;

  BEGIN
    UPDATE schedule_shift
       SET workspace_id = v_ws_b, updated_at = now()
     WHERE schedule_shift_id = v_shift_own;

    GET DIAGNOSTICS v_rows = ROW_COUNT;
  EXCEPTION
    WHEN others THEN
      v_rows := 0;
  END;

  RESET ROLE;

  SELECT workspace_id INTO v_ws_after FROM schedule_shift WHERE schedule_shift_id = v_shift_own;
  IF v_ws_after = v_ws_b THEN
    RAISE EXCEPTION 'FAIL N2: employee flipped workspace_id to foreign workspace — WITH CHECK not enforced on jwt_employee_confirm_own_shift';
  END IF;
  RAISE NOTICE 'PASS N2: employee cannot flip workspace_id (WITH CHECK blocks), rows_affected=%', v_rows;
END $$;

-- ── N3: employee tries to flip employee_id to colleague's profile_id ──────────
DO $$
DECLARE
  v_employee_user  UUID := current_setting('ss.employee_user')::uuid;
  v_shift_own      UUID := current_setting('ss.shift_own')::uuid;
  v_colleague_prof UUID := current_setting('ss.colleague_prof')::uuid;
  v_rows           INT;
  v_emp_after      UUID;
BEGIN
  PERFORM pg_temp.act_as(v_employee_user);
  SET LOCAL ROLE authenticated;

  BEGIN
    UPDATE schedule_shift
       SET employee_id = v_colleague_prof, updated_at = now()
     WHERE schedule_shift_id = v_shift_own;

    GET DIAGNOSTICS v_rows = ROW_COUNT;
  EXCEPTION
    WHEN others THEN
      v_rows := 0;
  END;

  RESET ROLE;

  -- After the attempted update, employee_id must still point to the original owner.
  -- jwt_employee_confirm_own_shift WITH CHECK: employee_id IN (profile WHERE user_id=auth.uid())
  -- Flipping employee_id to colleague makes WITH CHECK fail on the new value.
  SELECT employee_id INTO v_emp_after FROM schedule_shift WHERE schedule_shift_id = v_shift_own;
  IF v_emp_after = v_colleague_prof THEN
    RAISE EXCEPTION 'FAIL N3: employee_id was flipped to colleague — WITH CHECK not enforced';
  END IF;
  RAISE NOTICE 'PASS N3: employee cannot flip employee_id to colleague (WITH CHECK blocks), rows_affected=%', v_rows;
END $$;

-- ── N4: non-member updates any row → reject ────────────────────────────────────
DO $$
DECLARE
  v_outsider_user UUID := current_setting('ss.outsider_user')::uuid;
  v_shift_own     UUID := current_setting('ss.shift_own')::uuid;
  v_rows          INT;
BEGIN
  PERFORM pg_temp.act_as(v_outsider_user);
  SET LOCAL ROLE authenticated;

  UPDATE schedule_shift
     SET confirmed_at = now(), updated_at = now()
   WHERE schedule_shift_id = v_shift_own;

  GET DIAGNOSTICS v_rows = ROW_COUNT;
  RESET ROLE;

  IF v_rows != 0 THEN
    RAISE EXCEPTION 'FAIL N4: outsider UPDATE expected 0 rows, got % (non-member not blocked)', v_rows;
  END IF;
  RAISE NOTICE 'PASS N4: non-member gets 0 rows — workspace scoping holds for non-member';
END $$;

ROLLBACK;
