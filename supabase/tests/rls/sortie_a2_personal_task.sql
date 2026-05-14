-- pgTAP — Sortie A.2: personal_task per-verb RLS with WITH CHECK
--
-- Audit 2026-05-13 F-DB-10 (HIGH): personal_task `jwt_own_personal_task`
-- is a `FOR ALL USING(...)` policy with no WITH CHECK.  Pre-A.2, a
-- profile owner could (via INSERT or UPDATE) write `workspace_id` to a
-- workspace they are NOT a member of, because the policy checks
-- `profile_id` ownership only.
--
-- Sortie A.2 mirrors Sortie A: 4 per-verb policies + symmetric WITH CHECK
-- that also asserts workspace membership.  ADR-0300 SECURITY DEFINER RPC
-- (`fn_list_my_tasks`) and ADR-0301 gated capability mutations MUST
-- continue to work — per JOURNEY-personal-task-rpc-still-works.
--
-- Behaviour locked:
--   1. Forge: profile owner can't INSERT/UPDATE workspace_id to a workspace
--      they are not a member of → 42501.
--   2. RPC readpath: assignee gets at least one row from fn_list_my_tasks().
--   3. Gated capability UPDATE (status open → done) on own task → lives_ok.
--   4. policies_are — 4 per-verb JWT policies + service_role + api_key_read.
--
-- Fixtures: inline.
-- Run with: npx supabase test db
-- File:     supabase/tests/rls/sortie_a2_personal_task.sql

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
  v_company_a   UUID := gen_random_uuid();
  v_company_b   UUID := gen_random_uuid();
  v_ws_a        UUID := gen_random_uuid();
  v_ws_b        UUID := gen_random_uuid();
  v_dept_a      UUID := gen_random_uuid();

  -- Owner of a personal_task, member of ws_a ONLY (NOT ws_b)
  v_owner_user  UUID := gen_random_uuid();
  v_owner_a     UUID := gen_random_uuid();

  v_task_a      UUID := gen_random_uuid();
BEGIN
  PERFORM set_config('a2pt.ws_a',       v_ws_a::text,       false);
  PERFORM set_config('a2pt.ws_b',       v_ws_b::text,       false);
  PERFORM set_config('a2pt.owner_user', v_owner_user::text, false);
  PERFORM set_config('a2pt.owner_a',    v_owner_a::text,    false);
  PERFORM set_config('a2pt.task_a',     v_task_a::text,     false);

  INSERT INTO auth.users (id, email, aud, role, instance_id) VALUES
    (v_owner_user, 'a2pt-owner+' || substr(v_owner_user::text, 1, 8) || '@t.test',
     'authenticated', 'authenticated', '00000000-0000-0000-0000-000000000000');

  INSERT INTO company (company_id, name) VALUES
    (v_company_a, 'A2 PT Test Co A'),
    (v_company_b, 'A2 PT Test Co B');

  INSERT INTO workspace (workspace_id, company_id, name, slug) VALUES
    (v_ws_a, v_company_a, 'A2 PT WS A', 'a2pt-a-' || substr(v_ws_a::text, 1, 8)),
    (v_ws_b, v_company_b, 'A2 PT WS B', 'a2pt-b-' || substr(v_ws_b::text, 1, 8));

  INSERT INTO department (department_id, workspace_id, name, slug) VALUES
    (v_dept_a, v_ws_a, 'A2 PT Dept A', 'a2pt-dept-a-' || substr(v_dept_a::text, 1, 6));

  -- Owner profile in ws_a ONLY — forge target ws_b is a workspace owner
  -- is NOT a member of.
  INSERT INTO profile (profile_id, profile_code, user_id, workspace_id, role, is_active, display_name) VALUES
    (v_owner_a, 'a2pt-owner-a-' || substr(v_owner_a::text, 1, 6), v_owner_user, v_ws_a, 'employee', true, 'A2PT Owner in A');

  -- Pre-existing personal_task owned by this profile in ws_a
  INSERT INTO personal_task (id, profile_id, workspace_id, title, priority, status, due_at)
  VALUES (v_task_a, v_owner_a, v_ws_a, 'A2PT pre-existing task', 'normal', 'open', now() + INTERVAL '1 hour');
END $fix$;

