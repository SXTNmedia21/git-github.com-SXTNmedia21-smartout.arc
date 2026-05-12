-- payroll-phase-2-trigger-fires.sql
--
-- T8.2 — DB-level regression test for the three recalc-triggers from
--         20260507110100_payroll_phase2_recalc_triggers.sql (Payroll Phase 2).
--
-- Scope vs sibling file (payroll-phase-2-recalc-triggers.sql from T7.1):
--   T7.1 (recalc-triggers.sql) = verification + smoke format (RAISE NOTICE PASS/FAIL)
--   T8.2 (trigger-fires.sql)   = formal regression table, one DO block per trigger,
--                                 each in its own SAVEPOINT so test isolation is strict.
--
-- Three triggers under test:
--   A. payroll_manual_supplement_recalc_trg — INSERT into payroll_manual_supplement
--      → engine_event(payroll.recalc_triggered_by_supplement) appears
--   B. payroll_proposal_applied_trg — UPDATE change_proposal SET status='applied'
--      WHERE kind='wage_line_override'
--      → engine_event(payroll.line_override_applied) appears
--   C. payroll_tip_distribution_recalc_trg — INSERT into tip_distribution
--      WHERE status='approved' AND payroll_period_id IS NOT NULL AND period.status='open'
--      → engine_event(payroll.recalc_triggered_by_tip_distribution) appears
--
-- Each test case:
--   SAVEPOINT → seed → fire trigger → assert engine_event count → ROLLBACK TO SAVEPOINT
--
-- Pattern: RAISE EXCEPTION on failure (matching gate-action.sql convention).
-- FK bypass: SET session_replication_role = 'replica' during fixture setup, then
--            restored to 'origin' before the trigger-firing INSERT/UPDATE (so triggers
--            actually fire — replication mode disables triggers too).
--
-- Run with:
--   psql "postgresql://postgres:postgres@localhost:54322/postgres" \
--        --set ON_ERROR_STOP=1 \
--        -f supabase/tests/payroll-phase-2-trigger-fires.sql
--
-- CI: added to .github/workflows/pgtap.yml as a required step.
--
-- ADR refs: ADR-0292 (override-applier), ADR-0251 (append-only event chain).
-- Skill refs: payroll-engine-developer §Principle 3 (audit non-negotiable).

BEGIN;

-- ── Shared fixture IDs (set via GUC, readable across DO blocks in session) ──
DO $$
DECLARE
  v_workspace_id     UUID := gen_random_uuid();
  v_company_id       UUID := gen_random_uuid();
  v_user_id          UUID := gen_random_uuid();
  v_profile_id       UUID := gen_random_uuid();
  v_dept_id          UUID := gen_random_uuid();
  v_shift_id         UUID := gen_random_uuid();
  v_period_id        UUID := gen_random_uuid();
  v_pool_id          UUID := gen_random_uuid();
  v_proposal_id      UUID := gen_random_uuid();
  v_calc_id          UUID := gen_random_uuid();
BEGIN
  PERFORM set_config('t82.workspace_id',  v_workspace_id::text,  false);
  PERFORM set_config('t82.company_id',    v_company_id::text,    false);
  PERFORM set_config('t82.user_id',       v_user_id::text,       false);
  PERFORM set_config('t82.profile_id',    v_profile_id::text,    false);
  PERFORM set_config('t82.dept_id',       v_dept_id::text,       false);
  PERFORM set_config('t82.shift_id',      v_shift_id::text,      false);
  PERFORM set_config('t82.period_id',     v_period_id::text,     false);
  PERFORM set_config('t82.pool_id',       v_pool_id::text,       false);
  PERFORM set_config('t82.proposal_id',   v_proposal_id::text,   false);
  PERFORM set_config('t82.calc_id',       v_calc_id::text,       false);
END $$;

