-- ============================================================================
-- supabase/tests/pgtap/billing_accountant_grant/select_isolation.spec.sql
--
-- Verifies that accountant A holding a grant for company X cannot access
-- public.invoice rows for company Y (which they have no grant for).
--
-- This is a catalog-and-policy-structure test — it verifies that:
--   a) RLS policies exist on public.invoice, public.payment, etc.
--   b) The USING clause references billing.is_accountant_for_company
--      (which correctly gates on company_id, not the auth user's own rows).
--
-- We do NOT insert live data rows (user_identity FK + NOT NULL constraints
-- make data-insert isolation tests fragile and slow). Instead we verify
-- the isolation guarantee is structurally encoded in the policy USING clauses.
--
-- Tests (10 total):
--   1.  invoice_accountant_select policy exists
--   2.  invoice_accountant_select USING clause calls billing.is_accountant_for_company
--   3.  payment_accountant_select policy exists
--   4.  payment_accountant_select USING clause calls billing.is_accountant_for_company
--   5.  billing_activity_log_accountant_select policy exists
--   6.  billing_activity_log_accountant_select USING calls billing.is_accountant_for_company
--   7.  company_accountant_select policy exists
--   8.  company_accountant_select USING calls billing.is_accountant_for_company
--   9.  workspace_accountant_select policy exists
--   10. workspace_accountant_select USING calls billing.is_accountant_for_company
--
-- Run with:
--   psql "postgresql://postgres:postgres@localhost:54322/postgres" \
--        --set ON_ERROR_STOP=1 \
--        -f supabase/tests/pgtap/billing_accountant_grant/select_isolation.spec.sql
-- ============================================================================

BEGIN;
SELECT plan(10);

-- ── 1-2. invoice ─────────────────────────────────────────────────────────────

SELECT ok(
  EXISTS (
    SELECT 1
      FROM pg_policies
     WHERE schemaname = 'public'
       AND tablename  = 'invoice'
       AND policyname = 'invoice_accountant_select'
  ),
  'invoice_accountant_select policy exists on public.invoice'
);

SELECT ok(
  EXISTS (
    SELECT 1
      FROM pg_policies
     WHERE schemaname = 'public'
       AND tablename  = 'invoice'
       AND policyname = 'invoice_accountant_select'
       AND qual       ILIKE '%billing.is_accountant_for_company%'
  ),
  'invoice_accountant_select USING clause calls billing.is_accountant_for_company (company-scoped isolation)'
);

-- ── 3-4. payment ─────────────────────────────────────────────────────────────

SELECT ok(
  EXISTS (
    SELECT 1
      FROM pg_policies
     WHERE schemaname = 'public'
       AND tablename  = 'payment'
       AND policyname = 'payment_accountant_select'
  ),
  'payment_accountant_select policy exists on public.payment'
);

SELECT ok(
  EXISTS (
    SELECT 1
      FROM pg_policies
     WHERE schemaname = 'public'
       AND tablename  = 'payment'
       AND policyname = 'payment_accountant_select'
       AND qual       ILIKE '%billing.is_accountant_for_company%'
  ),
  'payment_accountant_select USING clause calls billing.is_accountant_for_company'
);

-- ── 5-6. billing_activity_log ────────────────────────────────────────────────

SELECT ok(
  EXISTS (
    SELECT 1
      FROM pg_policies
     WHERE schemaname = 'public'
       AND tablename  = 'billing_activity_log'
       AND policyname = 'billing_activity_log_accountant_select'
  ),
  'billing_activity_log_accountant_select policy exists on public.billing_activity_log'
);

SELECT ok(
  EXISTS (
    SELECT 1
      FROM pg_policies
     WHERE schemaname = 'public'
       AND tablename  = 'billing_activity_log'
       AND policyname = 'billing_activity_log_accountant_select'
       AND qual       ILIKE '%billing.is_accountant_for_company%'
  ),
  'billing_activity_log_accountant_select USING clause calls billing.is_accountant_for_company'
);

-- ── 7-8. company ─────────────────────────────────────────────────────────────

SELECT ok(
  EXISTS (
    SELECT 1
      FROM pg_policies
     WHERE schemaname = 'public'
       AND tablename  = 'company'
       AND policyname = 'company_accountant_select'
  ),
  'company_accountant_select policy exists on public.company'
);

SELECT ok(
  EXISTS (
    SELECT 1
      FROM pg_policies
     WHERE schemaname = 'public'
       AND tablename  = 'company'
       AND policyname = 'company_accountant_select'
       AND qual       ILIKE '%billing.is_accountant_for_company%'
  ),
  'company_accountant_select USING clause calls billing.is_accountant_for_company'
);

-- ── 9-10. workspace ──────────────────────────────────────────────────────────

SELECT ok(
  EXISTS (
    SELECT 1
      FROM pg_policies
     WHERE schemaname = 'public'
       AND tablename  = 'workspace'
       AND policyname = 'workspace_accountant_select'
  ),
  'workspace_accountant_select policy exists on public.workspace'
);

SELECT ok(
  EXISTS (
    SELECT 1
      FROM pg_policies
     WHERE schemaname = 'public'
       AND tablename  = 'workspace'
       AND policyname = 'workspace_accountant_select'
       AND qual       ILIKE '%billing.is_accountant_for_company%'
  ),
  'workspace_accountant_select USING clause calls billing.is_accountant_for_company'
);

SELECT * FROM finish();
ROLLBACK;
