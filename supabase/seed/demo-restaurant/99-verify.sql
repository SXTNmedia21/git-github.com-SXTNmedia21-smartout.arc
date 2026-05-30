-- ============ DEMO RESTAURANT CANONICAL ID MAP (do not edit per-file) ============
-- COMPANY        a0000000-0000-0000-0000-000000000000  Smartout AS
-- WORKSPACE      b0000000-0000-0000-0000-000000000000  "Demo Restaurant"
-- LOCATION       c0000000-0000-0000-0000-000000000000  Oslo Downtown Hub
-- ZONE Hovedsal  d1000000-0000-0000-0000-000000000001  | Terrasse d1…2 | Bar d1…3 | Privat d1…4
-- DEPT Operations d0000000-0000-0000-0000-000000000000 | Kitchen d0…1 | Service d0…2 | Bar d0…3
-- PROFILES f0000000-…-{0..9} + new {a..d}; AUTH e0000000-…-{0..9} + new {a..d}
-- LOCAL ONLY — never prod. Idempotent (upsert). password = password123
-- =================================================================================
--
-- 99-verify.sql — loud self-test for demo-restaurant seed
--
-- WHAT: Pure-SQL self-test. No writes, no deletes. Safe to run any number of times.
-- WHY:  Superuser counts bypass RLS — hollow-UI class (L-0348 / HMS-hollow-UI).
--       PART A catches missing rows. PART B proves the UI (authenticated) actually sees them.
--       RAISE EXCEPTION on failure bricks `db reset` by design.
--
-- APPLY: docker exec -i supabase_db_smartout.ai psql -U postgres -d postgres \
--          -X -v ON_ERROR_STOP=1 < supabase/seed/demo-restaurant/99-verify.sql; echo "exit=$?"
-- =================================================================================

SET search_path = public, extensions, pg_catalog;

-- ─────────────────────────────────────────────────────────────────────────────
-- PART A — CORE INVARIANTS (RAISE EXCEPTION on failure → bricks reset, by design)
-- ─────────────────────────────────────────────────────────────────────────────
DO $$
DECLARE
  n              int;
  ws_id CONSTANT uuid := 'b0000000-0000-0000-0000-000000000000';
  sat_date       date;