-- ── Shared seed (FK bypass via session_replication_role = replica) ──────────
-- All shared fixture rows inserted once here. Individual test cases add their
-- own rows within SAVEPOINT blocks and roll them back.
SET session_replication_role = 'replica';

DO $$
DECLARE
  v_workspace_id UUID := current_setting('t82.workspace_id')::uuid;
  v_company_id   UUID := current_setting('t82.company_id')::uuid;
  v_user_id      UUID := current_setting('t82.user_id')::uuid;
  v_profile_id   UUID := current_setting('t82.profile_id')::uuid;
  v_dept_id      UUID := current_setting('t82.dept_id')::uuid;
  v_shift_id     UUID := current_setting('t82.shift_id')::uuid;
  v_period_id    UUID := current_setting('t82.period_id')::uuid;
BEGIN
  -- Identity layer
  INSERT INTO auth.users (id, email, aud, role, instance_id)
    VALUES (v_user_id, 't82+' || v_user_id || '@test.invalid',
            'authenticated', 'authenticated',
            '00000000-0000-0000-0000-000000000000');

  INSERT INTO company (company_id, name)
    VALUES (v_company_id, 'T8.2 Trigger Test Co');

  INSERT INTO workspace (workspace_id, company_id, name, slug)
    VALUES (v_workspace_id, v_company_id, 'T8.2 Trigger WS',
            't82-' || substr(v_workspace_id::text, 1, 8));

  INSERT INTO profile (profile_id, profile_code, user_id, workspace_id, role, is_active, display_name)
    VALUES (v_profile_id, 't82-' || substr(v_profile_id::text, 1, 8),
            v_user_id, v_workspace_id, 'employee', true, 'T8.2 Test Employee');

  INSERT INTO department (department_id, workspace_id, name, slug)
    VALUES (v_dept_id, v_workspace_id, 'T8.2 Test Department',
            't82-dept-' || substr(v_dept_id::text, 1, 8));

  -- schedule_shift (minimal — shift_date used by trigger A for period lookup).
  -- Schema: employee_id (not profile_id), no department_id column, TIME (not TIMESTAMPTZ),
  -- role + day_category NOT NULL.
  INSERT INTO schedule_shift (
    schedule_shift_id, workspace_id, employee_id,
    shift_date, role, start_time, end_time, day_category, status
  ) VALUES (
    v_shift_id, v_workspace_id, v_profile_id,
    '2026-04-15', 'server',
    '08:00:00'::time, '16:00:00'::time, 'midday', 'completed'
  );

  -- payroll.period (open, covering shift_date 2026-04-15)
  INSERT INTO payroll.period (
    id, workspace_id, status, start_date, end_date
  ) VALUES (
    v_period_id, v_workspace_id, 'open',
    '2026-04-01', '2026-04-30'
  );
END $$;

-- Restore origin AFTER fixture setup so triggers fire on test INSERT/UPDATE below.
SET session_replication_role = 'origin';


-- ═════════════════════════════════════════════════════════════════════════════
-- Test A — Trigger A: payroll_manual_supplement INSERT fires recalc event
-- ═════════════════════════════════════════════════════════════════════════════

SAVEPOINT t82_test_a;

DO $$
DECLARE
  v_workspace_id UUID := current_setting('t82.workspace_id')::uuid;
  v_profile_id   UUID := current_setting('t82.profile_id')::uuid;
  v_shift_id     UUID := current_setting('t82.shift_id')::uuid;
  v_event_count  INT;
  v_supplement_id UUID := gen_random_uuid();
