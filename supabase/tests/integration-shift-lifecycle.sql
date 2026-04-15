-- Integration test — full shift-lifecycle provenance flow (PLAN WS-B5).
--
-- End-to-end causal chain from shift create → publish → punch → interpret →
-- snapshot → approve → reconcile. Asserts every derived layer has a row with
-- correct `workspace_id` scope and provenance columns populated (per cascade
-- invariant #8 — "derived data must trace back to its source rows").
--
-- Scope: DB-observable layers only. The engine-dispatch Edge Function side
-- (event → engine_state spawn) is tested by `punch-out-trigger-dispatch.sql`
-- (WS-A2). This file takes over at "engine_event exists" and walks the
-- derivation/settlement chain that runs as DB RPCs.
--
-- Run with:
--   psql "postgresql://postgres:postgres@localhost:54322/postgres" \
--        -f supabase/tests/integration-shift-lifecycle.sql
--
-- Also registered in the pgTAP CI workflow (WS-B3, .github/workflows/pgtap.yml).

BEGIN;

-- ── Setup: workspace, department, profile, payroll, tariff ────────────
DO $$
DECLARE
  v_user_id       UUID := gen_random_uuid();
  v_company_id   UUID := gen_random_uuid();
  v_workspace_id UUID := gen_random_uuid();
  v_dept_id      UUID := gen_random_uuid();
  v_emp_id       UUID := gen_random_uuid();
  v_tariff_id    UUID := gen_random_uuid();
BEGIN
  PERFORM set_config('test.workspace_id', v_workspace_id::text, false);
  PERFORM set_config('test.dept_id',      v_dept_id::text,      false);
  PERFORM set_config('test.emp_id',       v_emp_id::text,       false);
  PERFORM set_config('test.user_id',      v_user_id::text,      false);
  PERFORM set_config('test.tariff_id',    v_tariff_id::text,    false);

  INSERT INTO auth.users (id, email, aud, role, instance_id)
    VALUES (v_user_id, 'lifecycle+' || v_user_id || '@example.test',
            'authenticated', 'authenticated', '00000000-0000-0000-0000-000000000000');

  INSERT INTO company (company_id, name)
    VALUES (v_company_id, 'Lifecycle Integration Co');

  INSERT INTO workspace (workspace_id, company_id, name, slug)
    VALUES (v_workspace_id, v_company_id, 'Lifecycle Test WS',
            'lc-' || substr(v_workspace_id::text, 1, 8));

  INSERT INTO department (department_id, workspace_id, name, slug)
    VALUES (v_dept_id, v_workspace_id, 'Bar',
            'bar-' || substr(v_dept_id::text, 1, 8));

  INSERT INTO profile (profile_id, profile_code, user_id, workspace_id,
                       role, is_active, display_name)
    VALUES (v_emp_id,
            'lc-emp-' || substr(v_emp_id::text, 1, 8),
            v_user_id, v_workspace_id, 'employee', true, 'Lifecycle Emp');

  INSERT INTO tariff_rate_table (id, workspace_id, rate_type, source,
                                 effective_from, amount, unit)
    VALUES (v_tariff_id, NULL, 'lc_test_hourly', 'riksavtalen',
            '2026-01-01', 250.00, 'kr/t');

  INSERT INTO employee_payroll_profile (
    workspace_id, profile_id, salary_type, agreed_weekly_hours,
    tariff_category, seniority_start_date, tariff_override_id, valid_from
  ) VALUES (
    v_workspace_id, v_emp_id, 'hourly', 37.5,
    'lc_test_hourly', '2020-01-01', v_tariff_id, '2026-01-01'
  );
END $$;

-- ── 1. Create shift (schedule_shift row, status=draft) ────────────────
DO $$
DECLARE
  v_shift_id     UUID := gen_random_uuid();
  v_workspace_id UUID := current_setting('test.workspace_id')::uuid;
  v_dept_id      UUID := current_setting('test.dept_id')::uuid;
  v_emp_id       UUID := current_setting('test.emp_id')::uuid;
  v_row          schedule_shift%ROWTYPE;
BEGIN
  INSERT INTO schedule_shift (
    schedule_shift_id, workspace_id, department_id, employee_id,
    shift_date, role, start_time, end_time, work_hours,
    day_category, status
  ) VALUES (
    v_shift_id, v_workspace_id, v_dept_id, v_emp_id,
    DATE '2030-06-14', 'bartender',
    TIME '16:00', TIME '23:00', 7.0,
    'evening', 'created'
  );

  SELECT * INTO v_row FROM schedule_shift WHERE schedule_shift_id = v_shift_id;
  IF v_row.workspace_id <> v_workspace_id THEN
    RAISE EXCEPTION 'FAIL 1: shift workspace_id mismatch';
  END IF;
  IF v_row.status <> 'created' THEN
    RAISE EXCEPTION 'FAIL 1: expected status=created, got %', v_row.status;
  END IF;

  PERFORM set_config('test.shift_id', v_shift_id::text, false);
  RAISE NOTICE 'PASS 1: shift created (id=%, workspace_id=%)', v_shift_id, v_workspace_id;
END $$;

-- ── 2. Publish shift (status → 'published') ───────────────────────────
DO $$
DECLARE
  v_shift_id UUID := current_setting('test.shift_id')::uuid;
  v_status   TEXT;
BEGIN
  UPDATE schedule_shift
     SET status = 'published', updated_at = now()
   WHERE schedule_shift_id = v_shift_id;

  SELECT status::text INTO v_status
    FROM schedule_shift WHERE schedule_shift_id = v_shift_id;

  IF v_status <> 'published' THEN
    RAISE EXCEPTION 'FAIL 2: expected status=published, got %', v_status;
  END IF;
  RAISE NOTICE 'PASS 2: shift published';
END $$;

-- ── 3. Insert time_entry (punch in + out, completed) ──────────────────
DO $$
DECLARE
  v_shift_id     UUID := current_setting('test.shift_id')::uuid;
  v_emp_id       UUID := current_setting('test.emp_id')::uuid;
  v_workspace_id UUID := current_setting('test.workspace_id')::uuid;
  v_entry_id     UUID := gen_random_uuid();
  v_te           timesheet.time_entry%ROWTYPE;
BEGIN
  INSERT INTO timesheet.time_entry (
    time_entry_id, shift_id, profile_id, workspace_id,
    punch_in, punch_out, status
  ) VALUES (
    v_entry_id, v_shift_id, v_emp_id, v_workspace_id,
    '2030-06-14 16:00:00+02'::timestamptz,
    '2030-06-14 23:00:00+02'::timestamptz,
    'completed'
  );

  SELECT * INTO v_te FROM timesheet.time_entry WHERE time_entry_id = v_entry_id;
  IF v_te.workspace_id <> v_workspace_id THEN
    RAISE EXCEPTION 'FAIL 3: time_entry workspace_id mismatch';
  END IF;
  IF v_te.punch_out IS NULL THEN
    RAISE EXCEPTION 'FAIL 3: expected punch_out set';
  END IF;

  PERFORM set_config('test.time_entry_id', v_entry_id::text, false);
  RAISE NOTICE 'PASS 3: time_entry inserted (id=%)', v_entry_id;
END $$;

-- ── 4. Emit `shift punched_out` event → engine_event row ──────────────
-- Simulates what the telemetry `emit()` → engine-dispatch Edge Function writes.
DO $$
DECLARE
  v_shift_id     UUID := current_setting('test.shift_id')::uuid;
  v_workspace_id UUID := current_setting('test.workspace_id')::uuid;
  v_event_id     UUID := gen_random_uuid();
  v_row          engine_event%ROWTYPE;
BEGIN
  INSERT INTO engine_event (
    id, event_type, payload, workspace_id, fired_at
  ) VALUES (
    v_event_id, 'shift.punched_out',
    jsonb_build_object('shift_id', v_shift_id),
    v_workspace_id, now()
  );

  SELECT * INTO v_row FROM engine_event WHERE id = v_event_id;
  IF v_row.workspace_id <> v_workspace_id THEN
    RAISE EXCEPTION 'FAIL 4: engine_event workspace_id mismatch';
  END IF;
  IF v_row.payload->>'shift_id' <> v_shift_id::text THEN
    RAISE EXCEPTION 'FAIL 4: engine_event payload.shift_id provenance missing';
  END IF;

  PERFORM set_config('test.event_id', v_event_id::text, false);
  RAISE NOTICE 'PASS 4: engine_event emitted (event_type=shift.punched_out, id=%)', v_event_id;
END $$;

-- ── 5. Assert engine_trigger routes shift.punched_out → shift_lifecycle_v1 ──
-- (engine_state spawn itself is tested in punch-out-trigger-dispatch.sql.)
DO $$
DECLARE
  v_trigger_id UUID;
  v_active     BOOLEAN;
BEGIN
  SELECT id, is_active INTO v_trigger_id, v_active
    FROM engine_trigger
   WHERE event_type = 'shift.punched_out'
     AND process_id = 'shift_lifecycle_v1'
   LIMIT 1;

  IF v_trigger_id IS NULL THEN
    RAISE EXCEPTION 'FAIL 5: no active trigger shift.punched_out → shift_lifecycle_v1';
  END IF;
  IF NOT v_active THEN
    RAISE EXCEPTION 'FAIL 5: trigger exists but is_active=false';
  END IF;

  RAISE NOTICE 'PASS 5: shift_lifecycle_v1 dispatch path wired';
END $$;

-- ── 6. derive_shift_hours → shift_hour_interpretation with provenance ──
DO $$
DECLARE
  v_shift_id     UUID := current_setting('test.shift_id')::uuid;
  v_te_id        UUID := current_setting('test.time_entry_id')::uuid;
  v_workspace_id UUID := current_setting('test.workspace_id')::uuid;
  v_interp_id    UUID;
  v_interp       shift_hour_interpretation%ROWTYPE;
BEGIN
  v_interp_id := public.derive_shift_hours(v_shift_id);
  SELECT * INTO v_interp
    FROM shift_hour_interpretation
   WHERE interpretation_id = v_interp_id;

  IF v_interp.workspace_id <> v_workspace_id THEN
    RAISE EXCEPTION 'FAIL 6: interpretation workspace_id mismatch';
  END IF;
  IF v_interp.total_interpreted_hours <= 0 THEN
    RAISE EXCEPTION 'FAIL 6: expected total>0, got %', v_interp.total_interpreted_hours;
  END IF;

  -- Provenance: time_entry_ids[] must contain the originating time_entry.
  IF v_interp.time_entry_ids IS NULL
     OR NOT (v_te_id = ANY (v_interp.time_entry_ids)) THEN
    RAISE EXCEPTION 'FAIL 6: time_entry_ids provenance missing %, got %',
      v_te_id, v_interp.time_entry_ids;
  END IF;

  -- Provenance: framework_rule_ids[] must be populated (even if empty the col
  -- must exist as an array — we assert it is NOT NULL so future rules land).
  IF v_interp.framework_rule_ids IS NULL THEN
    RAISE EXCEPTION 'FAIL 6: framework_rule_ids column must be NOT NULL (can be empty array)';
  END IF;

  PERFORM set_config('test.interp_id', v_interp_id::text, false);
  RAISE NOTICE 'PASS 6: derive_shift_hours → interpretation (id=%, total=%, provenance ok)',
    v_interp_id, v_interp.total_interpreted_hours;
END $$;

-- ── 7. snapshot_shift_cost → shift_cost_snapshot with tariff provenance ──
DO $$
DECLARE
  v_interp_id UUID := current_setting('test.interp_id')::uuid;
  v_snap_id   UUID;
  v_snap      shift_cost_snapshot%ROWTYPE;
BEGIN
  v_snap_id := public.snapshot_shift_cost(v_interp_id);
  SELECT * INTO v_snap FROM shift_cost_snapshot WHERE id = v_snap_id;

  IF v_snap.interpretation_id <> v_interp_id THEN
    RAISE EXCEPTION 'FAIL 7: snapshot interpretation_id FK wrong';
  END IF;
  IF v_snap.gross_cost IS NULL OR v_snap.gross_cost <= 0 THEN
    RAISE EXCEPTION 'FAIL 7: expected gross_cost>0, got %', v_snap.gross_cost;
  END IF;

  -- Provenance: tariff_rate_snapshot JSONB must capture the rate used (point-in-time).
  IF v_snap.tariff_rate_snapshot IS NULL
     OR (v_snap.tariff_rate_snapshot->>'base_rate') IS NULL THEN
    RAISE EXCEPTION 'FAIL 7: tariff_rate_snapshot missing base_rate provenance, got %',
      v_snap.tariff_rate_snapshot;
  END IF;
  IF (v_snap.tariff_rate_snapshot->>'base_rate')::numeric <> 250.00 THEN
    RAISE EXCEPTION 'FAIL 7: expected base_rate=250.00 (from tariff), got %',
      v_snap.tariff_rate_snapshot->>'base_rate';
  END IF;

  PERFORM set_config('test.snap_id', v_snap_id::text, false);
  RAISE NOTICE 'PASS 7: snapshot_shift_cost → cost=% (tariff snapshot locked)',
    v_snap.gross_cost;
END $$;

-- ── 8. daily_reconciliation + shift_approval with provenance FKs ──────
DO $$
DECLARE
  v_shift_id     UUID := current_setting('test.shift_id')::uuid;
  v_workspace_id UUID := current_setting('test.workspace_id')::uuid;
  v_dept_id      UUID := current_setting('test.dept_id')::uuid;
  v_recon_id     UUID := gen_random_uuid();
  v_approval_id  UUID := gen_random_uuid();
  v_approval     shift_approval%ROWTYPE;
BEGIN
  INSERT INTO daily_reconciliation (
    reconciliation_id, workspace_id, department_id, reconciliation_date, status
  ) VALUES (
    v_recon_id, v_workspace_id, v_dept_id, DATE '2030-06-14', 'open'
  );

  INSERT INTO shift_approval (
    approval_id, reconciliation_id, shift_id, workspace_id,
    planned_hours, calculated_hours, approved_hours, status
  ) VALUES (
    v_approval_id, v_recon_id, v_shift_id, v_workspace_id,
    7.0, 7.0, 7.0, 'approved'
  );

  SELECT * INTO v_approval FROM shift_approval WHERE approval_id = v_approval_id;
  IF v_approval.workspace_id <> v_workspace_id THEN
    RAISE EXCEPTION 'FAIL 8: shift_approval workspace_id mismatch';
  END IF;
  IF v_approval.reconciliation_id <> v_recon_id THEN
    RAISE EXCEPTION 'FAIL 8: shift_approval → reconciliation FK missing';
  END IF;
  IF v_approval.shift_id <> v_shift_id THEN
    RAISE EXCEPTION 'FAIL 8: shift_approval → shift FK missing';
  END IF;

  PERFORM set_config('test.recon_id', v_recon_id::text, false);
  RAISE NOTICE 'PASS 8: shift_approval approved (FKs to recon + shift ok)';
END $$;

-- ── 9. daily_close transition → reconciliation approved ───────────────
DO $$
DECLARE
  v_recon_id UUID := current_setting('test.recon_id')::uuid;
  v_emp_id   UUID := current_setting('test.emp_id')::uuid;
  v_status   TEXT;
BEGIN
  UPDATE daily_reconciliation
     SET status     = 'approved',
         approved_by = v_emp_id,
         approved_at = now(),
         updated_at  = now()
   WHERE reconciliation_id = v_recon_id;

  SELECT status::text INTO v_status
    FROM daily_reconciliation WHERE reconciliation_id = v_recon_id;

  IF v_status <> 'approved' THEN
    RAISE EXCEPTION 'FAIL 9: expected reconciliation status=approved, got %', v_status;
  END IF;
  RAISE NOTICE 'PASS 9: daily_reconciliation final state = approved';
END $$;

-- ── 10. Full-chain workspace-scope assertion ──────────────────────────
-- Every derived row across the lifecycle must share `workspace_id` with the shift.
DO $$
DECLARE
  v_shift_id     UUID := current_setting('test.shift_id')::uuid;
  v_workspace_id UUID := current_setting('test.workspace_id')::uuid;
  v_cross_scope  INT;
BEGIN
  WITH lifecycle_rows AS (
    SELECT workspace_id FROM schedule_shift      WHERE schedule_shift_id  = v_shift_id
    UNION ALL
    SELECT workspace_id FROM timesheet.time_entry WHERE shift_id           = v_shift_id
    UNION ALL
    SELECT workspace_id FROM shift_hour_interpretation
      WHERE shift_id = v_shift_id
    UNION ALL
    SELECT sc.workspace_id FROM shift_cost_snapshot sc
      JOIN shift_hour_interpretation shi
        ON shi.interpretation_id = sc.interpretation_id
     WHERE shi.shift_id = v_shift_id
    UNION ALL
    SELECT workspace_id FROM shift_approval      WHERE shift_id           = v_shift_id
  )
  SELECT count(*) INTO v_cross_scope
    FROM lifecycle_rows
   WHERE workspace_id <> v_workspace_id;

  IF v_cross_scope > 0 THEN
    RAISE EXCEPTION 'FAIL 10: % lifecycle rows leaked across workspace boundary', v_cross_scope;
  END IF;
  RAISE NOTICE 'PASS 10: all lifecycle rows scoped to workspace_id=%', v_workspace_id;
END $$;

ROLLBACK;
