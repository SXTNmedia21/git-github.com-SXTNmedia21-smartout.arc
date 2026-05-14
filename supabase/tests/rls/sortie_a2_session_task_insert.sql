-- pgTAP — Sortie A.2 gap closure: session_task INSERT + UPDATE WITH CHECK
--
-- ADR-0303 sister-sweep rule identified session_task INSERT gap:
-- 20260412100300_session_infrastructure.sql ships SELECT + UPDATE policies
-- but NO INSERT policy.  Any workspace member could POST a session_task row
-- directly via PostgREST without a role check.  Same USING-only gap on UPDATE.
--
-- Migration: 20260614120000_session_task_insert_with_check.sql
--
-- Behaviour locked by this spec:
--   1. Employee INSERT in own workspace → 42501 (role gate rejects).
--   2. Manager INSERT in own workspace → lives_ok.
--   3. Manager UPDATE (non-workspace_id column) → lives_ok.
--   4. policies_are: jwt_read + jwt_insert + jwt_update + service_role present.
--      jwt_manage_session_task must NOT appear.
--
-- Fixtures: inline.
-- Run with: npx supabase test db
-- File:     supabase/tests/rls/sortie_a2_session_task_insert.sql

BEGIN;
SELECT plan(4);

-- ── act_as helper ────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION pg_temp.act_as(p_user_id uuid)
RETURNS VOID LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claim.sub', p_user_id::text, true);
  PERFORM set_config('request.jwt.claims',
                     json_build_object('sub', p_user_id::text)::text, true);
END $$;

-- ── Fixtures ─────────────────────────────────────────────────────────────────
DO $fix$
DECLARE
  v_company_a     UUID := gen_random_uuid();
  v_ws_a          UUID := gen_random_uuid();
  v_dept_a        UUID := gen_random_uuid();

  -- Employee in workspace A (role gate target: should NOT be able to INSERT)
  v_emp_user      UUID := gen_random_uuid();
  v_emp_a         UUID := gen_random_uuid();

  -- Manager in workspace A (happy-path actor: should be able to INSERT)
  v_mgr_user      UUID := gen_random_uuid();
  v_mgr_a         UUID := gen_random_uuid();

  -- A department_session to satisfy the FK on session_task
  v_session_a     UUID := gen_random_uuid();

  -- A pre-existing session_task for the UPDATE test (inserted as postgres/service_role)
  v_task_a        UUID := gen_random_uuid();
BEGIN
  PERFORM set_config('a2st.ws_a',       v_ws_a::text,       false);
  PERFORM set_config('a2st.dept_a',     v_dept_a::text,     false);
  PERFORM set_config('a2st.emp_user',   v_emp_user::text,   false);
  PERFORM set_config('a2st.mgr_user',   v_mgr_user::text,   false);
  PERFORM set_config('a2st.session_a',  v_session_a::text,  false);
  PERFORM set_config('a2st.task_a',     v_task_a::text,     false);

  INSERT INTO auth.users (id, email, aud, role, instance_id) VALUES
    (v_emp_user, 'a2st-emp+' || substr(v_emp_user::text, 1,8) || '@t.test',
     'authenticated', 'authenticated', '00000000-0000-0000-0000-000000000000'),
    (v_mgr_user, 'a2st-mgr+' || substr(v_mgr_user::text, 1,8) || '@t.test',
     'authenticated', 'authenticated', '00000000-0000-0000-0000-000000000000');

  INSERT INTO company (company_id, name) VALUES
    (v_company_a, 'A2 ST Test Co A');

  INSERT INTO workspace (workspace_id, company_id, name, slug) VALUES
    (v_ws_a, v_company_a, 'A2 ST WS A', 'a2st-a-' || substr(v_ws_a::text, 1, 8));

  INSERT INTO department (department_id, workspace_id, name, slug) VALUES
    (v_dept_a, v_ws_a, 'A2 ST Dept A', 'a2st-dept-a-' || substr(v_dept_a::text, 1, 6));

  INSERT INTO profile (profile_id, profile_code, user_id, workspace_id, role, is_active, display_name) VALUES
    (v_emp_a, 'a2st-emp-a-' || substr(v_emp_a::text, 1,6), v_emp_user, v_ws_a, 'employee', true, 'A2ST Employee in A'),
    (v_mgr_a, 'a2st-mgr-a-' || substr(v_mgr_a::text, 1,6), v_mgr_user, v_ws_a, 'manager',  true, 'A2ST Manager in A');

  -- department_session row (status 'upcoming' per D6 enum)
  INSERT INTO department_session (department_session_id, workspace_id, department_id, session_date, status)
  VALUES (v_session_a, v_ws_a, v_dept_a, CURRENT_DATE + 1, 'upcoming');

  -- Pre-existing session_task (inserted by postgres bypassing RLS) — UPDATE test target
  INSERT INTO session_task (id, workspace_id, department_session_id, title, status)
  VALUES (v_task_a, v_ws_a, v_session_a, 'A2ST pre-existing task', 'pending');
