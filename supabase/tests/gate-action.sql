-- gate_action RPC integration test (ADR-0099).
-- Run with: psql "postgresql://postgres:postgres@localhost:54322/postgres" -f supabase/tests/gate-action.sql
--
-- Covers:
--   1. Default-allow when no engine_authority_config row.
--   2. Denial when channel not in engine_process.allowed_channels.
--   3. min_role downgrade matrix (employee/manager/admin).
--   4. Disabled level denial.
--   5. Audit row written per evaluation.

BEGIN;

-- ── Setup: minimal fixtures ───────────────────
DO $$
DECLARE
  v_user_id    UUID := gen_random_uuid();
  v_company_id UUID := gen_random_uuid();
  v_workspace_id UUID := gen_random_uuid();
  v_emp_id     UUID := gen_random_uuid();
  v_mgr_id     UUID := gen_random_uuid();
  v_adm_id     UUID := gen_random_uuid();
  v_own_id     UUID := gen_random_uuid();
  v_process_id TEXT := 'gate_test_process_' || substr(gen_random_uuid()::text, 1, 8);
BEGIN
  -- Store IDs for later steps via GUC.
  PERFORM set_config('test.workspace_id', v_workspace_id::text, false);
  PERFORM set_config('test.emp_id', v_emp_id::text, false);
  PERFORM set_config('test.mgr_id', v_mgr_id::text, false);
  PERFORM set_config('test.adm_id', v_adm_id::text, false);
  PERFORM set_config('test.own_id', v_own_id::text, false);
  PERFORM set_config('test.process_id', v_process_id, false);
  PERFORM set_config('test.user_id', v_user_id::text, false);

  INSERT INTO user_identity (user_id, email)
    VALUES (v_user_id, 'gatetest+' || v_user_id || '@example.test');

  INSERT INTO company (company_id, name, created_by)
    VALUES (v_company_id, 'Gate Test Co', v_user_id);

  INSERT INTO workspace (workspace_id, company_id, name, slug, created_by)
    VALUES (v_workspace_id, v_company_id, 'Gate Test WS',
            'gate-test-' || substr(v_workspace_id::text, 1, 8), v_user_id);

  INSERT INTO profile (id, user_id, workspace_id, role, is_active, first_name, last_name)
    VALUES
      (v_emp_id, v_user_id, v_workspace_id, 'employee', true, 'Emp', 'Loyee'),
      (v_mgr_id, v_user_id, v_workspace_id, 'manager',  true, 'Man',  'Ager'),
      (v_adm_id, v_user_id, v_workspace_id, 'admin',    true, 'Adm',  'In'),
      (v_own_id, v_user_id, v_workspace_id, 'owner',    true, 'Own',  'Er');

  INSERT INTO engine_process (id, workspace_id, name, description, trigger_type, allowed_channels)
    VALUES (v_process_id, v_workspace_id, 'gate test', 'test',
            'manual', ARRAY['chat', 'system']);
END $$;

-- ── 1. Default-allow when no authority config ──
DO $$
DECLARE
  v_result JSONB;
  v_workspace_id UUID := current_setting('test.workspace_id')::uuid;
  v_emp_id UUID := current_setting('test.emp_id')::uuid;
BEGIN
  v_result := public.gate_action(v_workspace_id, 'no_such_capability', 'chat', v_emp_id, 'update_entity');
  IF NOT (v_result->>'allow')::boolean THEN
    RAISE EXCEPTION 'FAIL: default-allow expected true, got %', v_result;
  END IF;
  RAISE NOTICE 'PASS: default-allow when no authority config';
END $$;

-- ── 2. Channel denial when not in allowed_channels ──
DO $$
DECLARE
  v_result JSONB;
  v_workspace_id UUID := current_setting('test.workspace_id')::uuid;
  v_emp_id UUID := current_setting('test.emp_id')::uuid;
  v_process_id TEXT := current_setting('test.process_id');
