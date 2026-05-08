-- payroll-phase-2-recalc-triggers.sql
--
-- T7.1 verification — three recalc-trigger paths (Payroll Phase 2).
-- Run with:
--   psql "postgresql://postgres:postgres@localhost:54322/postgres" \
--        -f supabase/tests/payroll-phase-2-recalc-triggers.sql
--
-- Convention: plain SQL with RAISE EXCEPTION on assertion failure
-- (no pgTAP framework — matches supabase/tests/gate-action.sql pattern).
-- Each test wraps its own SAVEPOINT + ROLLBACK TO SAVEPOINT so test
-- failures surface as a RAISE, not as commit-path corruption.
--
-- Triggers under test (20260507110100_payroll_phase2_recalc_triggers.sql):
--   Trigger A — fn_payroll_manual_supplement_recalc
--               payroll_manual_supplement AFTER INSERT OR DELETE
--               → engine_event(payroll.recalc_triggered_by_supplement)
--
--   Trigger B — fn_payroll_proposal_applied
--               change_proposal AFTER UPDATE status→'applied', kind='wage_line_override'
--               → engine_event(payroll.line_override_applied)
--
--   Trigger C — fn_payroll_tip_distribution_recalc
--               tip_distribution AFTER INSERT status='approved', payroll_period_id set
--               → engine_event(payroll.recalc_triggered_by_tip_distribution)
--
-- ADR refs: ADR-0292, ADR-0251, ADR-0099.
-- Migration deps: 20260507110000 (kind/resolved_by on change_proposal),
--                 20260507110100 (triggers), 20260527100900 (tip_distribution.payroll_period_id).

BEGIN;

-- ─────────────────────────────────────────────────────────────────────────────
-- SETUP — shared minimal fixtures
-- All IDs stored in GUC so sub-blocks can read them.
-- ─────────────────────────────────────────────────────────────────────────────

DO $$
DECLARE
  v_user_id        UUID := gen_random_uuid();
  v_company_id     UUID := gen_random_uuid();
  v_workspace_id   UUID := gen_random_uuid();
  v_profile_id     UUID := gen_random_uuid();
  v_dept_id        UUID := gen_random_uuid();
  v_period_id      UUID := gen_random_uuid();
  v_shift_id       UUID := gen_random_uuid();
  v_tip_pool_id    UUID := gen_random_uuid();
  v_calc_id        UUID := gen_random_uuid();
BEGIN
  PERFORM set_config('test.workspace_id',   v_workspace_id::text,  false);
  PERFORM set_config('test.profile_id',     v_profile_id::text,    false);
  PERFORM set_config('test.dept_id',        v_dept_id::text,       false);
  PERFORM set_config('test.period_id',      v_period_id::text,     false);
  PERFORM set_config('test.shift_id',       v_shift_id::text,      false);
  PERFORM set_config('test.tip_pool_id',    v_tip_pool_id::text,   false);
  PERFORM set_config('test.calc_id',        v_calc_id::text,       false);
  PERFORM set_config('test.user_id',        v_user_id::text,       false);

  -- Auth user
  INSERT INTO auth.users (id, email, aud, role, instance_id)
    VALUES (v_user_id,
            'recalctest+' || v_user_id || '@example.test',
            'authenticated', 'authenticated',
            '00000000-0000-0000-0000-000000000000');

  UPDATE user_identity
     SET first_name = 'Recalc', last_name = 'Test'
   WHERE user_id = v_user_id;

  INSERT INTO company (company_id, name)
    VALUES (v_company_id, 'Recalc Test Co');

  INSERT INTO workspace (workspace_id, company_id, name, slug)
    VALUES (v_workspace_id, v_company_id, 'Recalc Test WS',
            'recalc-test-' || substr(v_workspace_id::text, 1, 8));

  INSERT INTO profile (profile_id, profile_code, user_id, workspace_id, role, is_active, display_name)
    VALUES (v_profile_id,
            'rtest-' || substr(v_profile_id::text, 1, 8),
            v_user_id, v_workspace_id,
            'admin', true, 'Recalc Admin');

  -- Department (needed for session/shift context)
  INSERT INTO department (id, workspace_id, name)
    VALUES (v_dept_id, v_workspace_id, 'Recalc Dept');

  -- Open payroll period
  INSERT INTO payroll.period (id, workspace_id, start_date, end_date, status)
    VALUES (v_period_id, v_workspace_id,
            date_trunc('month', now())::date,
            (date_trunc('month', now()) + interval '1 month - 1 day')::date,
            'open');

  -- A schedule_shift whose shift_date falls within the period
  INSERT INTO schedule_shift (
    schedule_shift_id, workspace_id, profile_id, department_id,
    start_time, end_time, shift_date, status
  ) VALUES (
    v_shift_id, v_workspace_id, v_profile_id, v_dept_id,
    date_trunc('month', now()) + interval '9 hours',
    date_trunc('month', now()) + interval '17 hours',
    date_trunc('month', now())::date,
    'published'
  );

  -- tip_pool row (needed for tip_distribution FK)
  INSERT INTO tip_pool (id, workspace_id, department_id, period_start, period_end, status, total_amount)
    VALUES (v_tip_pool_id, v_workspace_id, v_dept_id,
            date_trunc('month', now())::date,
            (date_trunc('month', now()) + interval '1 month - 1 day')::date,
            'approved', 10000);

  -- A placeholder payroll_calculation row so Trigger B can reference it
  -- (calculation_id stored in change_proposal.changes JSONB).
  -- The column set matches what apply-line-override reads.
  INSERT INTO payroll.calculation (
    id, workspace_id, period_id, profile_id,
    line_type, amount_nok, source, derivation_version, schedule_shift_id
  ) VALUES (
    v_calc_id, v_workspace_id, v_period_id, v_profile_id,
    'regular_hours', 2000.00, 'derived', 1, v_shift_id
  );
