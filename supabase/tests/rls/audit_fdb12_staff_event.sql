-- pgTAP — Sortie A.3 (F-DB-12): staff_event per-verb RLS + role gate
--
-- Audit 2026-05-13 F-DB-12 (CRITICAL):
--   `jwt_write_staff_event` is a `FOR ALL USING(...)` policy with no
--   WITH CHECK clause.  Pre-A.3 this means:
--     - INSERT requires USING to pass for the new row (forge possible
--       because no symmetric WITH CHECK constraint),
--     - UPDATE never re-validates the post-state — a manager can flip
--       `workspace_id` to a workspace they are NOT a member of and the
--       row escapes the source workspace.
--   In addition: F-DB-12 notes employee-tier callers can mutate the row
--   if the `jwt_write_*` filter is loosened — the existing role gate
--   lives only inside the USING EXISTS-clause, replicated naively into
--   per-verb policies would still allow forgery.  A.3 closes both gaps.
--
-- Sortie A.3 closes:
--   - 4 per-verb policies replace the FOR ALL.
--   - INSERT/UPDATE/DELETE gated to admin/owner/manager (role gate).
--   - WITH CHECK on INSERT + UPDATE re-validates workspace membership
--     so workspace_id forge is rejected at write time.
--   - SELECT remains open to any workspace member.
--
-- Behaviour locked:
--   1. policies_are — 4 per-verb JWT policies + service_role + api_key_read.
--   2. Employee-tier INSERT → 42501 (role gate rejects).
--   3. Manager INSERT own workspace → lives_ok.
--   4. Manager UPDATE forge workspace_id to non-member ws → 42501.
--
-- Naming convention follows Sortie A.2 (jwt_<verb>_<table>).  If T1's
-- migration ships different names, T5 patches the policies_are ARRAY.
--
-- Fixtures: inline.
-- Run with: npx supabase test db
-- File:     supabase/tests/rls/audit_fdb12_staff_event.sql

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
  v_company_a    UUID := gen_random_uuid();
  v_company_b    UUID := gen_random_uuid();
  v_ws_a         UUID := gen_random_uuid();
  v_ws_b         UUID := gen_random_uuid();

  -- Employee in workspace A (role gate target)
  v_emp_user     UUID := gen_random_uuid();
  v_emp_a        UUID := gen_random_uuid();

  -- Manager in workspace A — happy path + forge actor (single-workspace).
  v_mgr_user     UUID := gen_random_uuid();
  v_mgr_a        UUID := gen_random_uuid();

  v_event_a      UUID := gen_random_uuid();
BEGIN
  PERFORM set_config('a3se.ws_a',     v_ws_a::text,     false);
  PERFORM set_config('a3se.ws_b',     v_ws_b::text,     false);
  PERFORM set_config('a3se.emp_user', v_emp_user::text, false);
  PERFORM set_config('a3se.mgr_user', v_mgr_user::text, false);
  PERFORM set_config('a3se.mgr_a',    v_mgr_a::text,    false);
  PERFORM set_config('a3se.event_a',  v_event_a::text,  false);

  INSERT INTO auth.users (id, email, aud, role, instance_id) VALUES
    (v_emp_user, 'a3se-emp+' || substr(v_emp_user::text, 1, 8) || '@t.test',
     'authenticated', 'authenticated', '00000000-0000-0000-0000-000000000000'),
    (v_mgr_user, 'a3se-mgr+' || substr(v_mgr_user::text, 1, 8) || '@t.test',
     'authenticated', 'authenticated', '00000000-0000-0000-0000-000000000000');

  INSERT INTO company (company_id, name) VALUES
    (v_company_a, 'A3 SE Test Co A'),
    (v_company_b, 'A3 SE Test Co B');

  INSERT INTO workspace (workspace_id, company_id, name, slug) VALUES
    (v_ws_a, v_company_a, 'A3 SE WS A', 'a3se-a-' || substr(v_ws_a::text, 1, 8)),
    (v_ws_b, v_company_b, 'A3 SE WS B', 'a3se-b-' || substr(v_ws_b::text, 1, 8));

  INSERT INTO profile (profile_id, profile_code, user_id, workspace_id, role, is_active, display_name) VALUES
    (v_emp_a, 'a3se-emp-a-' || substr(v_emp_a::text, 1, 6), v_emp_user, v_ws_a, 'employee', true, 'A3SE Employee in A'),
    (v_mgr_a, 'a3se-mgr-a-' || substr(v_mgr_a::text, 1, 6), v_mgr_user, v_ws_a, 'manager',  true, 'A3SE Manager in A');

  -- Pre-existing staff_event row in workspace A — UPDATE target for test 4.
  -- Insert runs as the pgTAP-default test session role (postgres) which
  -- bypasses RLS by default.
  INSERT INTO staff_event (
    event_id, workspace_id, event_type, title, starts_at, ends_at, created_by
  ) VALUES (
    v_event_a, v_ws_a, 'personalmote', 'Pre-existing event',
    now() + interval '1 day', now() + interval '1 day' + interval '1 hour',
    v_mgr_a
  );
