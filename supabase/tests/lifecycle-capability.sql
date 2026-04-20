-- Lifecycle capability integration test (ADR-0095 Phase 5, ADR-0098).
-- Run with: psql "postgresql://postgres:postgres@localhost:54322/postgres" -f supabase/tests/lifecycle-capability.sql
--
-- Covers:
--   1. v_shift_lifecycle phase='planlegges' for published shift with no punch.
--   2. v_shift_lifecycle phase='pagar' for shift with punch_in but no punch_out.
--   3. v_shift_lifecycle phase='oppgjor' for punched-out shift awaiting approval.
--   4. v_shift_lifecycle phase='avsluttet' for fully reconciled shift.
--   5. archive_completed_engine_states moves old complete rows, leaves recent ones.
--   6. archive_completed_engine_states preserves 3 spot-checked columns.
--   7. has_blocking_deviation reflects linked deviation rows correctly.

BEGIN;

-- ── Setup: minimal fixtures ───────────────────
DO $$
DECLARE
  v_user_id      UUID := gen_random_uuid();
  v_company_id   UUID := gen_random_uuid();
  v_workspace_id UUID := gen_random_uuid();
  v_dept_id      UUID := gen_random_uuid();
  v_emp_id       UUID := gen_random_uuid();
BEGIN
  PERFORM set_config('test.workspace_id', v_workspace_id::text, false);
  PERFORM set_config('test.dept_id',      v_dept_id::text,      false);
  PERFORM set_config('test.emp_id',       v_emp_id::text,       false);
  PERFORM set_config('test.user_id',      v_user_id::text,      false);

  INSERT INTO auth.users (id, email, aud, role, instance_id)
    VALUES (v_user_id, 'cap+' || v_user_id || '@example.test',
            'authenticated', 'authenticated', '00000000-0000-0000-0000-000000000000');

  INSERT INTO company (company_id, name)
    VALUES (v_company_id, 'Capability Test Co');

  INSERT INTO workspace (workspace_id, company_id, name, slug)
    VALUES (v_workspace_id, v_company_id, 'Capability Test WS',
            'cap-' || substr(v_workspace_id::text, 1, 8));

  INSERT INTO department (department_id, workspace_id, name, slug)
    VALUES (v_dept_id, v_workspace_id, 'Kitchen',
            'kitchen-' || substr(v_dept_id::text, 1, 8));

  INSERT INTO profile (profile_id, profile_code, user_id, workspace_id, role, is_active, display_name)
    VALUES (v_emp_id, 'cap-emp-' || substr(v_emp_id::text, 1, 8),
            v_user_id, v_workspace_id, 'employee', true, 'Cap Emp');
END $$;

-- Helper: create a shift in the fixture workspace/department/employee.
CREATE OR REPLACE FUNCTION pg_temp.mk_shift(
  p_date DATE, p_start TIME, p_end TIME, p_status shift_status DEFAULT 'published'
)
RETURNS UUID LANGUAGE plpgsql AS $$
DECLARE
  v_shift_id UUID := gen_random_uuid();
BEGIN
  INSERT INTO schedule_shift (
    schedule_shift_id, workspace_id, department_id, employee_id,
    shift_date, role, start_time, end_time, work_hours, day_category, status, is_published
  ) VALUES (
    v_shift_id,
    current_setting('test.workspace_id')::uuid,
    current_setting('test.dept_id')::uuid,
    current_setting('test.emp_id')::uuid,
    p_date, 'cook', p_start, p_end, 8.0, 'morning'::day_category, p_status,
    p_status = 'published' OR p_status = 'active' OR p_status = 'completed'
  );
  RETURN v_shift_id;
END $$;

-- ── 1. phase='planlegges' for published, unpunched shift ──
DO $$
DECLARE
  v_shift_id UUID;
  v_phase TEXT;
BEGIN
  v_shift_id := pg_temp.mk_shift(DATE '2026-05-01', TIME '09:00', TIME '17:00', 'published');
  SELECT phase INTO v_phase FROM public.v_shift_lifecycle WHERE shift_id = v_shift_id;
  IF v_phase IS DISTINCT FROM 'planlegges' THEN
    RAISE EXCEPTION 'FAIL 1: expected phase=planlegges, got %', v_phase;
  END IF;
  RAISE NOTICE 'PASS 1: published + no punch → planlegges';
END $$;

-- ── 2. phase='pagar' for shift with punch_in but no punch_out ──
DO $$
DECLARE
  v_shift_id UUID;
  v_phase TEXT;
