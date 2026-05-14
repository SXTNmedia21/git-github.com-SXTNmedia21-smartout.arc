-- pgTAP — Sortie A.2: session_hook per-verb RLS with WITH CHECK
--
-- Audit 2026-05-13 F-DB-09 (CRITICAL): session_hook retains the same
-- pre-ADR-0299 `FOR ALL USING(...)` jwt_manage policy with no WITH CHECK.
-- Sister-table sweep mirrors Sortie A onto session_hook.
--
-- Schema note: session_hook PK column is `id` (NOT `session_hook_id`).
-- See 20260412100300_session_infrastructure.sql line 16.
--
-- Behaviour locked by this spec:
--   1. Forged workspace_id flip on UPDATE → 42501.
--   2. Happy-path UPDATE in own workspace (admin/owner) succeeds.
--   3. 4 per-verb JWT policies present (naming per convention; T4 may adjust).
--
-- Fixtures: inline.
-- Run with: npx supabase test db
-- File:     supabase/tests/rls/sortie_a2_session_hook.sql

BEGIN;
SELECT plan(3);

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
  v_company_a  UUID := gen_random_uuid();
  v_company_b  UUID := gen_random_uuid();
  v_ws_a       UUID := gen_random_uuid();
  v_ws_b       UUID := gen_random_uuid();
  v_dept_a     UUID := gen_random_uuid();
  v_dept_b     UUID := gen_random_uuid();

  -- Single-workspace admin: member of ws_a ONLY.  Forge target ws_b is a
  -- workspace the caller is NOT a member of (forge boundary per journey).
  v_admin_user UUID := gen_random_uuid();
  v_admin_a    UUID := gen_random_uuid();

  v_hook_a     UUID := gen_random_uuid();
BEGIN
  PERFORM set_config('a2sh.ws_a',       v_ws_a::text,       false);
  PERFORM set_config('a2sh.ws_b',       v_ws_b::text,       false);
  PERFORM set_config('a2sh.admin_user', v_admin_user::text, false);
  PERFORM set_config('a2sh.hook_a',     v_hook_a::text,     false);

  INSERT INTO auth.users (id, email, aud, role, instance_id) VALUES
    (v_admin_user, 'a2sh-admin+' || substr(v_admin_user::text, 1, 8) || '@t.test',
     'authenticated', 'authenticated', '00000000-0000-0000-0000-000000000000');

  INSERT INTO company (company_id, name) VALUES
    (v_company_a, 'A2 SH Test Co A'),
    (v_company_b, 'A2 SH Test Co B');

  INSERT INTO workspace (workspace_id, company_id, name, slug) VALUES
    (v_ws_a, v_company_a, 'A2 SH WS A', 'a2sh-a-' || substr(v_ws_a::text, 1, 8)),
    (v_ws_b, v_company_b, 'A2 SH WS B', 'a2sh-b-' || substr(v_ws_b::text, 1, 8));

  INSERT INTO department (department_id, workspace_id, name, slug) VALUES
    (v_dept_a, v_ws_a, 'A2 SH Dept A', 'a2sh-dept-a-' || substr(v_dept_a::text, 1, 6)),
    (v_dept_b, v_ws_b, 'A2 SH Dept B', 'a2sh-dept-b-' || substr(v_dept_b::text, 1, 6));

  INSERT INTO profile (profile_id, profile_code, user_id, workspace_id, role, is_active, display_name) VALUES
    (v_admin_a, 'a2sh-admin-a-' || substr(v_admin_a::text, 1, 6), v_admin_user, v_ws_a, 'admin', true, 'A2SH Admin in A');

  -- session_hook in workspace A
  -- hook_type values come from session_hook_type enum; 'pre_open' is canonical.
  INSERT INTO session_hook (
    id, workspace_id, department_id, hook_type, trigger_offset_min, is_active
  ) VALUES (
    v_hook_a, v_ws_a, v_dept_a, 'pre_open', -30, true
  );
END $fix$;

-- ═════════════════════════════════════════════════════════════════════════════
-- Test 1: forge workspace_id flip → 42501
-- ═════════════════════════════════════════════════════════════════════════════
DO $set$
BEGIN
  PERFORM pg_temp.act_as(current_setting('a2sh.admin_user')::uuid);
END $set$;

SET LOCAL ROLE authenticated;

SELECT throws_ok(
  format(
    $$UPDATE public.session_hook
         SET workspace_id = %L::uuid, updated_at = now()
       WHERE id = %L::uuid$$,
    current_setting('a2sh.ws_b'),
    current_setting('a2sh.hook_a')
  ),
  '42501',
  NULL,
  'forge: single-workspace admin cannot flip session_hook.workspace_id to non-member workspace (WITH CHECK rejects)'
);

RESET ROLE;

-- ═════════════════════════════════════════════════════════════════════════════
-- Test 2: own-workspace UPDATE lives_ok
-- ═════════════════════════════════════════════════════════════════════════════
DO $set$
BEGIN
  PERFORM pg_temp.act_as(current_setting('a2sh.admin_user')::uuid);
END $set$;

SET LOCAL ROLE authenticated;

SELECT lives_ok(
  format(
    $$UPDATE public.session_hook
         SET trigger_offset_min = -45, updated_at = now()
       WHERE id = %L::uuid$$,
    current_setting('a2sh.hook_a')
  ),
  'happy: admin in workspace A can UPDATE own session_hook row (per-verb UPDATE policy passes)'
);

RESET ROLE;

-- ═════════════════════════════════════════════════════════════════════════════
-- Test 3: policies_are — 4 JWT per-verb policies + service_role
-- ═════════════════════════════════════════════════════════════════════════════
-- Pre-Sortie state: jwt_read_session_hook + jwt_manage_session_hook +
-- service_role_session_hook.  No api_key_read_session_hook policy.
-- Sortie A.2 replaces jwt_manage_session_hook with 3 per-verb policies
-- (insert/update/delete), preserves jwt_read_session_hook for SELECT.
-- Load-bearing invariant: jwt_manage_session_hook must NOT appear.
SELECT policies_are(
  'public',
  'session_hook',
  ARRAY[
    'jwt_read_session_hook',
    'jwt_insert_session_hook',
    'jwt_update_session_hook',
    'jwt_delete_session_hook',
    'service_role_session_hook'
  ],
  'session_hook: jwt_manage replaced by per-verb policies; service_role preserved (Sortie A naming convention)'
);

SELECT * FROM finish();
ROLLBACK;