BEGIN

  -- ── 1. Profile count ─────────────────────────────────────────────────────
  SELECT count(*) INTO n FROM public.profile WHERE workspace_id = ws_id;
  IF n < 11 THEN
    RAISE EXCEPTION 'HOLLOW: profile = % (expected >= 11)', n;
  END IF;

  -- ── 2. Department operating hours (4 depts × 7 days) ────────────────────
  SELECT count(*) INTO n FROM public.department_operating_hours WHERE workspace_id = ws_id;
  IF n <> 28 THEN
    RAISE EXCEPTION 'HOLLOW: department_operating_hours = % (expected 28)', n;
  END IF;

  -- ── 3. Employment contracts ──────────────────────────────────────────────
  SELECT count(*) INTO n FROM public.employment_contract WHERE workspace_id = ws_id;
  IF n < 10 THEN
    RAISE EXCEPTION 'HOLLOW: employment_contract = % (expected >= 10)', n;
  END IF;

  -- ── 4. Saturday session_task > 0 ────────────────────────────────────────
  -- Saturday = Monday of current week + 5 days (date_trunc('week') = Monday)
  sat_date := date_trunc('week', CURRENT_DATE)::date + 5;
  SELECT count(*) INTO n
  FROM public.session_task st
  JOIN public.department_session ds ON ds.department_session_id = st.department_session_id
  WHERE ds.session_date = sat_date
    AND ds.workspace_id = ws_id;
  IF n = 0 THEN
    RAISE EXCEPTION 'HOLLOW: session_task on Saturday (%) = 0 (expected > 0)', sat_date;
  END IF;

  -- ── 5. Shift zones > 0 ───────────────────────────────────────────────────
  SELECT count(*) INTO n FROM public.shift_zone WHERE workspace_id = ws_id;
  IF n = 0 THEN
    RAISE EXCEPTION 'HOLLOW: shift_zone = 0 (expected > 0)';
  END IF;

  -- ── 6. Payroll calculation lines > 0 ────────────────────────────────────
  SELECT count(*) INTO n FROM payroll.calculation_line WHERE workspace_id = ws_id;
  IF n = 0 THEN
    RAISE EXCEPTION 'HOLLOW: payroll.calculation_line = 0 (expected > 0)';
  END IF;

  -- ── 7. Audit integrity: no calculation without a shift ──────────────────
  -- Every payroll.calculation MUST reference a schedule_shift (no orphaned rows)
  SELECT count(*) INTO n
  FROM payroll.calculation
  WHERE workspace_id = ws_id
    AND schedule_shift_id IS NULL;
  IF n > 0 THEN
    RAISE EXCEPTION 'HOLLOW: payroll.calculation with schedule_shift_id IS NULL = % (expected 0 — audit integrity violated)', n;
  END IF;

  -- ── 8. Audit back-ref: non-base events must have tariff_rate_table_id ───
  SELECT count(*) INTO n
  FROM public.shift_pay_calculation_event
  WHERE workspace_id = ws_id
    AND rule_type <> 'base'
    AND tariff_rate_table_id IS NULL;
  IF n > 0 THEN
    RAISE EXCEPTION 'HOLLOW: shift_pay_calculation_event with rule_type<>base and tariff_rate_table_id IS NULL = % (expected 0 — back-ref broken)', n;
  END IF;

  -- ── 9. is_tariff_bound = true on payroll.workspace_settings ─────────────
  SELECT count(*) INTO n
  FROM payroll.workspace_settings
  WHERE workspace_id = ws_id
    AND is_tariff_bound = true;
  IF n = 0 THEN
    RAISE EXCEPTION 'HOLLOW: payroll.workspace_settings.is_tariff_bound != true for demo workspace';
  END IF;

  -- ── 10a. FK-literal drift: schedule_shift → department ──────────────────
  -- Catches a mistyped literal UUID that bypasses FK (FK = deferred / same schema)
  SELECT count(*) INTO n
  FROM public.schedule_shift ss
  LEFT JOIN public.department d ON d.department_id = ss.department_id
  WHERE ss.workspace_id = ws_id
    AND d.department_id IS NULL;
  IF n > 0 THEN
    RAISE EXCEPTION 'HOLLOW: % schedule_shift row(s) reference a department_id with no matching department row (literal drift)', n;
  END IF;

  -- ── 10b. FK-literal drift: session_task → department_session ────────────
  SELECT count(*) INTO n
  FROM public.session_task st
  LEFT JOIN public.department_session ds ON ds.department_session_id = st.department_session_id
  WHERE st.workspace_id = ws_id
    AND ds.department_session_id IS NULL;
  IF n > 0 THEN
    RAISE EXCEPTION 'HOLLOW: % session_task row(s) reference a department_session_id with no matching department_session row (literal drift)', n;
  END IF;

  RAISE NOTICE '✓ CORE invariants OK — profiles/op-hours/contracts/sat-tasks/zones/calc-lines/audit-integrity/tariff/FK-drift all pass';

END $$;


-- ─────────────────────────────────────────────────────────────────────────────
-- PART B — RLS-CONTEXT READS
-- (CRITICAL: superuser counts bypass RLS; these prove the UI actually sees rows)
--
-- Pattern: set_config role+jwt → read → reset to postgres → RAISE
-- IMPORTANT: reset role BEFORE raising so exception is never masked.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── B1. schedule_shift under admin JWT ───────────────────────────────────────
-- Policy: jwt_read_schedule_shift = workspace_id IN (get_workspace_ids_for_user(auth.uid()))
-- auth.uid() reads request.jwt.claims->>'sub'
DO $$
DECLARE
  n          int;
  admin_uid  CONSTANT uuid := 'e0000000-0000-0000-0000-000000000000';
  ws_id      CONSTANT uuid := 'b0000000-0000-0000-0000-000000000000';
