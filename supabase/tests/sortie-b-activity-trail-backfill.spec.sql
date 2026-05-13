-- sortie-b-activity-trail-backfill.spec.sql
--
-- pgTAP coverage for 20260606121000_activity_trail_personal_task_backfill.sql
-- Verifies the idempotent DO block that flips historical
-- entity_type='personal_task_action' rows to entity_type='personal_task'.
--
-- Seed strategy:
--   - 3 activity_trail rows with entity_type='personal_task_action' that link
--     to real personal_task rows (must be updated)
--   - 1 activity_trail row with entity_type='personal_task_action' that has
--     NO matching personal_task row (orphan — must NOT be updated)
--   - 1 activity_trail row with entity_type='personal_task' (already correct —
--     must NOT be updated)
--
-- Post-backfill assertions:
--   B1: 3 linked rows now carry entity_type='personal_task'
--   B2: orphan row still carries 'personal_task_action'
--   B3: already-correct row still carries 'personal_task'
--
-- Idempotency:
--   N6: second run of backfill DO block affects 0 rows
--
-- Plan: 6 assertions
-- Run with:
--   npx supabase test db supabase/tests/sortie-b-activity-trail-backfill.spec.sql

BEGIN;
SELECT plan(6);

-- ── Fixtures ──────────────────────────────────────────────────────────────────
DO $$
DECLARE
  v_comp   UUID := gen_random_uuid();
  v_ws     UUID := gen_random_uuid();
  v_user   UUID := gen_random_uuid();
  v_prof   UUID := gen_random_uuid();

  -- 3 real personal_task ids
  v_pt1    UUID := gen_random_uuid();
  v_pt2    UUID := gen_random_uuid();
  v_pt3    UUID := gen_random_uuid();

  -- orphan: no matching personal_task row
  v_orphan UUID := gen_random_uuid();

  -- already-correct: a real personal_task id but entity_type already 'personal_task'
  v_pt_ok  UUID := gen_random_uuid();
BEGIN
  PERFORM set_config('sbf.ws',      v_ws::text,      false);
  PERFORM set_config('sbf.pt1',     v_pt1::text,     false);
  PERFORM set_config('sbf.pt2',     v_pt2::text,     false);
  PERFORM set_config('sbf.pt3',     v_pt3::text,     false);
  PERFORM set_config('sbf.orphan',  v_orphan::text,  false);
  PERFORM set_config('sbf.pt_ok',   v_pt_ok::text,   false);

  -- auth.users
  INSERT INTO auth.users (id, email, aud, role, instance_id)
  VALUES (v_user, 'sbf-backfill+' || substr(v_user::text,1,8) || '@t.test',
          'authenticated', 'authenticated', '00000000-0000-0000-0000-000000000000');

  -- company + workspace
  INSERT INTO company  (company_id,   name) VALUES (v_comp, 'SBF Backfill Co');
  INSERT INTO workspace(workspace_id, company_id, name, slug)
  VALUES (v_ws, v_comp, 'SBF WS', 'sbf-' || substr(v_ws::text,1,8));

  -- profile (needed by personal_task FK)
  INSERT INTO profile (profile_id, profile_code, user_id, workspace_id, role, is_active, display_name)
  VALUES (v_prof, 'sbf-prof-' || substr(v_prof::text,1,6), v_user, v_ws, 'employee', true, 'SBF Prof');

  -- 3 real personal_task rows
  INSERT INTO personal_task (id, profile_id, workspace_id, title, status)
  VALUES
    (v_pt1, v_prof, v_ws, 'SBF PT1', 'open'),
    (v_pt2, v_prof, v_ws, 'SBF PT2', 'open'),
    (v_pt3, v_prof, v_ws, 'SBF PT3', 'done'),
    (v_pt_ok, v_prof, v_ws, 'SBF PT OK', 'open');

  -- 3 activity_trail rows with stale entity_type (linked to real personal_task rows)
  INSERT INTO activity_trail (workspace_id, actor_id, entity_type, entity_id, event, action_verb, category)
  VALUES
    (v_ws, v_prof, 'personal_task_action', v_pt1, 'task.created',   'create',   'task'),
    (v_ws, v_prof, 'personal_task_action', v_pt2, 'task.updated',   'update',   'task'),
    (v_ws, v_prof, 'personal_task_action', v_pt3, 'task.completed', 'complete', 'task');

  -- 1 orphan: entity_id has no matching personal_task row
  INSERT INTO activity_trail (workspace_id, actor_id, entity_type, entity_id, event, action_verb, category)
  VALUES (v_ws, v_prof, 'personal_task_action', v_orphan, 'task.created', 'create', 'task');

  -- 1 already-correct row: entity_type='personal_task', real pt_ok id
  INSERT INTO activity_trail (workspace_id, actor_id, entity_type, entity_id, event, action_verb, category)
  VALUES (v_ws, v_prof, 'personal_task', v_pt_ok, 'task.created', 'create', 'task');
