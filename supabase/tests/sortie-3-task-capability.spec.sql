-- sortie-3-task-capability.spec.sql
--
-- pgTAP integration tests for ADR-0298 Sortie 3:
--   P1  Authority seed: engine_authority_config(capability='task') exists for
--       every workspace that has an active owner (migration 20260607100000).
--   P2  fn_list_my_tasks v2 returns 18 columns (Sortie B 16 + 2 new hook-link columns).
--   P3  session_task with hook (linked_procedure_id set) → hook_linked_procedure_id non-NULL.
--   N1  personal_task → hook_linked_procedure_id IS NULL (hook concept N/A for personal source).
--
-- Target: ≥ 13 assertions total (mix of P and N assertions per item).
-- Run with:
--   npx supabase test db supabase/tests/sortie-3-task-capability.spec.sql
--
-- Fixture design:
--   All fixtures are created inside the transaction and rolled back.
--   UUIDs are generated fresh per run (idempotent).
--   act_as() helper borrowed from sortie-b pattern — sets jwt.claims for auth.uid().

BEGIN;
SELECT plan(13);

-- ── act_as helper ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION pg_temp.act_as(p_user_id uuid)
RETURNS VOID LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claim.sub', p_user_id::text, true);
  PERFORM set_config('request.jwt.claims',
                     json_build_object('sub', p_user_id::text)::text, true);
END $$;

-- ── Fixture seeding ───────────────────────────────────────────────────────────
DO $$
DECLARE
  -- workspace + company
  v_comp_id   UUID := gen_random_uuid();
  v_ws_id     UUID := gen_random_uuid();
  v_dept_id   UUID := gen_random_uuid();

  -- users
  v_owner_user UUID := gen_random_uuid();
  v_emp_user   UUID := gen_random_uuid();

  -- profiles
  v_owner_prof UUID := gen_random_uuid();
  v_emp_prof   UUID := gen_random_uuid();

  -- governance chain: policy → protocol → procedure
  v_policy_id   UUID := gen_random_uuid();
  v_protocol_id UUID := gen_random_uuid();
  v_proc_id     UUID := gen_random_uuid();

  -- session + hook
  v_ds_id    UUID := gen_random_uuid();
  v_hook_id  UUID := gen_random_uuid();