BEGIN
  -- ACT: Insert a payroll_manual_supplement row.
  -- The trigger fn_payroll_manual_supplement_recalc() should fire and
  -- emit engine_event(payroll.recalc_triggered_by_supplement).
  INSERT INTO payroll.manual_supplement (
    id, workspace_id, schedule_shift_id, description, amount, added_by
  ) VALUES (
    v_supplement_id, v_workspace_id, v_shift_id,
    'T8.2 test supplement (Trigger A)', 500.00, v_profile_id
  );

  -- ASSERT: exactly 1 engine_event row with the expected event_type
  SELECT COUNT(*) INTO v_event_count
    FROM public.engine_event
   WHERE workspace_id = v_workspace_id
     AND event_type = 'payroll.recalc_triggered_by_supplement'
     AND payload->>'supplement_id' = v_supplement_id::text;

  IF v_event_count <> 1 THEN
    RAISE EXCEPTION
      'FAIL (T8.2 Trigger A): expected 1 engine_event for payroll.recalc_triggered_by_supplement, got % (supplement_id=%)',
      v_event_count, v_supplement_id;
  END IF;

  -- ASSERT: payload contains correct period_id
  IF NOT EXISTS (
    SELECT 1 FROM public.engine_event
     WHERE workspace_id = v_workspace_id
       AND event_type = 'payroll.recalc_triggered_by_supplement'
       AND payload->>'supplement_id' = v_supplement_id::text
       AND payload->>'period_id'     = current_setting('t82.period_id')
  ) THEN
    RAISE EXCEPTION
      'FAIL (T8.2 Trigger A): engine_event payload missing correct period_id';
  END IF;

  RAISE NOTICE 'PASS (T8.2 Trigger A): INSERT into payroll_manual_supplement fires recalc event';
END $$;

ROLLBACK TO SAVEPOINT t82_test_a;


-- ═════════════════════════════════════════════════════════════════════════════
-- Test B — Trigger B: change_proposal UPDATE status→'applied' fires override event
-- ═════════════════════════════════════════════════════════════════════════════

SAVEPOINT t82_test_b;
SET session_replication_role = 'replica';

DO $$
DECLARE
  v_workspace_id UUID := current_setting('t82.workspace_id')::uuid;
  v_profile_id   UUID := current_setting('t82.profile_id')::uuid;
  v_period_id    UUID := current_setting('t82.period_id')::uuid;
  v_proposal_id  UUID := current_setting('t82.proposal_id')::uuid;
  v_calc_id      UUID := current_setting('t82.calc_id')::uuid;
BEGIN
  -- Seed a pending wage_line_override change_proposal
  INSERT INTO public.change_proposal (
    change_proposal_id, workspace_id, initiated_by,
    trigger_type, trigger_entity_type, trigger_entity_id,
    created_by_plane, status, kind,
    changes
  ) VALUES (
    v_proposal_id, v_workspace_id, v_profile_id,
    'manual_override', 'payroll_calculation', v_calc_id,
    'admin_manual', 'pending', 'wage_line_override',
    jsonb_build_object(
      'calculation_id',       v_calc_id,
      'period_id',            v_period_id,
      'original_amount_cents', 150000,
      'proposed_amount_cents', 180000,
      'reason',               'T8.2 Trigger B test reason',
      'category',             'tariff_correction'
    )
  );
END $$;

SET session_replication_role = 'origin';

DO $$
DECLARE
  v_workspace_id UUID := current_setting('t82.workspace_id')::uuid;
  v_profile_id   UUID := current_setting('t82.profile_id')::uuid;
  v_proposal_id  UUID := current_setting('t82.proposal_id')::uuid;
  v_calc_id      UUID := current_setting('t82.calc_id')::uuid;
  v_event_count  INT;
