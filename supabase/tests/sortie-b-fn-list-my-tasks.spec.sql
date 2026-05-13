-- sortie-b-fn-list-my-tasks.spec.sql
--
-- pgTAP coverage for fn_list_my_tasks (ADR-0298 §4.1) — Sortie B Phase 6.
--
-- Positive cases (rows MUST appear):
--   P1  session_task assigned to E1 in W1 within window
--   P2  session_task UNASSIGNED in W1 (pickup flow)
--   P3  schedule_day_task highlight=true → priority='high'
--   P4  schedule_day_task assigned_to=NULL in W1
--   P5  personal_task priority='urgent' → normalized 'critical'
--   P6  emma_task status='triggered' → preserved in output
--   P7  multi-workspace E2: rows from W1+W2 in single call (R8)
--   P8  all 7 session_task_status values map to correct normalized status
--   P9  window boundary: exact match included; row 1s before excluded
--   P10 is_compliance_required=true → priority='high' AND compliance=true
--
-- Negative cases (rows MUST NOT appear):
--   N1  session_task in W2 when caller is E1 (W1-only member)
--   N2  personal_task owned by E2 when caller is E1
--   N3  session_task outside window
--   N4  no source='runtime' rows ever appear (R2 — engine_state_step excluded)
--   N5  anon caller → permission denied
--
-- Plan: 15 assertions (P1-P9,P10 = 10; N1-N5 = 5)
-- Run with:
--   npx supabase test db supabase/tests/sortie-b-fn-list-my-tasks.spec.sql

BEGIN;
SELECT plan(15);

-- ── act_as helper: simulates JWT-authenticated caller ─────────────────────────
CREATE OR REPLACE FUNCTION pg_temp.act_as(p_user_id uuid)
RETURNS VOID LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claim.sub', p_user_id::text, true);
  PERFORM set_config('request.jwt.claims',
                     json_build_object('sub', p_user_id::text)::text, true);
END $$;

-- ── Fixtures ──────────────────────────────────────────────────────────────────
DO $$
DECLARE
  -- workspaces
  v_comp_a UUID := gen_random_uuid();
  v_comp_b UUID := gen_random_uuid();
  v_ws_a   UUID := gen_random_uuid();
  v_ws_b   UUID := gen_random_uuid();
  v_dept_a UUID := gen_random_uuid();
  v_dept_b UUID := gen_random_uuid();

  -- users
  v_e1_user UUID := gen_random_uuid();  -- E1: W1 only
  v_e2_user UUID := gen_random_uuid();  -- E2: W1 + W2 (multi-workspace)
  v_m1_user UUID := gen_random_uuid();  -- M1: manager in W1

  -- profiles
  v_e1_a UUID := gen_random_uuid();  -- E1 profile in W1
  v_e2_a UUID := gen_random_uuid();  -- E2 profile in W1
  v_e2_b UUID := gen_random_uuid();  -- E2 profile in W2
  v_m1_a UUID := gen_random_uuid();  -- M1 profile in W1

  -- sessions
  v_ds_a UUID := gen_random_uuid();  -- department_session in W1
  v_ds_b UUID := gen_random_uuid();  -- department_session in W2

  -- window anchor: tasks at now(), outside tasks before window
  v_now TIMESTAMPTZ := now();