BEGIN
  PERFORM set_config('role', 'authenticated', true);
  PERFORM set_config(
    'request.jwt.claims',
    json_build_object('sub', admin_uid::text, 'role', 'authenticated')::text,
    true
  );

  SELECT count(*) INTO n
  FROM public.schedule_shift
  WHERE shift_date >= date_trunc('week', CURRENT_DATE)::date
    AND workspace_id = ws_id;

  -- Reset BEFORE raise so exceptions aren't masked inside authenticated context
  PERFORM set_config('role', 'postgres', true);

  IF n = 0 THEN
    RAISE EXCEPTION 'RLS-HOLLOW: authenticated admin (%) sees 0 current-week shifts — membership or RLS predicate broken', admin_uid;
  END IF;

  RAISE NOTICE '✓ RLS B1 OK — admin sees % current-week shifts under authenticated role', n;
END $$;


-- ── B2. payroll.calculation under employee JWT (Anna) ────────────────────────
-- Policy: jwt_select_payroll_calculation = workspace_id IN (get_workspace_ids_for_user(auth.uid()))
-- Anna (e0…1) has a closed payroll.period with calculation rows — workspace-scoped, so she sees all.
DO $$
DECLARE
  n         int;
  anna_uid  CONSTANT uuid := 'e0000000-0000-0000-0000-000000000001';
  ws_id     CONSTANT uuid := 'b0000000-0000-0000-0000-000000000000';
BEGIN
  PERFORM set_config('role', 'authenticated', true);
  PERFORM set_config(
    'request.jwt.claims',
    json_build_object('sub', anna_uid::text, 'role', 'authenticated')::text,
    true
  );

  SELECT count(*) INTO n
  FROM payroll.calculation
  WHERE workspace_id = ws_id;

  -- Reset BEFORE raise
  PERFORM set_config('role', 'postgres', true);

  IF n = 0 THEN
    RAISE EXCEPTION 'RLS-HOLLOW: authenticated employee Anna (%) sees 0 payroll.calculation rows — membership or RLS predicate broken', anna_uid;
  END IF;

  RAISE NOTICE '✓ RLS B2 OK — employee Anna sees % payroll.calculation rows under authenticated role', n;
END $$;


-- ─────────────────────────────────────────────────────────────────────────────
-- PART C — OPTIONAL DOMAIN COUNTS (NOTICE only — never bricks reset)
-- Deferred / optional tables that may lag behind core seed.
-- ─────────────────────────────────────────────────────────────────────────────
DO $$
DECLARE
  ws_id          CONSTANT uuid := 'b0000000-0000-0000-0000-000000000000';
  n_policies     int;
  n_protocols    int;
  n_ctrl_lists   int;
  n_ktests       int;
  n_channels     int;
  n_conversations int;
  n_messages     int;
  n_assets       int;
  n_seasons      int;
BEGIN
  SELECT count(*) INTO n_policies    FROM public.policy   WHERE workspace_id = ws_id;
  SELECT count(*) INTO n_protocols   FROM public.protocol WHERE workspace_id = ws_id;

  -- control_list has no workspace_id — join via protocol
  SELECT count(*) INTO n_ctrl_lists
  FROM public.control_list cl
  JOIN public.protocol p ON p.protocol_id = cl.protocol_id
  WHERE p.workspace_id = ws_id;

  -- knowledge_test has no workspace_id — join via protocol
  SELECT count(*) INTO n_ktests
  FROM public.knowledge_test kt
  JOIN public.protocol p ON p.protocol_id = kt.protocol_id
  WHERE p.workspace_id = ws_id;

  SELECT count(*) INTO n_channels      FROM public.channel           WHERE workspace_id = ws_id;
  SELECT count(*) INTO n_conversations FROM public.chat_conversation  WHERE workspace_id = ws_id;

  -- chat_message.conversation_id → chat_conversation.id
  SELECT count(*) INTO n_messages
  FROM public.chat_message cm
  JOIN public.chat_conversation cc ON cc.id = cm.conversation_id
  WHERE cc.workspace_id = ws_id;

  SELECT count(*) INTO n_assets  FROM public.asset  WHERE workspace_id = ws_id;
  SELECT count(*) INTO n_seasons FROM public.season WHERE workspace_id = ws_id;

  RAISE NOTICE 'OPTIONAL domain counts (informational) — policies=% protocols=% control_lists=% knowledge_tests=% channels=% conversations=% chat_messages=% assets=% seasons=%',
    n_policies, n_protocols, n_ctrl_lists, n_ktests,
    n_channels, n_conversations, n_messages,
    n_assets, n_seasons;
END $$;
