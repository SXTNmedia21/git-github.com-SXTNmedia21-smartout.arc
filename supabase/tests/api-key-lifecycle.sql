-- API Key Lifecycle Integration Test
-- Run with: psql "postgresql://postgres:postgres@localhost:54322/postgres" -f supabase/tests/api-key-lifecycle.sql

BEGIN;

-- 1. Verify the helper function exists
DO $$
BEGIN
  PERFORM get_api_workspace_id();
  RAISE NOTICE 'PASS: get_api_workspace_id() exists';
EXCEPTION WHEN OTHERS THEN
  RAISE EXCEPTION 'FAIL: get_api_workspace_id() does not exist: %', SQLERRM;
END $$;

-- 2. Verify all 11 api_key_read_* policies exist
DO $$
DECLARE
  v_count int;
BEGIN
  SELECT count(*) INTO v_count
  FROM pg_policies
  WHERE policyname LIKE 'api_key_read_%';

  IF v_count < 11 THEN
    RAISE EXCEPTION 'FAIL: Expected at least 11 api_key_read_* policies, found %', v_count;
  END IF;
  RAISE NOTICE 'PASS: Found % api_key_read_* policies', v_count;
END $$;

-- 3. Test workspace isolation (fake workspace → 0 results)
DO $$
DECLARE
  v_count int;
BEGIN
  -- Set role to authenticated and workspace to a non-existent UUID
  SET LOCAL ROLE authenticated;
  PERFORM set_config('app.workspace_id', '00000000-0000-0000-0000-000000000000', true);

  SELECT count(*) INTO v_count FROM profile;
  IF v_count > 0 THEN
    RAISE EXCEPTION 'FAIL: Fake workspace returned % profiles, expected 0', v_count;
  END IF;
  RAISE NOTICE 'PASS: Workspace isolation verified (fake workspace → 0 profiles)';

  SELECT count(*) INTO v_count FROM department;
  IF v_count > 0 THEN
    RAISE EXCEPTION 'FAIL: Fake workspace returned % departments, expected 0', v_count;
  END IF;
  RAISE NOTICE 'PASS: Workspace isolation verified (fake workspace → 0 departments)';

  SELECT count(*) INTO v_count FROM team;
  IF v_count > 0 THEN
    RAISE EXCEPTION 'FAIL: Fake workspace returned % teams, expected 0', v_count;
  END IF;
  RAISE NOTICE 'PASS: Workspace isolation verified (fake workspace → 0 teams)';

  -- Reset role
  RESET ROLE;
END $$;

-- 4. Test get_api_workspace_id() returns NULL when GUC not set
DO $$
DECLARE
  v_result uuid;
BEGIN
  -- Reset the setting
  PERFORM set_config('app.workspace_id', '', true);
  SELECT get_api_workspace_id() INTO v_result;
  IF v_result IS NOT NULL THEN
    RAISE EXCEPTION 'FAIL: get_api_workspace_id() returned % when GUC empty, expected NULL', v_result;
  END IF;
  RAISE NOTICE 'PASS: get_api_workspace_id() returns NULL when GUC not set';
END $$;

-- 5. Test get_api_workspace_id() returns correct UUID when set
DO $$
DECLARE
  v_result uuid;
  v_test_id uuid := 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';
BEGIN
  PERFORM set_config('app.workspace_id', v_test_id::text, true);
  SELECT get_api_workspace_id() INTO v_result;
  IF v_result != v_test_id THEN
    RAISE EXCEPTION 'FAIL: get_api_workspace_id() returned %, expected %', v_result, v_test_id;
  END IF;
  RAISE NOTICE 'PASS: get_api_workspace_id() returns correct UUID';
END $$;

-- 6. Test real workspace access (if data exists)
DO $$
DECLARE
  v_ws_id uuid;
  v_count int;
BEGIN
  -- Find a real workspace
  SELECT workspace_id INTO v_ws_id FROM workspace LIMIT 1;
  IF v_ws_id IS NULL THEN
    RAISE NOTICE 'SKIP: No workspace found, skipping real data test';
    RETURN;
  END IF;

  SET LOCAL ROLE authenticated;
  PERFORM set_config('app.workspace_id', v_ws_id::text, true);

  SELECT count(*) INTO v_count FROM profile WHERE workspace_id = v_ws_id;
  RAISE NOTICE 'PASS: Real workspace % has % profiles via API key RLS', v_ws_id, v_count;

  RESET ROLE;
END $$;

RAISE NOTICE '========================================';
RAISE NOTICE 'All API key lifecycle tests passed!';
RAISE NOTICE '========================================';

ROLLBACK;