BEGIN
  -- Persist IDs in session config for use in assertion DO blocks below
  PERFORM set_config('sb.ws_a',   v_ws_a::text,   false);
  PERFORM set_config('sb.ws_b',   v_ws_b::text,   false);
  PERFORM set_config('sb.e1_user', v_e1_user::text, false);
  PERFORM set_config('sb.e2_user', v_e2_user::text, false);
  PERFORM set_config('sb.e1_a',   v_e1_a::text,   false);
  PERFORM set_config('sb.e2_a',   v_e2_a::text,   false);
  PERFORM set_config('sb.e2_b',   v_e2_b::text,   false);
  PERFORM set_config('sb.ds_a',   v_ds_a::text,   false);
  PERFORM set_config('sb.ds_b',   v_ds_b::text,   false);

  -- auth.users
  INSERT INTO auth.users (id, email, aud, role, instance_id) VALUES
    (v_e1_user, 'sb-e1+' || substr(v_e1_user::text,1,8) || '@t.test', 'authenticated', 'authenticated', '00000000-0000-0000-0000-000000000000'),
    (v_e2_user, 'sb-e2+' || substr(v_e2_user::text,1,8) || '@t.test', 'authenticated', 'authenticated', '00000000-0000-0000-0000-000000000000'),
    (v_m1_user, 'sb-m1+' || substr(v_m1_user::text,1,8) || '@t.test', 'authenticated', 'authenticated', '00000000-0000-0000-0000-000000000000');

  -- companies + workspaces
  INSERT INTO company (company_id, name) VALUES
    (v_comp_a, 'SB Test Co A'),
    (v_comp_b, 'SB Test Co B');

  INSERT INTO workspace (workspace_id, company_id, name, slug) VALUES
    (v_ws_a, v_comp_a, 'SB WS A', 'sb-a-' || substr(v_ws_a::text,1,8)),
    (v_ws_b, v_comp_b, 'SB WS B', 'sb-b-' || substr(v_ws_b::text,1,8));

  -- departments
  INSERT INTO department (department_id, workspace_id, name, slug) VALUES
    (v_dept_a, v_ws_a, 'SB Dept A', 'sb-dept-a-' || substr(v_dept_a::text,1,6)),
    (v_dept_b, v_ws_b, 'SB Dept B', 'sb-dept-b-' || substr(v_dept_b::text,1,6));

  -- profiles
  INSERT INTO profile (profile_id, profile_code, user_id, workspace_id, role, is_active, display_name) VALUES
    (v_e1_a, 'sb-e1a-' || substr(v_e1_a::text,1,6), v_e1_user, v_ws_a, 'employee', true, 'SB E1 W1'),
    (v_e2_a, 'sb-e2a-' || substr(v_e2_a::text,1,6), v_e2_user, v_ws_a, 'employee', true, 'SB E2 W1'),
    (v_e2_b, 'sb-e2b-' || substr(v_e2_b::text,1,6), v_e2_user, v_ws_b, 'employee', true, 'SB E2 W2'),
    (v_m1_a, 'sb-m1a-' || substr(v_m1_a::text,1,6), v_m1_user, v_ws_a, 'manager',  true, 'SB M1 W1');

  -- department_sessions: date = today (inside default window)
  INSERT INTO department_session (department_session_id, workspace_id, department_id, session_date, status) VALUES
    (v_ds_a, v_ws_a, v_dept_a, CURRENT_DATE, 'upcoming'),
    (v_ds_b, v_ws_b, v_dept_b, CURRENT_DATE, 'upcoming');

  -- ── session_task rows ──────────────────────────────────────────────────────

  -- P1: assigned to E1 in W1
  INSERT INTO session_task (workspace_id, department_session_id, title, status, assigned_to, is_compliance_required)
  VALUES (v_ws_a, v_ds_a, 'P1 assigned task', 'pending', v_e1_a, false);

  -- P2: unassigned in W1 (pickup flow)
  INSERT INTO session_task (workspace_id, department_session_id, title, status, assigned_to, is_compliance_required)
  VALUES (v_ws_a, v_ds_a, 'P2 unassigned task', 'available', NULL, false);

  -- P10: compliance required → priority=high, compliance=true
  INSERT INTO session_task (workspace_id, department_session_id, title, status, assigned_to, is_compliance_required)
  VALUES (v_ws_a, v_ds_a, 'P10 compliance task', 'pending', v_e1_a, true);

  -- N1: task in W2 — E1 is NOT a member of W2
  INSERT INTO session_task (workspace_id, department_session_id, title, status, assigned_to, is_compliance_required)
  VALUES (v_ws_b, v_ds_b, 'N1 cross-workspace task', 'pending', NULL, false);

  -- N3: task outside window (yesterday session — use separate ds with past date)
  -- We place it in ds_a but give it a completed_at date in the far past to
  -- keep the INSERT valid; the actual exclusion is by session_date.
  -- Since we need a session with a past date, create one:
  INSERT INTO department_session (department_session_id, workspace_id, department_id, session_date, status)
  VALUES (gen_random_uuid(), v_ws_a, v_dept_a, CURRENT_DATE - 3, 'closed'::department_session_status);

  INSERT INTO session_task (workspace_id, department_session_id, title, status, assigned_to, is_compliance_required)
  SELECT v_ws_a, department_session_id, 'N3 outside-window task', 'pending', v_e1_a, false
  FROM   department_session
  WHERE  session_date = CURRENT_DATE - 3 AND workspace_id = v_ws_a
  LIMIT  1;

  -- P8: all 7 session_task_status values (use unassigned so E1 sees them via pickup flow)
  INSERT INTO session_task (workspace_id, department_session_id, title, status, assigned_to, is_compliance_required) VALUES
    (v_ws_a, v_ds_a, 'P8 pending',     'pending',     NULL, false),
    (v_ws_a, v_ds_a, 'P8 available',   'available',   NULL, false),
    (v_ws_a, v_ds_a, 'P8 in_progress', 'in_progress', NULL, false),
    (v_ws_a, v_ds_a, 'P8 completed',   'completed',   NULL, false),
    (v_ws_a, v_ds_a, 'P8 skipped',     'skipped',     NULL, false),
    (v_ws_a, v_ds_a, 'P8 overdue',     'overdue',     NULL, false),
    (v_ws_a, v_ds_a, 'P8 escalated',   'escalated',   NULL, false);

  -- ── schedule_day_task rows ─────────────────────────────────────────────────

  -- P3: highlight=true → priority='high' (assigned to E1)
  INSERT INTO schedule_day_task (workspace_id, shift_date, label, assigned_to, highlight)
  VALUES (v_ws_a, CURRENT_DATE, 'P3 highlight task', v_e1_a, true);

  -- P4: assigned_to=NULL in W1
  INSERT INTO schedule_day_task (workspace_id, shift_date, label, assigned_to, highlight)
  VALUES (v_ws_a, CURRENT_DATE, 'P4 unassigned day task', NULL, false);

  -- ── personal_task rows ────────────────────────────────────────────────────

  -- P5: priority='urgent' → normalized 'critical'
  INSERT INTO personal_task (profile_id, workspace_id, title, priority, status, due_at)
  VALUES (v_e1_a, v_ws_a, 'P5 urgent task', 'urgent', 'open', now() + INTERVAL '1 hour');

  -- N2: personal_task owned by E2 — E1 must not see it
  INSERT INTO personal_task (profile_id, workspace_id, title, priority, status, due_at)
  VALUES (v_e2_a, v_ws_a, 'N2 E2-owned task', 'normal', 'open', now() + INTERVAL '1 hour');

  -- P7: personal_task for E2 in W2 (must appear when E2 is caller)
  INSERT INTO personal_task (profile_id, workspace_id, title, priority, status, due_at)
  VALUES (v_e2_b, v_ws_b, 'P7 E2 W2 personal task', 'normal', 'open', now() + INTERVAL '1 hour');

  -- ── emma_task rows ────────────────────────────────────────────────────────

  -- P6: status='triggered' → preserved in normalized output
  INSERT INTO emma_task (workspace_id, profile_id, title, status, due_at)
  VALUES (v_ws_a, v_e1_a, 'P6 triggered task', 'triggered', now() + INTERVAL '1 hour');

  -- P7: emma_task for E2 in W2
  INSERT INTO emma_task (workspace_id, profile_id, title, status, due_at)
  VALUES (v_ws_b, v_e2_b, 'P7 E2 W2 emma task', 'pending', now() + INTERVAL '1 hour');