END $$;


-- ─────────────────────────────────────────────────────────────────────────────
-- TEST A1 — manual_supplement INSERT fires recalc event
-- ─────────────────────────────────────────────────────────────────────────────

SAVEPOINT before_test_a1;

DO $$
DECLARE
  v_workspace_id  UUID := current_setting('test.workspace_id')::UUID;
  v_profile_id    UUID := current_setting('test.profile_id')::UUID;
  v_shift_id      UUID := current_setting('test.shift_id')::UUID;
  v_supplement_id UUID := gen_random_uuid();
  v_event_count   INT;
BEGIN
  INSERT INTO payroll_manual_supplement (
    id, workspace_id, profile_id, schedule_shift_id,
    supplement_type, amount_nok, description, taxable, effective_date
  ) VALUES (
    v_supplement_id, v_workspace_id, v_profile_id, v_shift_id,
    'bonus', 500.00, 'Test supplement for recalc trigger', true,
    date_trunc('month', now())::date
  );

  SELECT COUNT(*) INTO v_event_count
    FROM public.engine_event
   WHERE event_type = 'payroll.recalc_triggered_by_supplement'
     AND workspace_id = v_workspace_id
     AND (payload ->> 'supplement_id')::UUID = v_supplement_id
     AND payload ->> 'op' = 'insert';

  IF v_event_count < 1 THEN
    RAISE EXCEPTION '[TEST A1 FAIL] Expected engine_event(payroll.recalc_triggered_by_supplement) '
      'with op=insert for supplement %, got % rows.',
      v_supplement_id, v_event_count;
  END IF;

  RAISE NOTICE '[TEST A1 PASS] manual_supplement INSERT → engine_event emitted (supplement_id=%)',
    v_supplement_id;
END $$;

ROLLBACK TO SAVEPOINT before_test_a1;


-- ─────────────────────────────────────────────────────────────────────────────
-- TEST A2 — manual_supplement DELETE fires recalc event
-- ─────────────────────────────────────────────────────────────────────────────

SAVEPOINT before_test_a2;

DO $$
DECLARE
  v_workspace_id  UUID := current_setting('test.workspace_id')::UUID;
  v_profile_id    UUID := current_setting('test.profile_id')::UUID;
  v_shift_id      UUID := current_setting('test.shift_id')::UUID;
  v_supplement_id UUID := gen_random_uuid();
  v_event_count   INT;
BEGIN
  -- Insert then delete — DELETE fires the trigger
  INSERT INTO payroll_manual_supplement (
    id, workspace_id, profile_id, schedule_shift_id,
    supplement_type, amount_nok, description, taxable, effective_date
  ) VALUES (
    v_supplement_id, v_workspace_id, v_profile_id, v_shift_id,
    'deduction', 100.00, 'Delete test supplement', true,
    date_trunc('month', now())::date
  );

  DELETE FROM payroll_manual_supplement WHERE id = v_supplement_id;

  SELECT COUNT(*) INTO v_event_count
    FROM public.engine_event
   WHERE event_type = 'payroll.recalc_triggered_by_supplement'
     AND workspace_id = v_workspace_id
     AND (payload ->> 'supplement_id')::UUID = v_supplement_id
     AND payload ->> 'op' = 'delete';

  IF v_event_count < 1 THEN
    RAISE EXCEPTION '[TEST A2 FAIL] Expected engine_event(payroll.recalc_triggered_by_supplement) '
      'with op=delete for supplement %, got % rows.',
      v_supplement_id, v_event_count;
  END IF;

  RAISE NOTICE '[TEST A2 PASS] manual_supplement DELETE → engine_event emitted (supplement_id=%)',
    v_supplement_id;
