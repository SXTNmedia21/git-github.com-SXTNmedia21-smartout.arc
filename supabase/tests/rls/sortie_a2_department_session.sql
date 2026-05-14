-- pgTAP — Sortie A.2: department_session per-verb RLS with WITH CHECK
--
-- Audit 2026-05-13 F-DB-09 (CRITICAL): department_session retained the
-- pre-ADR-0299 `FOR ALL USING(...)` jwt_manage policy with no WITH CHECK,
-- allowing a JWT caller who is a member of two workspaces to flip
-- workspace_id on UPDATE.  Sortie A.2 mirrors the Sortie A pattern from
-- 20260605120000_shift_approval_rls_with_check.sql onto this table.
--
-- Behaviour locked by this spec (independent of policy naming):
--   1. Forge boundary (per journey "Error Paths" section): the forge that
--      MUST be rejected is forge-WITHOUT-membership — caller flips
--      workspace_id to a workspace they are NOT a member of.  Same user
--      with membership in BOTH workspaces is "legitimate move" handled at
--      app layer (ADR-0151).  So this test uses a single-workspace admin
--      whose flip-target is a workspace they have NO profile in.
--   2. Happy-path UPDATE in own workspace (admin/owner) succeeds.
--   3. 4 per-verb JWT policies exist with the expected names — if T1 ships
--      different names, T4 (verifier) edits the expected ARRAY below.  The
--      *count* (4 jwt_* + service_role_* + api_key_read_* = 6 total) is the
--      load-bearing invariant; names are convention.
--
-- Fixtures: inline (matches Sortie A pattern, seed.sql untouched).
--
-- Run with: npx supabase test db
-- File:     supabase/tests/rls/sortie_a2_department_session.sql

BEGIN;
SELECT plan(3);

-- ── act_as helper: simulates a JWT-authenticated caller ──────────────────────
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
  v_company_a  UUID := gen_random_uuid();
  v_company_b  UUID := gen_random_uuid();
  v_ws_a       UUID := gen_random_uuid();
  v_ws_b       UUID := gen_random_uuid();
  v_dept_a     UUID := gen_random_uuid();
  v_dept_b     UUID := gen_random_uuid();

  -- Single-workspace admin: member of ws_a ONLY (NOT ws_b).
  -- Forge target ws_b is a workspace the caller has NO profile in.
  -- USING passes on old-row state (workspace_id=ws_a, caller is admin in A).
  -- WITH CHECK on new-row state (workspace_id=ws_b) must reject — caller
  -- is NOT a member of ws_b.  Postgres surfaces 42501.
  v_admin_user UUID := gen_random_uuid();
  v_admin_a    UUID := gen_random_uuid();

  v_session_a  UUID := gen_random_uuid();
BEGIN
  -- Stash IDs for assertion DO blocks below
  PERFORM set_config('a2ds.ws_a',       v_ws_a::text,       false);
  PERFORM set_config('a2ds.ws_b',       v_ws_b::text,       false);
  PERFORM set_config('a2ds.admin_user', v_admin_user::text, false);
  PERFORM set_config('a2ds.session_a',  v_session_a::text,  false);

  INSERT INTO auth.users (id, email, aud, role, instance_id) VALUES
    (v_admin_user, 'a2ds-admin+' || substr(v_admin_user::text, 1, 8) || '@t.test',
     'authenticated', 'authenticated', '00000000-0000-0000-0000-000000000000');

  INSERT INTO company (company_id, name) VALUES
    (v_company_a, 'A2 DS Test Co A'),
    (v_company_b, 'A2 DS Test Co B');

  INSERT INTO workspace (workspace_id, company_id, name, slug) VALUES
    (v_ws_a, v_company_a, 'A2 DS WS A', 'a2ds-a-' || substr(v_ws_a::text, 1, 8)),
    (v_ws_b, v_company_b, 'A2 DS WS B', 'a2ds-b-' || substr(v_ws_b::text, 1, 8));

  INSERT INTO department (department_id, workspace_id, name, slug) VALUES
    (v_dept_a, v_ws_a, 'A2 DS Dept A', 'a2ds-dept-a-' || substr(v_dept_a::text, 1, 6)),
    (v_dept_b, v_ws_b, 'A2 DS Dept B', 'a2ds-dept-b-' || substr(v_dept_b::text, 1, 6));

  -- Single-workspace admin: profile in ws_a only.  ws_b has no profile for
  -- this user — forge boundary is forge-WITHOUT-membership.
  INSERT INTO profile (profile_id, profile_code, user_id, workspace_id, role, is_active, display_name) VALUES
    (v_admin_a, 'a2ds-admin-a-' || substr(v_admin_a::text, 1, 6), v_admin_user, v_ws_a, 'admin', true, 'A2DS Admin in A');

  -- Row in workspace A — target of the forge attempt
  INSERT INTO department_session (department_session_id, workspace_id, department_id, session_date, status)
  VALUES (v_session_a, v_ws_a, v_dept_a, CURRENT_DATE + 1, 'upcoming');