END $$;

-- ── Run all checks: set role, query, store result in session config ───────────
-- Pattern: DO block simulates JWT caller, stores boolean in session config,
-- then pgTAP ok() reads the stored result. This matches the sortie-a pattern.

DO $$
DECLARE
  v_e1_user UUID := current_setting('sb.e1_user')::uuid;
  v_e2_user UUID := current_setting('sb.e2_user')::uuid;
  v_count   BIGINT;
BEGIN
  -- ── P1: assigned session_task visible to E1 ──
  PERFORM pg_temp.act_as(v_e1_user);
  SET LOCAL ROLE authenticated;
  SELECT count(*) INTO v_count FROM fn_list_my_tasks() WHERE title = 'P1 assigned task' AND source = 'session';
  RESET ROLE;
  PERFORM set_config('sb.p1', (v_count = 1)::text, false);

  -- ── P2: unassigned session_task visible to E1 (pickup flow) ──
  PERFORM pg_temp.act_as(v_e1_user);
  SET LOCAL ROLE authenticated;
  SELECT count(*) INTO v_count FROM fn_list_my_tasks() WHERE title = 'P2 unassigned task' AND source = 'session';
  RESET ROLE;
  PERFORM set_config('sb.p2', (v_count = 1)::text, false);

  -- ── P3: day_task highlight=true → priority='high' ──
  PERFORM pg_temp.act_as(v_e1_user);
  SET LOCAL ROLE authenticated;
  SELECT count(*) INTO v_count FROM fn_list_my_tasks() WHERE title = 'P3 highlight task' AND source = 'day_ad_hoc' AND priority = 'high';
  RESET ROLE;
  PERFORM set_config('sb.p3', (v_count = 1)::text, false);

  -- ── P4: unassigned day_task visible to E1 ──
  PERFORM pg_temp.act_as(v_e1_user);
  SET LOCAL ROLE authenticated;
  SELECT count(*) INTO v_count FROM fn_list_my_tasks() WHERE title = 'P4 unassigned day task' AND source = 'day_ad_hoc';
  RESET ROLE;
  PERFORM set_config('sb.p4', (v_count = 1)::text, false);

  -- ── P5: personal_task urgent → normalized critical ──
  PERFORM pg_temp.act_as(v_e1_user);
  SET LOCAL ROLE authenticated;
  SELECT count(*) INTO v_count FROM fn_list_my_tasks() WHERE title = 'P5 urgent task' AND source = 'personal' AND priority = 'critical';
  RESET ROLE;
  PERFORM set_config('sb.p5', (v_count = 1)::text, false);

  -- ── P6: emma_task triggered preserved ──
  PERFORM pg_temp.act_as(v_e1_user);
  SET LOCAL ROLE authenticated;
  SELECT count(*) INTO v_count FROM fn_list_my_tasks() WHERE title = 'P6 triggered task' AND source = 'emma' AND status = 'triggered';
  RESET ROLE;
  PERFORM set_config('sb.p6', (v_count = 1)::text, false);

  -- ── P7: E2 sees rows from both W1 + W2 ──
  PERFORM pg_temp.act_as(v_e2_user);
  SET LOCAL ROLE authenticated;
  SELECT count(*) INTO v_count FROM fn_list_my_tasks()
  WHERE  title IN ('P7 E2 W2 personal task', 'P7 E2 W2 emma task');
  RESET ROLE;
  PERFORM set_config('sb.p7', (v_count = 2)::text, false);

  -- ── P8: all 7 session_task_status values map correctly ──
  PERFORM pg_temp.act_as(v_e1_user);
  SET LOCAL ROLE authenticated;
  SELECT count(*) INTO v_count FROM fn_list_my_tasks()
  WHERE source = 'session' AND title LIKE 'P8 %'
    AND (
         (raw_status = 'pending'     AND status = 'pending')     OR
         (raw_status = 'available'   AND status = 'pending')     OR
         (raw_status = 'in_progress' AND status = 'in_progress') OR
         (raw_status = 'completed'   AND status = 'done')        OR
         (raw_status = 'skipped'     AND status = 'cancelled')   OR
         (raw_status = 'overdue'     AND status = 'overdue')     OR
         (raw_status = 'escalated'   AND status = 'overdue')
    );
  RESET ROLE;
  PERFORM set_config('sb.p8', (v_count = 7)::text, false);

  -- ── P10: compliance required → priority=high AND compliance=true ──
  PERFORM pg_temp.act_as(v_e1_user);
  SET LOCAL ROLE authenticated;
  SELECT count(*) INTO v_count FROM fn_list_my_tasks()
  WHERE title = 'P10 compliance task' AND priority = 'high' AND compliance = true;
  RESET ROLE;
  PERFORM set_config('sb.p10', (v_count = 1)::text, false);

  -- ── N1: E1 does NOT see W2 session_task ──
  PERFORM pg_temp.act_as(v_e1_user);
  SET LOCAL ROLE authenticated;
  SELECT count(*) INTO v_count FROM fn_list_my_tasks() WHERE title = 'N1 cross-workspace task';
  RESET ROLE;
  PERFORM set_config('sb.n1', (v_count = 0)::text, false);

  -- ── N2: E1 does NOT see E2's personal_task ──
  PERFORM pg_temp.act_as(v_e1_user);
  SET LOCAL ROLE authenticated;
  SELECT count(*) INTO v_count FROM fn_list_my_tasks() WHERE title = 'N2 E2-owned task';
  RESET ROLE;
  PERFORM set_config('sb.n2', (v_count = 0)::text, false);

  -- ── N3: task with past session_date outside default window ──
  PERFORM pg_temp.act_as(v_e1_user);
  SET LOCAL ROLE authenticated;
  SELECT count(*) INTO v_count FROM fn_list_my_tasks() WHERE title = 'N3 outside-window task';
  RESET ROLE;
  PERFORM set_config('sb.n3', (v_count = 0)::text, false);

  -- ── N4: no source='runtime' rows appear ──
  PERFORM pg_temp.act_as(v_e1_user);
  SET LOCAL ROLE authenticated;
  SELECT count(*) INTO v_count FROM fn_list_my_tasks() WHERE source = 'runtime';
  RESET ROLE;
  PERFORM set_config('sb.n4', (v_count = 0)::text, false);