BEGIN
  -- ACT: Update status to 'applied' — this is the transition Trigger B watches.
  UPDATE public.change_proposal
     SET status      = 'applied',
         resolved_by = v_profile_id,
         resolved_at = now(),
         applied_at  = now()
   WHERE change_proposal_id = v_proposal_id;

  -- ASSERT: exactly 1 engine_event with event_type payroll.line_override_applied
  SELECT COUNT(*) INTO v_event_count
    FROM public.engine_event
   WHERE workspace_id = v_workspace_id
     AND event_type = 'payroll.line_override_applied'
     AND payload->>'change_proposal_id' = v_proposal_id::text;

  IF v_event_count <> 1 THEN
    RAISE EXCEPTION
      'FAIL (T8.2 Trigger B): expected 1 engine_event for payroll.line_override_applied, got % (proposal_id=%)',
      v_event_count, v_proposal_id;
  END IF;

  -- ASSERT: payload contains calculation_id and period_id
  IF NOT EXISTS (
    SELECT 1 FROM public.engine_event
     WHERE workspace_id = v_workspace_id
       AND event_type = 'payroll.line_override_applied'
       AND payload->>'change_proposal_id' = v_proposal_id::text
       AND payload->>'calculation_id'     = v_calc_id::text
       AND payload->>'period_id'          = current_setting('t82.period_id')
  ) THEN
    RAISE EXCEPTION
      'FAIL (T8.2 Trigger B): engine_event payload missing calculation_id or period_id';
  END IF;

  -- ASSERT: idempotency — updating again (status was already 'applied') must NOT
  -- produce a second event. The ON CONFLICT (idempotency_key) DO NOTHING guard
  -- on engine_event prevents duplicate events.
  UPDATE public.change_proposal
     SET updated_at = now()   -- trigger a no-op re-fire
   WHERE change_proposal_id = v_proposal_id;

  SELECT COUNT(*) INTO v_event_count
    FROM public.engine_event
   WHERE workspace_id = v_workspace_id
     AND event_type = 'payroll.line_override_applied'
     AND payload->>'change_proposal_id' = v_proposal_id::text;

  -- Still exactly 1 (idempotency_key prevents duplicate)
  IF v_event_count <> 1 THEN
    RAISE EXCEPTION
      'FAIL (T8.2 Trigger B idempotency): expected 1 event after re-fire, got %',
      v_event_count;
  END IF;

  RAISE NOTICE 'PASS (T8.2 Trigger B): UPDATE change_proposal to applied fires override event (+ idempotency)';
END $$;

ROLLBACK TO SAVEPOINT t82_test_b;


-- ═════════════════════════════════════════════════════════════════════════════
-- Test B2 — Trigger B: UPDATE to non-'applied' status must NOT fire event
-- ═════════════════════════════════════════════════════════════════════════════

SAVEPOINT t82_test_b2;
SET session_replication_role = 'replica';

DO $$
DECLARE
  v_workspace_id UUID := current_setting('t82.workspace_id')::uuid;
  v_profile_id   UUID := current_setting('t82.profile_id')::uuid;
  v_period_id    UUID := current_setting('t82.period_id')::uuid;
  v_proposal_id2 UUID := gen_random_uuid();
  v_calc_id      UUID := current_setting('t82.calc_id')::uuid;
BEGIN
  INSERT INTO public.change_proposal (
    change_proposal_id, workspace_id, initiated_by,
    trigger_type, trigger_entity_type, trigger_entity_id,
    created_by_plane, status, kind,
    changes
  ) VALUES (
    v_proposal_id2, v_workspace_id, v_profile_id,
    'manual_override', 'payroll_calculation', v_calc_id,
    'admin_manual', 'pending', 'wage_line_override',
    jsonb_build_object(
      'calculation_id',        v_calc_id,
      'period_id',             v_period_id,
      'original_amount_cents', 150000,
      'proposed_amount_cents', 180000
    )
  );
  PERFORM set_config('t82.proposal_id2', v_proposal_id2::text, false);
END $$;

SET session_replication_role = 'origin';

DO $$
DECLARE
  v_workspace_id UUID := current_setting('t82.workspace_id')::uuid;
  v_proposal_id2 UUID := current_setting('t82.proposal_id2')::uuid;
  v_profile_id   UUID := current_setting('t82.profile_id')::uuid;
  v_event_count  INT;