END $fix$;

-- ═════════════════════════════════════════════════════════════════════════════
-- Test 1: employee INSERT → 42501 (role gate)
-- ═════════════════════════════════════════════════════════════════════════════
-- Employee is a workspace member so the workspace_id predicate passes.
-- The role gate (admin/owner/manager) rejects.  Postgres surfaces 42501.
DO $set$
BEGIN
  PERFORM pg_temp.act_as(current_setting('a2st.emp_user')::uuid);
END $set$;

SET LOCAL ROLE authenticated;

SELECT throws_ok(
  format(
    $$INSERT INTO public.session_task (workspace_id, department_session_id, title, status)
      VALUES (%L::uuid, %L::uuid, 'employee-created task', 'pending')$$,
    current_setting('a2st.ws_a'),
    current_setting('a2st.session_a')
  ),
  '42501',
  NULL,
  'role-gate: employee cannot INSERT session_task (new jwt_insert_session_task policy rejects)'
);

RESET ROLE;

-- ═════════════════════════════════════════════════════════════════════════════
-- Test 2: manager INSERT → lives_ok
-- ═════════════════════════════════════════════════════════════════════════════
-- Manager satisfies both the workspace membership predicate and the role gate.
DO $set$
BEGIN
  PERFORM pg_temp.act_as(current_setting('a2st.mgr_user')::uuid);
END $set$;

SET LOCAL ROLE authenticated;

SELECT lives_ok(
  format(
    $$INSERT INTO public.session_task (workspace_id, department_session_id, title, status)
      VALUES (%L::uuid, %L::uuid, 'manager-created task', 'pending')$$,
    current_setting('a2st.ws_a'),
    current_setting('a2st.session_a')
  ),
  'happy: manager in workspace A can INSERT session_task (role gate accepts)'
);

RESET ROLE;

-- ═════════════════════════════════════════════════════════════════════════════
-- Test 3: manager UPDATE (non-tenant column) → lives_ok
-- ═════════════════════════════════════════════════════════════════════════════
-- Validates that the re-created jwt_update_session_task (with symmetric WITH CHECK)
-- does not break the existing employee-completes-task flow.  Manager updates
-- status on pre-existing row.  USING + WITH CHECK both pass (workspace_id unchanged).
-- Note: employees also need UPDATE for task completion; this test uses manager
-- to stay consistent with fixtures.  Separate session for UPDATE test.
DO $set$
BEGIN
  PERFORM pg_temp.act_as(current_setting('a2st.mgr_user')::uuid);
END $set$;

SET LOCAL ROLE authenticated;

SELECT lives_ok(
  format(
    $$UPDATE public.session_task
         SET status = 'in_progress', updated_at = now()
       WHERE id = %L::uuid$$,
    current_setting('a2st.task_a')
  ),
  'happy: manager UPDATE session_task status (symmetric WITH CHECK passes; workspace_id unchanged)'
);

RESET ROLE;

-- ═════════════════════════════════════════════════════════════════════════════
-- Test 4: policies_are
-- ═════════════════════════════════════════════════════════════════════════════
-- Post-migration state:
--   jwt_read_session_task      — SELECT  (from origin, untouched)
--   jwt_insert_session_task    — INSERT  with manager+ role gate + WITH CHECK (new)
--   jwt_update_session_task    — UPDATE  symmetric USING + WITH CHECK (replaced)
--   service_role_session_task  — FOR ALL service_role (from origin, untouched)
-- Load-bearing invariant: NO jwt_manage_session_task should appear.
SELECT policies_are(
  'public',
  'session_task',
  ARRAY[
    'jwt_read_session_task',
    'jwt_insert_session_task',
    'jwt_update_session_task',
    'service_role_session_task'
  ],
  'session_task: INSERT policy added + UPDATE recreated with WITH CHECK; service_role + read preserved (ADR-0303 gap closure)'
);

SELECT * FROM finish();
ROLLBACK;
