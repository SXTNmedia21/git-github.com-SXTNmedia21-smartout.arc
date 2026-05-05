-- ============================================================================
-- supabase/tests/pgtap/billing_settlement/helpers.spec.sql
--
-- Verifies settlement helper functions exist with correct properties.
-- Catalog-only checks — no live data inserts.
--
-- Tests (12 total):
--   1.    billing.lock_settlement_period function exists
--   2.    lock_settlement_period is SECURITY DEFINER
--   3.    lock_settlement_period return type is uuid
--   4.    lock_settlement_period GRANT to authenticated exists
--   5.    billing.compute_period_aggregates function exists
--   6.    compute_period_aggregates is SECURITY DEFINER
--   7.    compute_period_aggregates return type is jsonb
--   8.    compute_period_aggregates GRANT to authenticated exists
--   9.    billing.list_unsettled_workspaces function exists
--   10.   list_unsettled_workspaces is SECURITY DEFINER
--   11.   list_unsettled_workspaces returns a set (TABLE return)
--   12.   list_unsettled_workspaces GRANT to authenticated exists
--
-- ============================================================================

BEGIN;
SELECT plan(12);

-- ── 1. billing.lock_settlement_period function exists ────────────────────────
SELECT has_function(
  'billing', 'lock_settlement_period', ARRAY['uuid', 'date', 'date'],
  'billing.lock_settlement_period(uuid, date, date) function exists'
);

-- ── 2. lock_settlement_period is SECURITY DEFINER ────────────────────────────
SELECT ok(
  EXISTS (
    SELECT 1
      FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE p.proname   = 'lock_settlement_period'
       AND n.nspname   = 'billing'
       AND p.prosecdef = true
  ),
  'billing.lock_settlement_period is SECURITY DEFINER'
);

-- ── 3. lock_settlement_period return type is uuid ─────────────────────────────
SELECT ok(
  EXISTS (
    SELECT 1
      FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
      JOIN pg_type t      ON t.oid = p.prorettype
     WHERE p.proname = 'lock_settlement_period'
       AND n.nspname = 'billing'
       AND t.typname = 'uuid'
  ),
  'billing.lock_settlement_period return type is uuid'
);

-- ── 4. lock_settlement_period GRANT to authenticated ─────────────────────────
SELECT ok(
  EXISTS (
    SELECT 1
      FROM information_schema.routine_privileges rp
     WHERE rp.specific_schema  = 'billing'
       AND rp.routine_name     = 'lock_settlement_period'
       AND rp.grantee          = 'authenticated'
       AND rp.privilege_type   = 'EXECUTE'
  ),
  'billing.lock_settlement_period EXECUTE grant exists for authenticated'
);

-- ── 5. billing.compute_period_aggregates function exists ─────────────────────
SELECT has_function(
  'billing', 'compute_period_aggregates', ARRAY['uuid[]', 'date', 'date'],
  'billing.compute_period_aggregates(uuid[], date, date) function exists'
);

-- ── 6. compute_period_aggregates is SECURITY DEFINER ─────────────────────────
SELECT ok(
  EXISTS (
    SELECT 1
      FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE p.proname   = 'compute_period_aggregates'
       AND n.nspname   = 'billing'
       AND p.prosecdef = true
  ),
  'billing.compute_period_aggregates is SECURITY DEFINER'
);

-- ── 7. compute_period_aggregates return type is jsonb ────────────────────────
SELECT ok(
  EXISTS (
    SELECT 1
      FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
      JOIN pg_type t      ON t.oid = p.prorettype
     WHERE p.proname = 'compute_period_aggregates'
       AND n.nspname = 'billing'
       AND t.typname = 'jsonb'
  ),
  'billing.compute_period_aggregates return type is jsonb'
);

-- ── 8. compute_period_aggregates GRANT to authenticated ──────────────────────
SELECT ok(
  EXISTS (
    SELECT 1
      FROM information_schema.routine_privileges rp
     WHERE rp.specific_schema = 'billing'
       AND rp.routine_name    = 'compute_period_aggregates'
       AND rp.grantee         = 'authenticated'
       AND rp.privilege_type  = 'EXECUTE'
  ),
  'billing.compute_period_aggregates EXECUTE grant exists for authenticated'
);

-- ── 9. billing.list_unsettled_workspaces function exists ─────────────────────
SELECT has_function(
  'billing', 'list_unsettled_workspaces', ARRAY['uuid', 'date'],
  'billing.list_unsettled_workspaces(uuid, date) function exists'
);

-- ── 10. list_unsettled_workspaces is SECURITY DEFINER ────────────────────────
SELECT ok(
  EXISTS (
    SELECT 1
      FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE p.proname   = 'list_unsettled_workspaces'
       AND n.nspname   = 'billing'
       AND p.prosecdef = true
  ),
  'billing.list_unsettled_workspaces is SECURITY DEFINER'
);

-- ── 11. list_unsettled_workspaces proretset = true (returns a SET / TABLE) ───
SELECT ok(
  EXISTS (
    SELECT 1
      FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE p.proname   = 'list_unsettled_workspaces'
       AND n.nspname   = 'billing'
       AND p.proretset = true
  ),
  'billing.list_unsettled_workspaces proretset = true (TABLE return type)'
);

-- ── 12. list_unsettled_workspaces GRANT to authenticated ─────────────────────
SELECT ok(
  EXISTS (
    SELECT 1
      FROM information_schema.routine_privileges rp
     WHERE rp.specific_schema = 'billing'
       AND rp.routine_name    = 'list_unsettled_workspaces'
       AND rp.grantee         = 'authenticated'
       AND rp.privilege_type  = 'EXECUTE'
  ),
  'billing.list_unsettled_workspaces EXECUTE grant exists for authenticated'
);

SELECT * FROM finish();
ROLLBACK;