BEGIN
  v_shift_id := pg_temp.mk_shift(DATE '2026-05-02', TIME '09:00', TIME '17:00', 'active');
  INSERT INTO timesheet.time_entry (
    shift_id, profile_id, workspace_id, punch_in, punch_out, status
  ) VALUES (
    v_shift_id,
    current_setting('test.emp_id')::uuid,
    current_setting('test.workspace_id')::uuid,
    '2026-05-02 09:00:00+02'::timestamptz, NULL, 'clocked_in'
  );
  SELECT phase INTO v_phase FROM public.v_shift_lifecycle WHERE shift_id = v_shift_id;
  IF v_phase IS DISTINCT FROM 'pagar' THEN
    RAISE EXCEPTION 'FAIL 2: expected phase=pagar, got %', v_phase;
  END IF;
  RAISE NOTICE 'PASS 2: punched in, no out → pagar';
END $$;

-- ── 3. phase='oppgjor' for punched-out shift awaiting approval ──
DO $$
DECLARE
  v_shift_id UUID;
  v_phase TEXT;
BEGIN
  v_shift_id := pg_temp.mk_shift(DATE '2026-05-03', TIME '09:00', TIME '17:00', 'completed');
  INSERT INTO timesheet.time_entry (
    shift_id, profile_id, workspace_id, punch_in, punch_out, status
  ) VALUES (
    v_shift_id,
    current_setting('test.emp_id')::uuid,
    current_setting('test.workspace_id')::uuid,
    '2026-05-03 09:00:00+02'::timestamptz,
    '2026-05-03 17:00:00+02'::timestamptz,
    'completed'
  );
  SELECT phase INTO v_phase FROM public.v_shift_lifecycle WHERE shift_id = v_shift_id;
  IF v_phase IS DISTINCT FROM 'oppgjor' THEN
    RAISE EXCEPTION 'FAIL 3: expected phase=oppgjor, got %', v_phase;
  END IF;
  RAISE NOTICE 'PASS 3: punched out, no approval → oppgjor';
END $$;

-- ── 4. phase='avsluttet' for fully reconciled shift ──
DO $$
DECLARE
  v_shift_id UUID;
  v_recon_id UUID;
  v_approval_id UUID := gen_random_uuid();
  v_phase TEXT;
BEGIN
  v_shift_id := pg_temp.mk_shift(DATE '2026-05-04', TIME '09:00', TIME '17:00', 'completed');
  INSERT INTO timesheet.time_entry (
    shift_id, profile_id, workspace_id, punch_in, punch_out, status
  ) VALUES (
    v_shift_id,
    current_setting('test.emp_id')::uuid,
    current_setting('test.workspace_id')::uuid,
    '2026-05-04 09:00:00+02'::timestamptz,
    '2026-05-04 17:00:00+02'::timestamptz,
    'completed'
  );
  INSERT INTO daily_reconciliation (
    reconciliation_id, workspace_id, department_id, reconciliation_date, status
  ) VALUES (
    gen_random_uuid(),
    current_setting('test.workspace_id')::uuid,
    current_setting('test.dept_id')::uuid,
    DATE '2026-05-04', 'approved'
  ) RETURNING reconciliation_id INTO v_recon_id;

  INSERT INTO shift_approval (
    approval_id, reconciliation_id, shift_id, workspace_id,
    planned_hours, calculated_hours, approved_hours, status
  ) VALUES (
    v_approval_id, v_recon_id, v_shift_id,
    current_setting('test.workspace_id')::uuid,
    8.0, 8.0, 8.0, 'approved'
  );

  SELECT phase INTO v_phase FROM public.v_shift_lifecycle WHERE shift_id = v_shift_id;
  IF v_phase IS DISTINCT FROM 'avsluttet' THEN
    RAISE EXCEPTION 'FAIL 4: expected phase=avsluttet, got %', v_phase;
  END IF;
  RAISE NOTICE 'PASS 4: reconciliation approved → avsluttet';
END $$;

-- ── 5. Archive function: moves old complete rows, leaves recent ones ──
DO $$
DECLARE
  v_workspace_id UUID := current_setting('test.workspace_id')::uuid;
  v_old_id    UUID := gen_random_uuid();
  v_recent_id UUID := gen_random_uuid();
  v_moved INTEGER;
  v_in_live_old INT;
  v_in_live_recent INT;
  v_in_arch_old INT;