END $$;

ROLLBACK TO SAVEPOINT before_test_a2;


-- ─────────────────────────────────────────────────────────────────────────────
-- TEST B — change_proposal status→'applied' with kind='wage_line_override'
--           fires payroll.line_override_applied engine_event
-- ─────────────────────────────────────────────────────────────────────────────

SAVEPOINT before_test_b;

DO $$
DECLARE
  v_workspace_id UUID := current_setting('test.workspace_id')::UUID;
  v_profile_id   UUID := current_setting('test.profile_id')::UUID;
  v_period_id    UUID := current_setting('test.period_id')::UUID;
  v_calc_id      UUID := current_setting('test.calc_id')::UUID;
  v_proposal_id  UUID := gen_random_uuid();
  v_event_count  INT;
BEGIN
  -- Insert a pending wage_line_override proposal
  -- change_proposal.kind column added by 20260507110000
  INSERT INTO change_proposal (
    change_proposal_id, workspace_id, status, kind, changes,
    approval_required, initiated_by, trigger_type, trigger_entity_type,
    created_by_plane
  ) VALUES (
    v_proposal_id, v_workspace_id, 'pending', 'wage_line_override',
    jsonb_build_object(
      'calculation_id',        v_calc_id::text,
      'period_id',             v_period_id::text,
      'original_amount_cents', 200000,
      'proposed_amount_cents', 180000,
      'reason',                'Tarifftolkningsfeil i automatisk beregning',
      'category',              'tariff_interpretation'
    ),
    true, v_profile_id::text,
    'manual'::framework_trigger_type,
    'payroll_calculation', 'ai'::cascade_initiator
  );

  -- Transition status → 'applied' (Trigger B fires)
  UPDATE change_proposal
     SET status      = 'applied',
         resolved_by = v_profile_id,
         resolved_at = now()
   WHERE change_proposal_id = v_proposal_id;

  SELECT COUNT(*) INTO v_event_count
    FROM public.engine_event
   WHERE event_type = 'payroll.line_override_applied'
     AND workspace_id = v_workspace_id
     AND (payload ->> 'change_proposal_id')::UUID = v_proposal_id;

  IF v_event_count < 1 THEN
    RAISE EXCEPTION '[TEST B FAIL] Expected engine_event(payroll.line_override_applied) '
      'for proposal %, got % rows.',
      v_proposal_id, v_event_count;
  END IF;

  RAISE NOTICE '[TEST B PASS] change_proposal status→applied → engine_event emitted (proposal_id=%)',
    v_proposal_id;
END $$;

ROLLBACK TO SAVEPOINT before_test_b;


-- ─────────────────────────────────────────────────────────────────────────────
-- TEST B2 — Trigger B guard: non-wage_line_override proposal does NOT emit
-- ─────────────────────────────────────────────────────────────────────────────

SAVEPOINT before_test_b2;

DO $$
DECLARE
  v_workspace_id UUID := current_setting('test.workspace_id')::UUID;
  v_profile_id   UUID := current_setting('test.profile_id')::UUID;
  v_period_id    UUID := current_setting('test.period_id')::UUID;
  v_proposal_id  UUID := gen_random_uuid();
  v_event_count  INT;
BEGIN
  INSERT INTO change_proposal (
    change_proposal_id, workspace_id, status, kind, changes,
    approval_required, initiated_by, trigger_type, trigger_entity_type,
    created_by_plane
  ) VALUES (
    v_proposal_id, v_workspace_id, 'pending', 'shift_modification',
    jsonb_build_object('note', 'unrelated proposal'),
    true, v_profile_id::text,
    'manual'::framework_trigger_type,
    'schedule_shift', 'ai'::cascade_initiator
  );

  UPDATE change_proposal
     SET status      = 'applied',
         resolved_by = v_profile_id,
         resolved_at = now()
   WHERE change_proposal_id = v_proposal_id;

  SELECT COUNT(*) INTO v_event_count
    FROM public.engine_event
   WHERE event_type = 'payroll.line_override_applied'
     AND (payload ->> 'change_proposal_id')::UUID = v_proposal_id;

  IF v_event_count > 0 THEN
    RAISE EXCEPTION '[TEST B2 FAIL] Trigger B emitted line_override_applied for non-wage_line_override '
      'proposal % — guard is broken.', v_proposal_id;
  END IF;

  RAISE NOTICE '[TEST B2 PASS] Non-wage_line_override proposal → trigger B correctly suppressed';