END $$;

-- ── Run backfill (first pass) ─────────────────────────────────────────────────
DO $$
DECLARE
  rows_updated INTEGER;
BEGIN
  UPDATE public.activity_trail
  SET    entity_type = 'personal_task'
  WHERE  entity_type = 'personal_task_action'
    AND  entity_id::text IN (SELECT id::text FROM public.personal_task);

  GET DIAGNOSTICS rows_updated = ROW_COUNT;
  RAISE NOTICE 'Sortie B backfill (test first pass): % rows updated', rows_updated;
  PERFORM set_config('sbf.first_pass_count', rows_updated::text, false);
END $$;

-- ── B1: first pass updated exactly 3 rows (the 3 linked stale rows) ───────────
SELECT is(
  current_setting('sbf.first_pass_count')::integer,
  3,
  'B1: first backfill pass updated exactly 3 linked personal_task_action rows'
);

-- ── B2+B3: verify entity_type values after first pass ────────────────────────
DO $$
DECLARE
  v_pt1      UUID := current_setting('sbf.pt1')::uuid;
  v_pt2      UUID := current_setting('sbf.pt2')::uuid;
  v_pt3      UUID := current_setting('sbf.pt3')::uuid;
  v_orphan   UUID := current_setting('sbf.orphan')::uuid;
  v_pt_ok    UUID := current_setting('sbf.pt_ok')::uuid;
  v_linked3  BIGINT;
  v_orphan_val TEXT;
  v_ok_val     TEXT;
BEGIN
  -- Count of 3 linked rows now showing 'personal_task'
  SELECT count(*) INTO v_linked3
  FROM   activity_trail
  WHERE  entity_id IN (v_pt1, v_pt2, v_pt3)
    AND  entity_type = 'personal_task';
  PERFORM set_config('sbf.b2_linked', (v_linked3 = 3)::text, false);

  -- Orphan still 'personal_task_action'
  SELECT entity_type INTO v_orphan_val FROM activity_trail WHERE entity_id = v_orphan;
  PERFORM set_config('sbf.b2_orphan', (v_orphan_val = 'personal_task_action')::text, false);

  -- Already-correct still 'personal_task'
  SELECT entity_type INTO v_ok_val FROM activity_trail WHERE entity_id = v_pt_ok AND action_verb = 'create';
  PERFORM set_config('sbf.b3_ok', (v_ok_val = 'personal_task')::text, false);
END $$;

SELECT ok(current_setting('sbf.b2_linked')::boolean, 'B2: all 3 linked stale rows flipped to entity_type=personal_task');
SELECT ok(current_setting('sbf.b2_orphan')::boolean, 'B2: orphan row (no matching personal_task) unchanged — still personal_task_action');
SELECT ok(current_setting('sbf.b3_ok')::boolean,     'B3: already-correct row (entity_type=personal_task) unchanged');

-- ── N6: idempotency — second run updates 0 rows ───────────────────────────────
DO $$
DECLARE
  rows_updated INTEGER;
BEGIN
  UPDATE public.activity_trail
  SET    entity_type = 'personal_task'
  WHERE  entity_type = 'personal_task_action'
    AND  entity_id::text IN (SELECT id::text FROM public.personal_task);

  GET DIAGNOSTICS rows_updated = ROW_COUNT;
  RAISE NOTICE 'Sortie B backfill (test second pass): % rows updated', rows_updated;
  PERFORM set_config('sbf.second_pass_count', rows_updated::text, false);
END $$;

SELECT is(
  current_setting('sbf.second_pass_count')::integer,
  0,
  'N6: second backfill pass updates 0 rows (idempotent — predicate personal_task_action exhausted)'
);

-- ── Final count sanity: linked rows carry correct type ───────────────────────
SELECT is(
  (
    SELECT count(*)::integer FROM activity_trail
    WHERE  entity_type = 'personal_task'
      AND  entity_id IN (
             current_setting('sbf.pt1')::uuid,
             current_setting('sbf.pt2')::uuid,
             current_setting('sbf.pt3')::uuid,
             current_setting('sbf.pt_ok')::uuid
           )
  ),
  4,
  'B3-sanity: all 4 personal_task-linked rows carry entity_type=personal_task after both passes'
);

SELECT * FROM finish();
ROLLBACK;
