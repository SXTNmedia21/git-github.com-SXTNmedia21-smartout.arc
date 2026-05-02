-- ============================================================================
-- supabase/tests/pgtap/employment_contract_activity_trail_trigger.sql
--
-- Migration: 20260430182443_employment_contract_activity_trail_trigger.sql
-- ADRs: 0241, 0243
--
-- Tests (3 total):
--  1. trg_employment_contract_activity_trail trigger exists on employment_contract
--  2. trg_employment_contract_activity_trail function is SECURITY DEFINER
--  3. trg_employment_contract_activity_trail function has explicit search_path (L-0172)
--
-- Note: Live INSERT/UPDATE data tests require a seeded workspace + profile, which
-- is not available in the bare pgTAP harness. Structural + metadata assertions
-- are tested here; runtime behaviour is covered by the migration apply smoke-test.
--
-- Run with:
--   psql "postgresql://postgres:postgres@localhost:54322/postgres" \
--        --set ON_ERROR_STOP=1 \
--        -f supabase/tests/pgtap/employment_contract_activity_trail_trigger.sql
-- ============================================================================

BEGIN;
SELECT plan(3);

-- ============================================================================
-- 1. Trigger exists on the table
-- ============================================================================
SELECT has_trigger(
  'public',
  'employment_contract',
  'trg_employment_contract_activity_trail',
  'Trigger trg_employment_contract_activity_trail exists on employment_contract'
);

-- ============================================================================
-- 2. Function is SECURITY DEFINER (L-0172 — closes RLS-bypass class)
-- ============================================================================
SELECT ok(
  (
    SELECT prosecdef
      FROM pg_proc
     WHERE proname = 'trg_employment_contract_activity_trail'
       AND pronamespace = 'public'::regnamespace
  ),
  'Function trg_employment_contract_activity_trail is SECURITY DEFINER'
);

-- ============================================================================
-- 3. search_path is locked to public, pg_temp (L-0172 explicit search_path)
-- ============================================================================
SELECT ok(
  (
    SELECT proconfig @> ARRAY['search_path=public, pg_temp']
      FROM pg_proc
     WHERE proname = 'trg_employment_contract_activity_trail'
       AND pronamespace = 'public'::regnamespace
  ),
  'Function search_path is locked to public, pg_temp (L-0172)'
);

SELECT * FROM finish();
ROLLBACK;