END $fix$;

-- ═════════════════════════════════════════════════════════════════════════════
-- Test 1: policies_are
-- ═════════════════════════════════════════════════════════════════════════════
-- Pre-Sortie state: jwt_read_staff_event + jwt_write_staff_event (FOR ALL,
-- no WITH CHECK) + api_key_read_staff_event.  No explicit service_role
-- policy on staff_event in the original migration.
-- Sortie A.3 replaces jwt_write_staff_event with 3 per-verb policies
-- (insert/update/delete) carrying role gate AND WITH CHECK; preserves
-- jwt_read_staff_event for SELECT.
-- Load-bearing invariant: jwt_write_staff_event must NOT appear.
-- Note: T5 may patch ARRAY if T1 ships slightly different names (e.g.
-- jwt_select_staff_event vs jwt_read_staff_event, or adds service_role).
SELECT policies_are(
  'public',
  'staff_event',
  ARRAY[
    'jwt_read_staff_event',
    'jwt_insert_staff_event',
    'jwt_update_staff_event',
    'jwt_delete_staff_event',
    'api_key_read_staff_event'
  ],
  'staff_event: jwt_write replaced by per-verb policies with role gate + WITH CHECK; jwt_read + api_key_read preserved (Sortie A naming convention)'
);

-- ═════════════════════════════════════════════════════════════════════════════
-- Test 2: employee INSERT → 42501 (role gate)
-- ═════════════════════════════════════════════════════════════════════════════
-- Employee in own workspace attempts to INSERT a staff_event row.  USING/
-- WITH CHECK workspace predicate passes (employee is a member) — but the
-- role gate (admin/owner/manager) rejects.  Postgres surfaces 42501.
DO $set$
BEGIN
  PERFORM pg_temp.act_as(current_setting('a3se.emp_user')::uuid);
END $set$;

SET LOCAL ROLE authenticated;

SELECT throws_ok(
  format(
    $$INSERT INTO public.staff_event
        (workspace_id, event_type, title, starts_at, ends_at, created_by)
      VALUES (
        %L::uuid, 'personalmote', 'fabricated by employee',
        now() + interval '2 days',
        now() + interval '2 days' + interval '1 hour',
        %L::uuid
      )$$,
    current_setting('a3se.ws_a'),
    current_setting('a3se.mgr_a')  -- created_by FK to profile — value doesn't matter, RLS rejects first
  ),
  '42501',
  NULL,
  'role-gate: employee cannot INSERT staff_event (rejected by new role check)'
);

RESET ROLE;

-- ═════════════════════════════════════════════════════════════════════════════
-- Test 3: manager INSERT own workspace → lives_ok
-- ═════════════════════════════════════════════════════════════════════════════
-- Manager creates a staff_event in their own workspace.  USING + WITH CHECK
-- pass (workspace membership + role).  No exception.
DO $set$
BEGIN
  PERFORM pg_temp.act_as(current_setting('a3se.mgr_user')::uuid);
END $set$;

SET LOCAL ROLE authenticated;

SELECT lives_ok(
  format(
    $$INSERT INTO public.staff_event
        (workspace_id, event_type, title, starts_at, ends_at, created_by)
      VALUES (
        %L::uuid, 'personalmote', 'created by manager',
        now() + interval '3 days',
        now() + interval '3 days' + interval '1 hour',
        %L::uuid
      )$$,
    current_setting('a3se.ws_a'),
    current_setting('a3se.mgr_a')
  ),
  'happy: manager in workspace A can INSERT staff_event (role gate accepts, WITH CHECK passes)'
);

RESET ROLE;

-- ═════════════════════════════════════════════════════════════════════════════
-- Test 4: forge workspace_id flip on UPDATE → 42501
-- ═════════════════════════════════════════════════════════════════════════════
-- Manager in workspace A (NOT a member of ws_b) attempts UPDATE flipping
-- workspace_id from ws_a → ws_b.  USING passes (manager in ws_a); WITH
-- CHECK rejects because the new workspace_id is not in
-- get_workspace_ids_for_user(auth.uid()).  Pre-A.3 the bare `FOR ALL`
-- policy would silently allow this — A.3 closes via symmetric WITH CHECK.
DO $set$
BEGIN
  PERFORM pg_temp.act_as(current_setting('a3se.mgr_user')::uuid);
END $set$;

SET LOCAL ROLE authenticated;

SELECT throws_ok(
  format(
    $$UPDATE public.staff_event
         SET workspace_id = %L::uuid, updated_at = now()
       WHERE event_id = %L::uuid$$,
    current_setting('a3se.ws_b'),
    current_setting('a3se.event_a')
  ),
  '42501',
  NULL,
  'forge: single-workspace manager cannot flip staff_event.workspace_id to non-member workspace (WITH CHECK rejects)'
);

RESET ROLE;

SELECT * FROM finish();
ROLLBACK;