BEGIN
  -- ACT: Update to 'rejected' — trigger must NOT fire
  UPDATE public.change_proposal
     SET status      = 'rejected',
         resolved_by = v_profile_id,
         resolved_at = now(),
         rejected_at = now()
   WHERE change_proposal_id = v_proposal_id2;

  SELECT COUNT(*) INTO v_event_count
    FROM public.engine_event
   WHERE workspace_id = v_workspace_id
     AND event_type = 'payroll.line_override_applied'
     AND payload->>'change_proposal_id' = v_proposal_id2::text;

  IF v_event_count <> 0 THEN
    RAISE EXCEPTION
      'FAIL (T8.2 Trigger B2): rejected proposal should NOT fire override event, got %',
      v_event_count;
  END IF;

  RAISE NOTICE 'PASS (T8.2 Trigger B2): rejected proposal does NOT fire override event';
END $$;

ROLLBACK TO SAVEPOINT t82_test_b2;


-- ═════════════════════════════════════════════════════════════════════════════
-- Test C — Trigger C: tip_distribution INSERT (approved + open period) fires recalc event
-- ═════════════════════════════════════════════════════════════════════════════

SAVEPOINT t82_test_c;
SET session_replication_role = 'replica';

DO $$
DECLARE
  v_workspace_id UUID := current_setting('t82.workspace_id')::uuid;
  v_profile_id   UUID := current_setting('t82.profile_id')::uuid;
  v_period_id    UUID := current_setting('t82.period_id')::uuid;
  v_pool_id      UUID := current_setting('t82.pool_id')::uuid;
BEGIN
  -- Seed a tip_pool (FK bypass — pool requires department_session which is complex)
  INSERT INTO public.tip_pool (
    id, workspace_id, department_session_id, policy_id,
    amount_nok, status, recorded_by, approved_by, approved_at
  ) VALUES (
    v_pool_id,
    v_workspace_id,
    gen_random_uuid(), -- FK bypass (session_replication_role = replica)
    gen_random_uuid(), -- FK bypass (tip_policy)
    1500.00,
    'approved',
    v_profile_id,
    v_profile_id,
    now()
  );
END $$;

SET session_replication_role = 'origin';

DO $$
DECLARE
  v_workspace_id  UUID := current_setting('t82.workspace_id')::uuid;
  v_profile_id    UUID := current_setting('t82.profile_id')::uuid;
  v_period_id     UUID := current_setting('t82.period_id')::uuid;
  v_pool_id       UUID := current_setting('t82.pool_id')::uuid;
  v_dist_id       UUID := gen_random_uuid();
  v_event_count   INT;
BEGIN
  -- ACT: Insert tip_distribution with status='approved' linked to open period.
  -- Trigger fn_payroll_tip_distribution_recalc() should fire.
  INSERT INTO public.tip_distribution (
    id, workspace_id, pool_id, profile_id, role,
    hours_worked, weight_applied, algorithm_snapshot,
    calculated_amount, payroll_period_id, status
  ) VALUES (
    v_dist_id, v_workspace_id, v_pool_id, v_profile_id, 'server',
    8.0, 1.0, '{}'::jsonb,
    500.00, v_period_id, 'approved'
  );

  -- ASSERT: exactly 1 engine_event for recalc_triggered_by_tip_distribution
  SELECT COUNT(*) INTO v_event_count
    FROM public.engine_event
   WHERE workspace_id = v_workspace_id
     AND event_type = 'payroll.recalc_triggered_by_tip_distribution'
     AND payload->>'tip_distribution_id' = v_dist_id::text;

  IF v_event_count <> 1 THEN
    RAISE EXCEPTION
      'FAIL (T8.2 Trigger C): expected 1 engine_event for payroll.recalc_triggered_by_tip_distribution, got % (dist_id=%)',
      v_event_count, v_dist_id;
  END IF;

  -- ASSERT: payload contains payroll_period_id and profile_id
  IF NOT EXISTS (
    SELECT 1 FROM public.engine_event
     WHERE workspace_id = v_workspace_id
       AND event_type = 'payroll.recalc_triggered_by_tip_distribution'
       AND payload->>'tip_distribution_id' = v_dist_id::text
       AND payload->>'payroll_period_id'   = v_period_id::text
       AND payload->>'profile_id'          = v_profile_id::text
  ) THEN
    RAISE EXCEPTION
      'FAIL (T8.2 Trigger C): engine_event payload missing payroll_period_id or profile_id';
  END IF;

  RAISE NOTICE 'PASS (T8.2 Trigger C): INSERT tip_distribution(approved) fires recalc event';