-- ═════════════════════════════════════════════════════════════════════════════
-- Test 1: forge workspace_id to non-member workspace → 42501
-- ═════════════════════════════════════════════════════════════════════════════
-- Owner of the task attempts UPDATE flipping workspace_id from ws_a → ws_b.
-- Owner is NOT a member of ws_b.  WITH CHECK on new-row state must enforce
-- workspace membership predicate that USING-on-old-row passed (symmetric
-- per Sortie A pattern).  Postgres surfaces 42501.
DO $set$
BEGIN
  PERFORM pg_temp.act_as(current_setting('a2pt.owner_user')::uuid);
END $set$;

SET LOCAL ROLE authenticated;

SELECT throws_ok(
  format(
    $$UPDATE public.personal_task
         SET workspace_id = %L::uuid, updated_at = now()
       WHERE id = %L::uuid$$,
    current_setting('a2pt.ws_b'),
    current_setting('a2pt.task_a')
  ),
  '42501',
  NULL,
  'forge: owner cannot flip personal_task.workspace_id to non-member workspace (WITH CHECK rejects)'
);

RESET ROLE;

-- ═════════════════════════════════════════════════════════════════════════════
-- Test 2: RPC readpath — fn_list_my_tasks returns rows for assignee
-- ═════════════════════════════════════════════════════════════════════════════
-- ADR-0300 SECURITY DEFINER RPC bypasses RLS read but self-gates via
-- caller_profiles CTE on auth.uid().  Sortie A.2 per-verb split MUST NOT
-- break this path.  Owner sets JWT, calls RPC, must see >= 1 row.
DO $set$
BEGIN
  PERFORM pg_temp.act_as(current_setting('a2pt.owner_user')::uuid);
END $set$;

-- fn_list_my_tasks is SECURITY DEFINER + granted to authenticated.
-- Set role to match the granted privilege; auth.uid() reads request.jwt.claim.sub.
SET LOCAL ROLE authenticated;

SELECT cmp_ok(
  (SELECT count(*)::int
     FROM public.fn_list_my_tasks()
    WHERE source = 'personal'
      AND id = current_setting('a2pt.task_a')::uuid),
  '=',
  1,
  'rpc: fn_list_my_tasks() returns owner''s personal_task row (ADR-0300 readpath preserved)'
);

RESET ROLE;

-- ═════════════════════════════════════════════════════════════════════════════
-- Test 3: gated capability UPDATE on own task → lives_ok
-- ═════════════════════════════════════════════════════════════════════════════
-- ADR-0301 task capability UPDATEs through gatedMutation.  In the JWT-path
-- simulation here, we exercise the per-verb UPDATE policy directly:
-- the owner marks their task done.  USING + WITH CHECK both pass.
DO $set$
BEGIN
  PERFORM pg_temp.act_as(current_setting('a2pt.owner_user')::uuid);
END $set$;

SET LOCAL ROLE authenticated;

SELECT lives_ok(
  format(
    $$UPDATE public.personal_task
         SET status = 'done', updated_at = now()
       WHERE id = %L::uuid$$,
    current_setting('a2pt.task_a')
  ),
  'capability: owner can UPDATE own personal_task status (ADR-0301 gated-mutation JWT path preserved)'
);

RESET ROLE;

-- ═════════════════════════════════════════════════════════════════════════════
-- Test 4: policies_are
-- ═════════════════════════════════════════════════════════════════════════════
-- Pre-Sortie state: jwt_own_personal_task (FOR ALL, owner-only) +
-- api_key_read_personal_task + service_role_personal_task.
-- Sortie A.2 replaces jwt_own_personal_task with 4 per-verb policies
-- (select/insert/update/delete) carrying both ownership and workspace
-- membership predicates.  Unlike the other 3 tables, personal_task has no
-- pre-existing jwt_read_* — owner-gated SELECT replaces the wildcard.
-- T4 verifier: if T1 keeps a single jwt_read_personal_task SELECT name,
-- substitute that for jwt_select_personal_task in the ARRAY.
SELECT policies_are(
  'public',
  'personal_task',
  ARRAY[
    'jwt_select_personal_task',
    'jwt_insert_personal_task',
    'jwt_update_personal_task',
    'jwt_delete_personal_task',
    'service_role_personal_task',
    'api_key_read_personal_task'
  ],
  'personal_task: jwt_own replaced by 4 per-verb policies; service_role + api_key_read preserved (Sortie A naming convention)'
);

SELECT * FROM finish();
ROLLBACK;
