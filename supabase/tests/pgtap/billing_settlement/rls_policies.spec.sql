-- ============================================================================
-- supabase/tests/pgtap/billing_settlement/rls_policies.spec.sql
--
-- Verifies RLS is enabled and all expected policies exist on settlement tables.
-- Catalog-only checks — no live data inserts.
--
-- Tests (13 total):
--   1.    RLS enabled on billing.settlement_period
--   2.    RLS enabled on billing.settlement_run
--   3.    RLS enabled on billing.settlement_artifact
--   4.    settlement_period_accountant_select policy exists (SELECT)
--   5.    settlement_period_accountant_update policy exists (UPDATE)
--   6.    settlement_period_accountant_insert policy exists (INSERT)
--   7.    settlement_period_accountant_update is cmd=w (UPDATE)
--   8.    settlement_run_accountant_select policy exists (SELECT)
--   9.    settlement_run_accountant_insert policy exists (INSERT)
--   10.   settlement_artifact_accountant_select policy exists (SELECT)
--   11.   No INSERT policy on settlement_artifact for authenticated (service_role only)
--   12.   settlement_period_accountant_update USING clause references 'open' (status gate)
--   13.   accountant_has_access_to_run helper function exists
--
-- ============================================================================

BEGIN;
SELECT plan(13);

-- ── 1. RLS enabled on billing.settlement_period ──────────────────────────────
SELECT ok(
  EXISTS (
    SELECT 1
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
     WHERE c.relname        = 'settlement_period'
       AND n.nspname        = 'billing'
       AND c.relrowsecurity = true
  ),
  'RLS is enabled on billing.settlement_period'
);

-- ── 2. RLS enabled on billing.settlement_run ─────────────────────────────────
SELECT ok(
  EXISTS (
    SELECT 1
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
     WHERE c.relname        = 'settlement_run'
       AND n.nspname        = 'billing'
       AND c.relrowsecurity = true
  ),
  'RLS is enabled on billing.settlement_run'
);

-- ── 3. RLS enabled on billing.settlement_artifact ────────────────────────────
SELECT ok(
  EXISTS (
    SELECT 1
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
     WHERE c.relname        = 'settlement_artifact'
       AND n.nspname        = 'billing'
       AND c.relrowsecurity = true
  ),
  'RLS is enabled on billing.settlement_artifact'
);

-- ── 4. settlement_period_accountant_select policy exists ─────────────────────
SELECT ok(
  EXISTS (
    SELECT 1
      FROM pg_policies
     WHERE schemaname = 'billing'
       AND tablename  = 'settlement_period'
       AND policyname = 'settlement_period_accountant_select'
  ),
  'settlement_period_accountant_select policy exists on billing.settlement_period'
);

-- ── 5. settlement_period_accountant_update policy exists ─────────────────────
SELECT ok(
  EXISTS (
    SELECT 1
      FROM pg_policies
     WHERE schemaname = 'billing'
       AND tablename  = 'settlement_period'
       AND policyname = 'settlement_period_accountant_update'
  ),
  'settlement_period_accountant_update policy exists on billing.settlement_period'
);

-- ── 6. settlement_period_accountant_insert policy exists ─────────────────────
SELECT ok(
  EXISTS (
    SELECT 1
      FROM pg_policies
     WHERE schemaname = 'billing'
       AND tablename  = 'settlement_period'
       AND policyname = 'settlement_period_accountant_insert'
  ),
  'settlement_period_accountant_insert policy exists on billing.settlement_period'
);

-- ── 7. settlement_period_accountant_update is an UPDATE policy ───────────────
SELECT ok(
  EXISTS (
    SELECT 1
      FROM pg_policies
     WHERE schemaname = 'billing'
       AND tablename  = 'settlement_period'
       AND policyname = 'settlement_period_accountant_update'
       AND cmd        = 'UPDATE'
  ),
  'settlement_period_accountant_update is an UPDATE policy'
);

-- ── 8. settlement_run_accountant_select policy exists ────────────────────────
SELECT ok(
  EXISTS (
    SELECT 1
      FROM pg_policies
     WHERE schemaname = 'billing'
       AND tablename  = 'settlement_run'
       AND policyname = 'settlement_run_accountant_select'
  ),
  'settlement_run_accountant_select policy exists on billing.settlement_run'
);

-- ── 9. settlement_run_accountant_insert policy exists ────────────────────────
SELECT ok(
  EXISTS (
    SELECT 1
      FROM pg_policies
     WHERE schemaname = 'billing'
       AND tablename  = 'settlement_run'
       AND policyname = 'settlement_run_accountant_insert'
  ),
  'settlement_run_accountant_insert policy exists on billing.settlement_run'
);

-- ── 10. settlement_artifact_accountant_select policy exists ──────────────────
SELECT ok(
  EXISTS (
    SELECT 1
      FROM pg_policies
     WHERE schemaname = 'billing'
       AND tablename  = 'settlement_artifact'
       AND policyname = 'settlement_artifact_accountant_select'
  ),
  'settlement_artifact_accountant_select policy exists on billing.settlement_artifact'
);

-- ── 11. No INSERT policy on settlement_artifact for authenticated ─────────────
--
-- Verifies service_role-only INSERT intent: no INSERT policy should exist
-- for authenticated on settlement_artifact (artifacts are created by server action
-- using elevated client, never from client-side auth context).
SELECT ok(
  NOT EXISTS (
    SELECT 1
      FROM pg_policies
     WHERE schemaname = 'billing'
       AND tablename  = 'settlement_artifact'
       AND cmd        = 'INSERT'
       AND roles      @> ARRAY['authenticated'::name]
  ),
  'No INSERT policy on billing.settlement_artifact for authenticated (service_role only)'
);

-- ── 12. settlement_period_accountant_update USING clause gates on open status ─
--
-- The USING clause must reference 'open' to prevent updates to locked/closed rows.
-- We verify by inspecting pg_policies.qual (the USING expression as text).
SELECT ok(
  EXISTS (
    SELECT 1
      FROM pg_policies
     WHERE schemaname = 'billing'
       AND tablename  = 'settlement_period'
       AND policyname = 'settlement_period_accountant_update'
       AND qual       ILIKE '%open%'
  ),
  'settlement_period_accountant_update USING clause references ''open'' status gate'
);

-- ── 13. accountant_has_access_to_run helper function exists ──────────────────
SELECT has_function(
  'billing', 'accountant_has_access_to_run', ARRAY['uuid'],
  'billing.accountant_has_access_to_run(uuid) function exists'
);

SELECT * FROM finish();
ROLLBACK;
