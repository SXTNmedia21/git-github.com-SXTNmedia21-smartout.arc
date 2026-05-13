-- pgTAP — Sortie A.2: deviation per-verb RLS + role gate
--
-- Audit 2026-05-13 F-DB-09 (CRITICAL) + F-DB-10 (HIGH):
--   F-DB-09 — `FOR ALL USING(...)` policy with no WITH CHECK (forge gap).
--   F-DB-10 — NO role gate at all: any workspace member can INSERT/UPDATE/
--     DELETE deviations.  Pre-A.2: an employee could fabricate or suppress
--     a deviation row (e.g. silence a "late_checkin" they want hidden).
--
-- Sortie A.2 closes both:
--   - 4 per-verb policies replace the FOR ALL.
--   - INSERT/UPDATE/DELETE gated to admin/owner/manager (role gate).
--   - SELECT remains open to any workspace member (read transparency,
--     per JOURNEY-employee-cannot-mutate-deviation §Happy Path step 1).
--
-- Behaviour locked:
--   1. Employee INSERT → 42501 (role gate rejects).
--   2. Manager INSERT in own workspace → lives_ok.
--   3. Manager UPDATE own row → lives_ok.
--   4. Single-workspace manager forge of workspace_id to non-member ws → 42501.
--   5. policies_are — 4 per-verb JWT policies + service_role + api_key_read.
--
-- Fixtures: inline.
-- Run with: npx supabase test db
-- File:     supabase/tests/rls/sortie_a2_deviation.sql

BEGIN;
SELECT plan(5);

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
  v_company_a    UUID := gen_random_uuid();
  v_company_b    UUID := gen_random_uuid();
  v_ws_a         UUID := gen_random_uuid();
  v_ws_b         UUID := gen_random_uuid();
  v_dept_a       UUID := gen_random_uuid();
  v_dept_b       UUID := gen_random_uuid();

  -- Employee in workspace A (role gate target)
  v_emp_user     UUID := gen_random_uuid();
  v_emp_a        UUID := gen_random_uuid();

  -- Manager in workspace A — happy path + forge actor (single-workspace).
  -- ws_b is a workspace this manager is NOT a member of.  Forge boundary
  -- per Sortie A.2 spec: forge-WITHOUT-membership is what RLS rejects.
  v_mgr_user     UUID := gen_random_uuid();
  v_mgr_a        UUID := gen_random_uuid();

  v_deviation_a  UUID := gen_random_uuid();
BEGIN
  PERFORM set_config('a2dv.ws_a',         v_ws_a::text,         false);
  PERFORM set_config('a2dv.ws_b',         v_ws_b::text,         false);
  PERFORM set_config('a2dv.dept_a',       v_dept_a::text,       false);
  PERFORM set_config('a2dv.emp_user',     v_emp_user::text,     false);
  PERFORM set_config('a2dv.mgr_user',     v_mgr_user::text,     false);
  PERFORM set_config('a2dv.deviation_a',  v_deviation_a::text,  false);

  INSERT INTO auth.users (id, email, aud, role, instance_id) VALUES
    (v_emp_user, 'a2dv-emp+' || substr(v_emp_user::text, 1,8) || '@t.test', 'authenticated', 'authenticated', '00000000-0000-0000-0000-000000000000'),
    (v_mgr_user, 'a2dv-mgr+' || substr(v_mgr_user::text, 1,8) || '@t.test', 'authenticated', 'authenticated', '00000000-0000-0000-0000-000000000000');

  INSERT INTO company (company_id, name) VALUES
    (v_company_a, 'A2 DV Test Co A'),
    (v_company_b, 'A2 DV Test Co B');

  INSERT INTO workspace (workspace_id, company_id, name, slug) VALUES
    (v_ws_a, v_company_a, 'A2 DV WS A', 'a2dv-a-' || substr(v_ws_a::text, 1, 8)),
    (v_ws_b, v_company_b, 'A2 DV WS B', 'a2dv-b-' || substr(v_ws_b::text, 1, 8));

  INSERT INTO department (department_id, workspace_id, name, slug) VALUES
    (v_dept_a, v_ws_a, 'A2 DV Dept A', 'a2dv-dept-a-' || substr(v_dept_a::text, 1, 6)),
    (v_dept_b, v_ws_b, 'A2 DV Dept B', 'a2dv-dept-b-' || substr(v_dept_b::text, 1, 6));

  INSERT INTO profile (profile_id, profile_code, user_id, workspace_id, role, is_active, display_name) VALUES
    (v_emp_a, 'a2dv-emp-a-' || substr(v_emp_a::text, 1,6), v_emp_user, v_ws_a, 'employee', true, 'A2DV Employee in A'),
    (v_mgr_a, 'a2dv-mgr-a-' || substr(v_mgr_a::text, 1,6), v_mgr_user, v_ws_a, 'manager',  true, 'A2DV Manager in A');

  -- Pre-existing deviation row in workspace A — UPDATE target for tests 3 + 4.
  -- Insert runs as the pgTAP-default test session role (postgres) which
  -- bypasses RLS by default — same pattern as sortie-a-shift-approval-rls.spec.sql.
  INSERT INTO deviation (
    deviation_id, workspace_id, department_id, domain, severity,
    title, status
  ) VALUES (
    v_deviation_a, v_ws_a, v_dept_a, 'safety', 'low',
    'Pre-existing deviation', 'open'
  );