END $fix$;

-- ═════════════════════════════════════════════════════════════════════════════
-- Test 1: forge workspace_id flip → 42501
-- ═════════════════════════════════════════════════════════════════════════════
-- Pattern: throws_ok requires the statement to raise an exception with the
-- exact sqlstate.  Postgres throws 42501 (insufficient_privilege) when a
-- WITH CHECK clause fails on UPDATE.  Single-workspace admin attempts to
-- flip workspace_id from ws_a → ws_b (a workspace they have no profile in).
-- USING passes; WITH CHECK rejects because the new workspace_id is not in
-- get_workspace_ids_for_user(auth.uid()).  Journey: attacker-forges-workspace-id-rejected.
DO $set$
BEGIN
  PERFORM pg_temp.act_as(current_setting('a2ds.admin_user')::uuid);
END $set$;

SET LOCAL ROLE authenticated;

SELECT throws_ok(
  format(
    $$UPDATE public.department_session
         SET workspace_id = %L::uuid, updated_at = now()
       WHERE department_session_id = %L::uuid$$,
    current_setting('a2ds.ws_b'),
    current_setting('a2ds.session_a')
  ),
  '42501',
  NULL,
  'forge: single-workspace admin cannot flip department_session.workspace_id to non-member workspace (WITH CHECK rejects)'
);

RESET ROLE;

-- ═════════════════════════════════════════════════════════════════════════════
-- Test 2: own-workspace UPDATE lives_ok
-- ═════════════════════════════════════════════════════════════════════════════
-- Admin updates a non-tenant column in their own workspace.  USING passes,
-- WITH CHECK passes (workspace_id unchanged).  No exception.
DO $set$
BEGIN
  PERFORM pg_temp.act_as(current_setting('a2ds.admin_user')::uuid);
END $set$;

SET LOCAL ROLE authenticated;

SELECT lives_ok(
  format(
    $$UPDATE public.department_session
         SET signoff_notes = 'sortie-a2 happy path', updated_at = now()
       WHERE department_session_id = %L::uuid$$,
    current_setting('a2ds.session_a')
  ),
  'happy: admin in workspace A can UPDATE own department_session row (per-verb UPDATE policy passes)'
);

RESET ROLE;

-- ═════════════════════════════════════════════════════════════════════════════
-- Test 3: policies_are — 4 JWT per-verb policies + service_role + api_key
-- ═════════════════════════════════════════════════════════════════════════════
-- Expected naming follows the Sortie A convention
-- (20260605120000_shift_approval_rls_with_check.sql) which DROPs the
-- old jwt_manage_* FOR ALL policy and creates 3 per-verb replacements,
-- leaving the existing jwt_read_* SELECT policy untouched:
--   jwt_read_department_session     — SELECT (preserved from original)
--   jwt_insert_department_session   — INSERT  with WITH CHECK (new)
--   jwt_update_department_session   — UPDATE  with USING + WITH CHECK (new)
--   jwt_delete_department_session   — DELETE  with USING (admin-only) (new)
--   service_role_department_session — preserved
--   api_key_read_department_session — preserved
--
-- T4 verifier — if T1 chose different policy names, edit the ARRAY below.
-- Load-bearing invariant: jwt_manage_department_session must NOT appear.
SELECT policies_are(
  'public',
  'department_session',
  ARRAY[
    'jwt_read_department_session',
    'jwt_insert_department_session',
    'jwt_update_department_session',
    'jwt_delete_department_session',
    'service_role_department_session',
    'api_key_read_department_session'
  ],
  'department_session: jwt_manage replaced by per-verb policies; service_role + api_key_read preserved (Sortie A naming convention)'
);

SELECT * FROM finish();
ROLLBACK;