END $$;

ROLLBACK TO SAVEPOINT t82_test_c;


-- ═════════════════════════════════════════════════════════════════════════════
-- Test C2 — Trigger C: tip_distribution INSERT with status='calculated'
--           must NOT fire event (guard condition check)
-- ═════════════════════════════════════════════════════════════════════════════

SAVEPOINT t82_test_c2;
SET session_replication_role = 'replica';

DO $$
DECLARE
  v_workspace_id UUID := current_setting('t82.workspace_id')::uuid;
  v_profile_id   UUID := current_setting('t82.profile_id')::uuid;
  v_period_id    UUID := current_setting('t82.period_id')::uuid;
  v_pool_id2     UUID := gen_random_uuid();
BEGIN
  INSERT INTO public.tip_pool (
    id, workspace_id, department_session_id, policy_id,
    amount_nok, status, recorded_by
  ) VALUES (
    v_pool_id2, v_workspace_id,
    gen_random_uuid(), gen_random_uuid(),
    500.00, 'recorded', v_profile_id
  );
  PERFORM set_config('t82.pool_id2', v_pool_id2::text, false);
END $$;

SET session_replication_role = 'origin';

DO $$
DECLARE
  v_workspace_id UUID := current_setting('t82.workspace_id')::uuid;
  v_profile_id   UUID := current_setting('t82.profile_id')::uuid;
  v_period_id    UUID := current_setting('t82.period_id')::uuid;
  v_pool_id2     UUID := current_setting('t82.pool_id2')::uuid;
  v_dist_id2     UUID := gen_random_uuid();
  v_event_count  INT;
BEGIN
  -- ACT: Insert with status='calculated' — trigger must NOT fire
  INSERT INTO public.tip_distribution (
    id, workspace_id, pool_id, profile_id, role,
    hours_worked, weight_applied, algorithm_snapshot,
    calculated_amount, payroll_period_id, status
  ) VALUES (
    v_dist_id2, v_workspace_id, v_pool_id2, v_profile_id, 'server',
    8.0, 1.0, '{}'::jsonb,
    300.00, v_period_id, 'calculated'
  );

  SELECT COUNT(*) INTO v_event_count
    FROM public.engine_event
   WHERE workspace_id = v_workspace_id
     AND event_type = 'payroll.recalc_triggered_by_tip_distribution'
     AND payload->>'tip_distribution_id' = v_dist_id2::text;

  IF v_event_count <> 0 THEN
    RAISE EXCEPTION
      'FAIL (T8.2 Trigger C2): calculated (non-approved) tip_distribution should NOT fire recalc event, got %',
      v_event_count;
  END IF;

  RAISE NOTICE 'PASS (T8.2 Trigger C2): calculated tip_distribution does NOT fire recalc event';
END $$;

ROLLBACK TO SAVEPOINT t82_test_c2;


-- ═════════════════════════════════════════════════════════════════════════════
-- Final cleanup — roll back ALL fixtures (no pollution across test runs)
-- ═════════════════════════════════════════════════════════════════════════════

ROLLBACK;

-- If we reach here, all assertions passed.
-- ON_ERROR_STOP=1 in CI ensures any RAISE EXCEPTION above aborts execution.