END $fix$;

-- ═════════════════════════════════════════════════════════════════════════════
-- Test 1: employee INSERT → 42501 (role gate)
-- ═════════════════════════════════════════════════════════════════════════════
-- Employee in own workspace attempts to INSERT a deviation row.  USING/
-- WITH CHECK workspace predicate passes (employee is a member) — but the
-- role gate (admin/owner/manager) rejects.  Postgres surfaces 42501.
DO $set$
BEGIN
  PERFORM pg_temp.act_as(current_setting('a2dv.emp_user')::uuid);
END $set$;

SET LOCAL ROLE authenticated;

SELECT throws_ok(
  format(
    $$INSERT INTO public.deviation
        (workspace_id, department_id, domain, severity, title, status)
      VALUES (%L::uuid, %L::uuid, 'safety', 'low', 'fabricated by employee', 'open')$$,
    current_setting('a2dv.ws_a'),
    current_setting('a2dv.dept_a')
  ),
  '42501',
  NULL,
  'role-gate: employee cannot INSERT deviation (rejected by new role check)'
);

RESET ROLE;

-- ═════════════════════════════════════════════════════════════════════════════
-- Test 2: manager INSERT → lives_ok
-- ═════════════════════════════════════════════════════════════════════════════
DO $set$
BEGIN
  PERFORM pg_temp.act_as(current_setting('a2dv.mgr_user')::uuid);
END $set$;

SET LOCAL ROLE authenticated;

SELECT lives_ok(
  format(
    $$INSERT INTO public.deviation
        (workspace_id, department_id, domain, severity, title, status)
      VALUES (%L::uuid, %L::uuid, 'safety', 'low', 'reported by manager', 'open')$$,
    current_setting('a2dv.ws_a'),
    current_setting('a2dv.dept_a')
  ),
  'happy: manager in workspace A can INSERT deviation (role gate accepts)'
);

RESET ROLE;

-- ═════════════════════════════════════════════════════════════════════════════
-- Test 3: manager UPDATE own row → lives_ok
-- ═════════════════════════════════════════════════════════════════════════════
-- Manager resolves a pre-existing deviation by setting resolution_notes.
-- USING passes (workspace + role).  WITH CHECK passes (workspace_id
-- unchanged, role unchanged).  No exception.
DO $set$
BEGIN
  PERFORM pg_temp.act_as(current_setting('a2dv.mgr_user')::uuid);
END $set$;

SET LOCAL ROLE authenticated;

SELECT lives_ok(
  format(
    $$UPDATE public.deviation
         SET resolution_notes = 'manager resolved',
             status = 'resolved',
             resolved_at = now(),
             updated_at = now()
       WHERE deviation_id = %L::uuid$$,
    current_setting('a2dv.deviation_a')
  ),
  'happy: manager can UPDATE own-workspace deviation (USING + WITH CHECK pass)'
);

RESET ROLE;

-- ═════════════════════════════════════════════════════════════════════════════
-- Test 4: forge workspace_id flip → 42501 (single-workspace manager)
-- ═════════════════════════════════════════════════════════════════════════════
-- Manager in workspace A (NOT a member of ws_b) attempts UPDATE flipping
-- workspace_id from ws_a → ws_b.  USING passes (manager in ws_a); WITH
-- CHECK rejects because the new workspace_id is not in
-- get_workspace_ids_for_user(auth.uid()).  Forge-WITHOUT-membership
-- per Sortie A.2 spec (the with-membership case is the legitimate-move
-- boundary handled at app layer per ADR-0151).
DO $set$
BEGIN
  PERFORM pg_temp.act_as(current_setting('a2dv.mgr_user')::uuid);
END $set$;

SET LOCAL ROLE authenticated;

SELECT throws_ok(
  format(
    $$UPDATE public.deviation
         SET workspace_id = %L::uuid, updated_at = now()
       WHERE deviation_id = %L::uuid$$,
    current_setting('a2dv.ws_b'),
    current_setting('a2dv.deviation_a')
  ),
  '42501',
  NULL,
  'forge: single-workspace manager cannot flip deviation.workspace_id to non-member workspace (WITH CHECK rejects)'
);

RESET ROLE;

-- ═════════════════════════════════════════════════════════════════════════════
-- Test 5: policies_are
-- ═════════════════════════════════════════════════════════════════════════════
-- Pre-Sortie state: jwt_read_deviation + jwt_manage_deviation (FOR ALL,
-- no role gate) + api_key_read_deviation + service_role_deviation.
-- Sortie A.2 replaces jwt_manage_deviation with 3 per-verb policies
-- (insert/update/delete) carrying role gate; preserves jwt_read_deviation.
-- Load-bearing invariant: jwt_manage_deviation must NOT appear.
SELECT policies_are(
  'public',
  'deviation',
  ARRAY[
    'jwt_read_deviation',
    'jwt_insert_deviation',
    'jwt_update_deviation',
    'jwt_delete_deviation',
    'service_role_deviation',
    'api_key_read_deviation'
  ],
  'deviation: jwt_manage replaced by per-verb policies with role gate; service_role + api_key_read preserved (Sortie A naming convention)'
);

SELECT * FROM finish();
ROLLBACK;