BEGIN
  -- Seed the engine_process that engine_state references (unique per run).
  INSERT INTO engine_process (id, name, description)
    VALUES ('archive_test_proc', 'Archive Test', 'fixture')
    ON CONFLICT (id) DO NOTHING;

  INSERT INTO engine_state (id, process_id, workspace_id, status, updated_at, started_at)
    VALUES (v_old_id, 'archive_test_proc', v_workspace_id, 'complete',
            now() - INTERVAL '60 days', now() - INTERVAL '61 days');
  INSERT INTO engine_state (id, process_id, workspace_id, status, updated_at, started_at)
    VALUES (v_recent_id, 'archive_test_proc', v_workspace_id, 'complete',
            now() - INTERVAL '5 days', now() - INTERVAL '6 days');

  v_moved := public.archive_completed_engine_states(30);

  SELECT count(*) INTO v_in_live_old     FROM engine_state WHERE id = v_old_id;
  SELECT count(*) INTO v_in_live_recent  FROM engine_state WHERE id = v_recent_id;
  SELECT count(*) INTO v_in_arch_old     FROM engine_state_archive WHERE id = v_old_id;

  IF v_in_live_old != 0 THEN
    RAISE EXCEPTION 'FAIL 5: old row should be archived but still in engine_state';
  END IF;
  IF v_in_live_recent != 1 THEN
    RAISE EXCEPTION 'FAIL 5: recent row should remain in engine_state, count=%', v_in_live_recent;
  END IF;
  IF v_in_arch_old != 1 THEN
    RAISE EXCEPTION 'FAIL 5: old row should be in engine_state_archive, count=%', v_in_arch_old;
  END IF;
  RAISE NOTICE 'PASS 5: archive moved old (moved=%), left recent', v_moved;

  PERFORM set_config('test.archive_id', v_old_id::text, false);
END $$;

-- ── 6. Archive preserves columns (spot check 3: process_id, workspace_id, status) ──
DO $$
DECLARE
  v_arch engine_state_archive%ROWTYPE;
  v_archive_id UUID := current_setting('test.archive_id')::uuid;
BEGIN
  SELECT * INTO v_arch FROM engine_state_archive WHERE id = v_archive_id;
  IF v_arch.process_id IS DISTINCT FROM 'archive_test_proc' THEN
    RAISE EXCEPTION 'FAIL 6: process_id not preserved, got %', v_arch.process_id;
  END IF;
  IF v_arch.workspace_id IS DISTINCT FROM current_setting('test.workspace_id')::uuid THEN
    RAISE EXCEPTION 'FAIL 6: workspace_id not preserved';
  END IF;
  IF v_arch.status IS DISTINCT FROM 'complete' THEN
    RAISE EXCEPTION 'FAIL 6: status not preserved, got %', v_arch.status;
  END IF;
  IF v_arch.archived_at IS NULL THEN
    RAISE EXCEPTION 'FAIL 6: archived_at should be set';
  END IF;
  RAISE NOTICE 'PASS 6: archive preserves process_id/workspace_id/status + sets archived_at';
END $$;

-- ── 7. has_blocking_deviation reflects deviation rows correctly ──
DO $$
DECLARE
  v_shift_id UUID;
  v_session_id UUID := gen_random_uuid();
  v_has_dev BOOLEAN;
  v_has_blocking BOOLEAN;
BEGIN
  v_shift_id := pg_temp.mk_shift(DATE '2026-05-05', TIME '09:00', TIME '17:00', 'completed');

  INSERT INTO department_session (
    department_session_id, workspace_id, department_id, session_date, status
  ) VALUES (
    v_session_id,
    current_setting('test.workspace_id')::uuid,
    current_setting('test.dept_id')::uuid,
    DATE '2026-05-05', 'closed'
  );

  INSERT INTO deviation (
    deviation_id, workspace_id, session_id, domain, severity, status, title, description
  ) VALUES (
    gen_random_uuid(),
    current_setting('test.workspace_id')::uuid,
    v_session_id, 'procedure', 'medium', 'open', 'test deviation', 'test deviation body'
  );

  SELECT has_deviation, has_blocking_deviation
    INTO v_has_dev, v_has_blocking
    FROM public.v_shift_lifecycle
   WHERE shift_id = v_shift_id;

  IF v_has_dev IS NOT TRUE THEN
    RAISE EXCEPTION 'FAIL 7: expected has_deviation=true, got %', v_has_dev;
  END IF;
  IF v_has_blocking IS NOT TRUE THEN
    RAISE EXCEPTION 'FAIL 7: expected has_blocking_deviation=true, got %', v_has_blocking;
  END IF;
  RAISE NOTICE 'PASS 7: deviation correctly surfaces as blocking';
END $$;

ROLLBACK;