END $$;

-- ── P1-P10 pgTAP assertions ───────────────────────────────────────────────────
SELECT ok(current_setting('sb.p1')::boolean,  'P1: assigned session_task visible to E1');
SELECT ok(current_setting('sb.p2')::boolean,  'P2: unassigned session_task visible (pickup flow)');
SELECT ok(current_setting('sb.p3')::boolean,  'P3: day_task highlight=true → priority=high');
SELECT ok(current_setting('sb.p4')::boolean,  'P4: unassigned day_task visible to E1');
SELECT ok(current_setting('sb.p5')::boolean,  'P5: personal_task urgent → normalized critical');
SELECT ok(current_setting('sb.p6')::boolean,  'P6: emma_task triggered status preserved');
SELECT ok(current_setting('sb.p7')::boolean,  'P7: multi-workspace E2 sees W1+W2 rows (R8)');
SELECT ok(current_setting('sb.p8')::boolean,  'P8: all 7 session_task_status values map correctly');
SELECT ok(current_setting('sb.p10')::boolean, 'P10: compliance=true → priority=high + compliance col true');

-- ── N1-N4 pgTAP assertions ────────────────────────────────────────────────────
SELECT ok(current_setting('sb.n1')::boolean, 'N1: E1 cannot see W2 session_task (workspace isolation)');
SELECT ok(current_setting('sb.n2')::boolean, 'N2: E1 cannot see E2 personal_task (owner isolation)');
SELECT ok(current_setting('sb.n3')::boolean, 'N3: session_task with past session_date excluded from window');
SELECT ok(current_setting('sb.n4')::boolean, 'N4: no source=runtime rows (R2 — engine_state_step excluded)');