BEGIN
  -- Persist IDs so assertion DO blocks can read them.
  PERFORM set_config('s3.ws_id',        v_ws_id::text,        false);
  PERFORM set_config('s3.owner_user',   v_owner_user::text,   false);
  PERFORM set_config('s3.emp_user',     v_emp_user::text,     false);
  PERFORM set_config('s3.owner_prof',   v_owner_prof::text,   false);
  PERFORM set_config('s3.emp_prof',     v_emp_prof::text,     false);
  PERFORM set_config('s3.proc_id',      v_proc_id::text,      false);
  PERFORM set_config('s3.hook_id',      v_hook_id::text,      false);

  -- auth.users
  INSERT INTO auth.users (id, email, aud, role, instance_id) VALUES
    (v_owner_user, 's3-owner+' || substr(v_owner_user::text,1,8) || '@t.test',
     'authenticated', 'authenticated', '00000000-0000-0000-0000-000000000000'),
    (v_emp_user,   's3-emp+'   || substr(v_emp_user::text,1,8)   || '@t.test',
     'authenticated', 'authenticated', '00000000-0000-0000-0000-000000000000');

  -- company + workspace
  INSERT INTO company (company_id, name) VALUES (v_comp_id, 'S3 Test Co');
  INSERT INTO workspace (workspace_id, company_id, name, slug)
    VALUES (v_ws_id, v_comp_id, 'S3 Test WS', 's3-ws-' || substr(v_ws_id::text,1,8));

  -- department
  INSERT INTO department (department_id, workspace_id, name, slug)
    VALUES (v_dept_id, v_ws_id, 'S3 Dept', 's3-dept-' || substr(v_dept_id::text,1,6));

  -- profiles: owner (triggers P1 authority seed) + employee
  INSERT INTO profile (profile_id, profile_code, user_id, workspace_id, role, is_active, display_name) VALUES
    (v_owner_prof, 's3-owner-' || substr(v_owner_prof::text,1,6),
     v_owner_user, v_ws_id, 'owner',    true, 'S3 Owner'),
    (v_emp_prof,   's3-emp-'   || substr(v_emp_prof::text,1,6),
     v_emp_user,   v_ws_id, 'employee', true, 'S3 Employee');

  -- ── Authority seed (P1) ────────────────────────────────────────────────────
  -- Re-run the migration seed INSERT for our new workspace. The migration
  -- may have already seeded workspaces that existed at migration time; we need
  -- this workspace (created now, inside the transaction) to have a row too.
  -- Using the same INSERT … ON CONFLICT DO NOTHING pattern as the migration.
  INSERT INTO engine_authority_config (workspace_id, capability, level, updated_by)
    VALUES (v_ws_id, 'task', 'suggest',
            (SELECT user_id FROM profile
             WHERE workspace_id = v_ws_id AND role = 'owner' AND is_active = true
             LIMIT 1))
    ON CONFLICT (workspace_id, capability) DO NOTHING;

  -- ── Governance chain for procedure link (P3) ───────────────────────────────
  -- policy
  INSERT INTO policy (policy_id, workspace_id, policy_type, policy_scope, name, statement,
                      enforcement_status, created_by)
    VALUES (v_policy_id, v_ws_id, 'safety'::policy_type, 'workspace'::policy_scope,
            'S3 Test Policy', 'Test policy statement.', 'enforced'::enforcement_status,
            v_owner_prof);

  -- protocol (references policy)
  INSERT INTO protocol (protocol_id, policy_id, workspace_id, name, status, owner_profile_id, created_by)
    VALUES (v_protocol_id, v_policy_id, v_ws_id, 'S3 Test Protocol',
            'active'::protocol_status, v_owner_prof, v_owner_prof);

  -- procedure (references protocol)
  INSERT INTO procedure (procedure_id, protocol_id, name, procedure_type, is_active)
    VALUES (v_proc_id, v_protocol_id, 'S3 HACCP Procedure', 'standard'::procedure_type, true);

  -- ── Session infrastructure (P3) ───────────────────────────────────────────
  -- department_session
  INSERT INTO department_session (department_session_id, workspace_id, department_id, session_date, status)
    VALUES (v_ds_id, v_ws_id, v_dept_id, CURRENT_DATE, 'upcoming'::department_session_status);

  -- session_hook WITH linked_procedure_id set
  INSERT INTO session_hook (id, workspace_id, department_id, hook_type, linked_procedure_id)
    VALUES (v_hook_id, v_ws_id, v_dept_id, 'open'::session_hook_type, v_proc_id);

  -- session_task linked to the hook (P3: must return hook_linked_procedure_id non-NULL)
  INSERT INTO session_task (workspace_id, department_session_id, session_hook_id,
                             title, status, assigned_to, is_compliance_required)
    VALUES (v_ws_id, v_ds_id, v_hook_id,
            'P3 procedure-linked task', 'pending', v_emp_prof, true);

  -- session_task WITHOUT hook (N1 mirror for session source)
  INSERT INTO session_task (workspace_id, department_session_id, session_hook_id,
                             title, status, assigned_to, is_compliance_required)
    VALUES (v_ws_id, v_ds_id, NULL,
            'P3 no-hook task', 'pending', v_emp_prof, false);

  -- personal_task for employee (N1: hook_linked_procedure_id must be NULL for personal source)
  INSERT INTO personal_task (profile_id, workspace_id, title, priority, status, due_at)
    VALUES (v_emp_prof, v_ws_id, 'N1 personal task', 'normal', 'open',
            now() + INTERVAL '1 day');