END $$;

ROLLBACK TO SAVEPOINT before_test_b2;


-- ─────────────────────────────────────────────────────────────────────────────
-- TEST C — tip_distribution INSERT with status='approved' fires recalc event
-- ─────────────────────────────────────────────────────────────────────────────

SAVEPOINT before_test_c;

DO $$
DECLARE
  v_workspace_id UUID := current_setting('test.workspace_id')::UUID;
  v_profile_id   UUID := current_setting('test.profile_id')::UUID;
  v_period_id    UUID := current_setting('test.period_id')::UUID;
  v_tip_pool_id  UUID := current_setting('test.tip_pool_id')::UUID;
  v_dist_id      UUID := gen_random_uuid();
  v_event_count  INT;
BEGIN
  INSERT INTO tip_distribution (
    id, workspace_id, pool_id, profile_id, payroll_period_id,
    status, calculated_amount, hours_worked, role, weight_applied, algorithm_snapshot
  ) VALUES (
    v_dist_id, v_workspace_id, v_tip_pool_id, v_profile_id, v_period_id,
    'approved', 1500.00, 8.0, 'server', 1.0,
    jsonb_build_object('algorithm', 'hours_weighted', 'version', 1)
  );

  SELECT COUNT(*) INTO v_event_count
    FROM public.engine_event
   WHERE event_type = 'payroll.recalc_triggered_by_tip_distribution'
     AND workspace_id = v_workspace_id
     AND (payload ->> 'payroll_period_id')::UUID = v_period_id
     AND (payload ->> 'profile_id')::UUID = v_profile_id;

  IF v_event_count < 1 THEN
    RAISE EXCEPTION '[TEST C FAIL] Expected engine_event(payroll.recalc_triggered_by_tip_distribution) '
      'for distribution %, got % rows.',
      v_dist_id, v_event_count;
  END IF;

  RAISE NOTICE '[TEST C PASS] tip_distribution INSERT approved → engine_event emitted (dist_id=%)',
    v_dist_id;
END $$;

ROLLBACK TO SAVEPOINT before_test_c;


-- ─────────────────────────────────────────────────────────────────────────────
-- TEST C2 — Trigger C guard: calculated (not approved) tip_distribution does NOT emit
-- ─────────────────────────────────────────────────────────────────────────────

SAVEPOINT before_test_c2;

DO $$
DECLARE
  v_workspace_id UUID := current_setting('test.workspace_id')::UUID;
  v_profile_id   UUID := current_setting('test.profile_id')::UUID;
  v_period_id    UUID := current_setting('test.period_id')::UUID;
  v_tip_pool_id  UUID := current_setting('test.tip_pool_id')::UUID;
  v_dist_id      UUID := gen_random_uuid();
  v_event_count  INT;
BEGIN
  INSERT INTO tip_distribution (
    id, workspace_id, pool_id, profile_id, payroll_period_id,
    status, calculated_amount, hours_worked, role, weight_applied, algorithm_snapshot
  ) VALUES (
    v_dist_id, v_workspace_id, v_tip_pool_id, v_profile_id, v_period_id,
    'calculated', 500.00, 4.0, 'bartender', 0.8,
    jsonb_build_object('algorithm', 'hours_weighted', 'version', 1)
  );

  SELECT COUNT(*) INTO v_event_count
    FROM public.engine_event
   WHERE event_type = 'payroll.recalc_triggered_by_tip_distribution'
     AND (payload ->> 'tip_distribution_id')::UUID = v_dist_id;

  IF v_event_count > 0 THEN
    RAISE EXCEPTION '[TEST C2 FAIL] Trigger C emitted recalc for status=calculated '
      'distribution % — guard is broken.', v_dist_id;
  END IF;

  RAISE NOTICE '[TEST C2 PASS] tip_distribution INSERT calculated → trigger C correctly suppressed';
END $$;

ROLLBACK TO SAVEPOINT before_test_c2;


-- ─────────────────────────────────────────────────────────────────────────────
-- TEARDOWN
-- All test data was rolled back by ROLLBACK TO SAVEPOINT.
-- ROLLBACK here removes the outer transaction (setup fixtures).
-- ─────────────────────────────────────────────────────────────────────────────

ROLLBACK;