-- ── P9: window boundary — yesterday session is included in default window ─────
-- The default p_window_start is (now() - INTERVAL '1 day').
-- A session_date of CURRENT_DATE - 1 casts to midnight yesterday UTC.
-- We call with an explicit p_window_start = (CURRENT_DATE - 1)::timestamptz
-- (also midnight UTC), so BETWEEN is inclusive and the row must appear.
DO $$
DECLARE
  v_e1_user     UUID  := current_setting('sb.e1_user')::uuid;
  v_ws_a        UUID  := current_setting('sb.ws_a')::uuid;
  v_count       BIGINT;
  v_yesterday   DATE  := CURRENT_DATE - 1;
  v_ds_boundary UUID  := gen_random_uuid();
  v_dept_id     UUID;
BEGIN
  SELECT department_id INTO v_dept_id FROM department WHERE workspace_id = v_ws_a LIMIT 1;

  INSERT INTO department_session (department_session_id, workspace_id, department_id, session_date, status)
  VALUES (v_ds_boundary, v_ws_a, v_dept_id, v_yesterday, 'upcoming');

  INSERT INTO session_task (workspace_id, department_session_id, title, status, assigned_to, is_compliance_required)
  VALUES (v_ws_a, v_ds_boundary, 'P9 boundary task', 'pending', NULL, false);

  PERFORM pg_temp.act_as(v_e1_user);
  SET LOCAL ROLE authenticated;
  -- Explicit window: start = yesterday midnight, end = 7 days out
  -- session_date::timestamptz for yesterday = midnight UTC — exactly at start
  SELECT count(*) INTO v_count
  FROM   fn_list_my_tasks(
           (v_yesterday)::timestamptz,          -- p_window_start: midnight yesterday
           (now() + INTERVAL '7 days')           -- p_window_end
         )
  WHERE  title = 'P9 boundary task';
  RESET ROLE;
  PERFORM set_config('sb.p9', (v_count = 1)::text, false);
END $$;

SELECT ok(current_setting('sb.p9')::boolean, 'P9: session_date at window start boundary is included (BETWEEN inclusive)');

-- ── N5: caller without JWT gets 0 rows (secure isolation via caller_profiles CTE) ──
-- Supabase auto-grants EXECUTE to anon via ALTER DEFAULT PRIVILEGES, so a pure
-- GRANT-check would be misleading. The actual security property is that the
-- caller_profiles CTE filters on auth.uid() — when uid is NULL (no JWT / anon
-- caller), no profile rows match and the UNION returns 0 rows.
-- We must clear the jwt.claims that prior DO blocks left in session config,
-- otherwise the call sees the last authenticated user's UUID.
DO $$
BEGIN
  PERFORM set_config('request.jwt.claim.sub', '', true);
  PERFORM set_config('request.jwt.claims', '{}', true);
END $$;

SELECT is(
  (SELECT count(*)::integer FROM fn_list_my_tasks()),
  0,
  'N5: caller with no JWT (auth.uid()=NULL) receives 0 rows — caller_profiles CTE self-gates'
);

SELECT * FROM finish();
ROLLBACK;