END $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- P1 — Authority seed: 'task' row exists for workspace with active owner
-- 3 assertions:
--   1. Exactly 1 task authority row for our fixture workspace.
--   2. level = 'suggest'.
--   3. updated_by IS NOT NULL (owner's user_id was populated).
-- ─────────────────────────────────────────────────────────────────────────────

DO $$
DECLARE
  v_ws_id      UUID := current_setting('s3.ws_id')::uuid;
  v_count      BIGINT;
  v_level      TEXT;
  v_updated_by UUID;
BEGIN
  SELECT count(*) INTO v_count
  FROM   engine_authority_config
  WHERE  workspace_id = v_ws_id AND capability = 'task';

  SELECT level, updated_by INTO v_level, v_updated_by
  FROM   engine_authority_config
  WHERE  workspace_id = v_ws_id AND capability = 'task'
  LIMIT  1;

  PERFORM set_config('s3.p1_count',      (v_count = 1)::text,             false);
  PERFORM set_config('s3.p1_level',      (v_level = 'suggest')::text,     false);
  PERFORM set_config('s3.p1_updated_by', (v_updated_by IS NOT NULL)::text, false);
END $$;

SELECT ok(current_setting('s3.p1_count')::boolean,
  'P1a: exactly 1 task authority row for workspace with active owner');
SELECT ok(current_setting('s3.p1_level')::boolean,
  'P1b: task authority level = suggest');
SELECT ok(current_setting('s3.p1_updated_by')::boolean,
  'P1c: task authority updated_by is populated (owner user_id)');

-- P1d: count workspaces with active owner but NO task authority row = 0
-- (migration 20260607100000 seeds all such workspaces).
-- Runs as superuser (outside SET LOCAL ROLE) so service_role bypasses RLS.
SELECT is(
  (SELECT count(*)::integer
   FROM workspace w
   WHERE EXISTS (
     SELECT 1 FROM profile p
     WHERE p.workspace_id = w.workspace_id AND p.role = 'owner' AND p.is_active = true
   )
   AND NOT EXISTS (
     SELECT 1 FROM engine_authority_config eac
     WHERE eac.workspace_id = w.workspace_id AND eac.capability = 'task'
   )
  ),
  0,
  'P1d: zero workspaces with active owner are missing task authority row (migration idempotent)'
);

-- ─────────────────────────────────────────────────────────────────────────────
-- P2 — fn_list_my_tasks v2 returns 18 output columns
-- Uses pg_proc introspection: total_args (proallargtypes) - pronargs (input params)
-- = output column count. Sortie B had 16 output; Sortie 3 adds 2 → 18.
-- Also verifies hook-link column names in pg_proc.proargnames array.
-- 3 assertions:
--   1. Output column count = 18 (= array_length(proallargtypes) - pronargs).
--   2. 'hook_linked_procedure_id' appears in proargnames.
--   3. 'hook_linked_routine_id' appears in proargnames.
-- ─────────────────────────────────────────────────────────────────────────────

DO $$
DECLARE
  v_total_args INT;
  v_pronargs   INT;
  v_argnames   TEXT[];
  v_output_cols INT;
  v_has_proc   BOOLEAN;
  v_has_rout   BOOLEAN;
BEGIN
  -- Introspect fn_list_my_tasks output columns via pg_proc.
  -- proallargtypes: all types (IN + OUT). pronargs: IN arg count.
  -- Output column count = total_args - pronargs.
  SELECT array_length(proallargtypes, 1),
         pronargs,
         proargnames
  INTO   v_total_args, v_pronargs, v_argnames
  FROM   pg_proc
  WHERE  proname = 'fn_list_my_tasks'
    AND  pronamespace = 'public'::regnamespace;

  v_output_cols := v_total_args - v_pronargs;
  v_has_proc    := 'hook_linked_procedure_id' = ANY(v_argnames);
  v_has_rout    := 'hook_linked_routine_id'   = ANY(v_argnames);

  PERFORM set_config('s3.p2_cols',     (v_output_cols = 18)::text, false);
  PERFORM set_config('s3.p2_has_proc', v_has_proc::text,            false);
  PERFORM set_config('s3.p2_has_rout', v_has_rout::text,            false);
END $$;

SELECT ok(current_setting('s3.p2_cols')::boolean,
  'P2a: fn_list_my_tasks v2 has 18 output columns (Sortie B 16 + 2 hook-link cols)');
SELECT ok(current_setting('s3.p2_has_proc')::boolean,
  'P2b: fn_list_my_tasks proargnames includes hook_linked_procedure_id');
SELECT ok(current_setting('s3.p2_has_rout')::boolean,
  'P2c: fn_list_my_tasks proargnames includes hook_linked_routine_id');

-- ─────────────────────────────────────────────────────────────────────────────
-- P3 — session_task with hook → hook_linked_procedure_id non-NULL
-- Asserts that when a session_task is linked to a session_hook that has a
-- linked_procedure_id set, fn_list_my_tasks v2 returns it non-NULL.
-- Also asserts that a session_task WITHOUT a hook returns NULL for those cols.
-- 4 assertions (2 positive, 2 negative within the session source):
--   1. Hook-linked session_task: hook_linked_procedure_id IS NOT NULL.
--   2. Hook-linked session_task: hook_linked_procedure_id = v_proc_id.
--   3. No-hook session_task: hook_linked_procedure_id IS NULL.
--   4. No-hook session_task: hook_linked_routine_id IS NULL.
-- ─────────────────────────────────────────────────────────────────────────────

DO $$
DECLARE
  v_emp_user   UUID := current_setting('s3.emp_user')::uuid;
  v_proc_id    UUID := current_setting('s3.proc_id')::uuid;
  v_linked_proc_id    UUID;
  v_linked_proc_notnull BOOLEAN;
  v_no_hook_proc_null   BOOLEAN;
  v_no_hook_rout_null   BOOLEAN;
BEGIN
  PERFORM pg_temp.act_as(v_emp_user);
  SET LOCAL ROLE authenticated;

  -- Hook-linked task: hook_linked_procedure_id must match our seeded procedure.
  SELECT hook_linked_procedure_id
  INTO   v_linked_proc_id
  FROM   fn_list_my_tasks()
  WHERE  title = 'P3 procedure-linked task' AND source = 'session';

  -- No-hook task: both link columns must be NULL.
  SELECT
    (hook_linked_procedure_id IS NULL),
    (hook_linked_routine_id IS NULL)
  INTO   v_no_hook_proc_null, v_no_hook_rout_null
  FROM   fn_list_my_tasks()
  WHERE  title = 'P3 no-hook task' AND source = 'session';

  RESET ROLE;

  PERFORM set_config('s3.p3_linked_notnull', (v_linked_proc_id IS NOT NULL)::text, false);
  PERFORM set_config('s3.p3_linked_matches',  (v_linked_proc_id = v_proc_id)::text, false);
  PERFORM set_config('s3.p3_nohook_proc',     v_no_hook_proc_null::text,            false);
  PERFORM set_config('s3.p3_nohook_rout',     v_no_hook_rout_null::text,            false);
END $$;

SELECT ok(current_setting('s3.p3_linked_notnull')::boolean,
  'P3a: session_task with hook → hook_linked_procedure_id IS NOT NULL');
SELECT ok(current_setting('s3.p3_linked_matches')::boolean,
  'P3b: hook_linked_procedure_id matches the seeded procedure UUID');
SELECT ok(current_setting('s3.p3_nohook_proc')::boolean,
  'P3c: session_task without hook → hook_linked_procedure_id IS NULL');
SELECT ok(current_setting('s3.p3_nohook_rout')::boolean,
  'P3d: session_task without hook → hook_linked_routine_id IS NULL');

-- ─────────────────────────────────────────────────────────────────────────────
-- N1 — personal_task → hook_linked_procedure_id IS NULL (source not session)
-- ADR-0298 R2: hook-link columns are ARM 1 (session) only. All other arms
-- NULL-fill both columns per the v2 migration comment.
-- 1 assertion.
-- ─────────────────────────────────────────────────────────────────────────────

DO $$
DECLARE
  v_emp_user UUID := current_setting('s3.emp_user')::uuid;
  v_proc_null BOOLEAN;
  v_rout_null BOOLEAN;
BEGIN
  PERFORM pg_temp.act_as(v_emp_user);
  SET LOCAL ROLE authenticated;

  SELECT
    (hook_linked_procedure_id IS NULL),
    (hook_linked_routine_id IS NULL)
  INTO   v_proc_null, v_rout_null
  FROM   fn_list_my_tasks()
  WHERE  title = 'N1 personal task' AND source = 'personal';

  RESET ROLE;

  PERFORM set_config('s3.n1_proc', v_proc_null::text, false);
  PERFORM set_config('s3.n1_rout', v_rout_null::text, false);
END $$;

SELECT ok(current_setting('s3.n1_proc')::boolean,
  'N1a: personal_task source → hook_linked_procedure_id IS NULL (R2 non-session null-fill)');
SELECT ok(current_setting('s3.n1_rout')::boolean,
  'N1b: personal_task source → hook_linked_routine_id IS NULL (R2 non-session null-fill)');

-- ─────────────────────────────────────────────────────────────────────────────

SELECT * FROM finish();
ROLLBACK;