BEGIN
  -- allowed_channels = {chat, system}; 'voice' must be denied.
  v_result := public.gate_action(
    v_workspace_id, 'scheduling', 'voice', v_emp_id, 'send_notification', v_process_id
  );
  IF (v_result->>'allow')::boolean THEN
    RAISE EXCEPTION 'FAIL: voice should be denied, got %', v_result;
  END IF;
  IF v_result->>'reason' != 'channel_not_permitted' THEN
    RAISE EXCEPTION 'FAIL: expected reason=channel_not_permitted, got %', v_result->>'reason';
  END IF;
  RAISE NOTICE 'PASS: channel denial when not in allowed_channels';
END $$;

-- ── 3a. min_role downgrade: employee below manager-required cap ──
DO $$
DECLARE
  v_result JSONB;
  v_workspace_id UUID := current_setting('test.workspace_id')::uuid;
  v_emp_id UUID := current_setting('test.emp_id')::uuid;
  v_user_id UUID := current_setting('test.user_id')::uuid;
BEGIN
  INSERT INTO engine_authority_config (workspace_id, capability, level, min_role, updated_by)
    VALUES (v_workspace_id, 'cap_requires_manager', 'autonomous', 'manager', v_user_id);

  v_result := public.gate_action(v_workspace_id, 'cap_requires_manager', 'chat', v_emp_id, 'update_entity');
  IF NOT (v_result->>'allow')::boolean THEN
    RAISE EXCEPTION 'FAIL: employee should be allowed but downgraded, got %', v_result;
  END IF;
  IF v_result->>'downgrade_to' != 'suggest' THEN
    RAISE EXCEPTION 'FAIL: expected downgrade_to=suggest for employee, got %', v_result->>'downgrade_to';
  END IF;
  RAISE NOTICE 'PASS: employee below manager-floor is downgraded to suggest';
END $$;

-- ── 3b. min_role not triggered for admin on manager-required cap ──
DO $$
DECLARE
  v_result JSONB;
  v_workspace_id UUID := current_setting('test.workspace_id')::uuid;
  v_adm_id UUID := current_setting('test.adm_id')::uuid;
BEGIN
  v_result := public.gate_action(v_workspace_id, 'cap_requires_manager', 'chat', v_adm_id, 'update_entity');
  IF NOT (v_result->>'allow')::boolean THEN
    RAISE EXCEPTION 'FAIL: admin should be allowed, got %', v_result;
  END IF;
  IF v_result->>'downgrade_to' IS NOT NULL THEN
    RAISE EXCEPTION 'FAIL: admin should not be downgraded, got %', v_result->>'downgrade_to';
  END IF;
  RAISE NOTICE 'PASS: admin passes manager-floor without downgrade';
END $$;

-- ── 4. Disabled level denies ──
DO $$
DECLARE
  v_result JSONB;
  v_workspace_id UUID := current_setting('test.workspace_id')::uuid;
  v_own_id UUID := current_setting('test.own_id')::uuid;
  v_user_id UUID := current_setting('test.user_id')::uuid;
BEGIN
  INSERT INTO engine_authority_config (workspace_id, capability, level, min_role, updated_by)
    VALUES (v_workspace_id, 'cap_disabled', 'disabled', 'employee', v_user_id);

  v_result := public.gate_action(v_workspace_id, 'cap_disabled', 'chat', v_own_id, 'update_entity');
  IF (v_result->>'allow')::boolean THEN
    RAISE EXCEPTION 'FAIL: disabled capability should deny even for owner, got %', v_result;
  END IF;
  IF v_result->>'reason' != 'capability_disabled' THEN
    RAISE EXCEPTION 'FAIL: expected reason=capability_disabled, got %', v_result->>'reason';
  END IF;
  RAISE NOTICE 'PASS: disabled level denies';
END $$;

-- ── 5. Audit row written per evaluation ──
DO $$
DECLARE
  v_count INT;
  v_workspace_id UUID := current_setting('test.workspace_id')::uuid;
BEGIN
  SELECT count(*) INTO v_count
    FROM public.gate_evaluation
   WHERE workspace_id = v_workspace_id;
  IF v_count < 5 THEN
    RAISE EXCEPTION 'FAIL: expected >=5 audit rows for this workspace, got %', v_count;
  END IF;
  RAISE NOTICE 'PASS: audit rows persisted (% rows)', v_count;
END $$;

ROLLBACK;
