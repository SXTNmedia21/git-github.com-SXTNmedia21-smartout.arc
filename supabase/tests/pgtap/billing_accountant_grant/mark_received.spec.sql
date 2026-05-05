-- ============================================================================
-- supabase/tests/pgtap/billing_accountant_grant/mark_received.spec.sql
--
-- Verifies the UPDATE policy for accountant mark-received transition.
--
-- The policy must:
--   a) Exist with the correct name
--   b) Be FOR UPDATE on public.invoice
--   c) USING clause: gates on billing.is_accountant_for_company + status IN
--      ('issued','sent','overdue')
--   d) WITH CHECK clause: gates on billing.is_accountant_for_company + status = 'paid'
--
-- We verify the structural guarantee via pg_policies catalog.
-- Actual status transition correctness (issued→paid, overdue→paid) is
-- validated at the Server Action level (apps/admin E2E in M4).
--
-- Tests (8 total):
--   1.  invoice_accountant_mark_received policy exists
--   2.  Policy is FOR UPDATE (cmd = 'UPDATE')
--   3.  USING clause references billing.is_accountant_for_company
--   4.  USING clause references issued status
--   5.  USING clause references sent status
--   6.  USING clause references overdue status
--   7.  WITH CHECK (with_check) clause references billing.is_accountant_for_company
--   8.  WITH CHECK clause references paid status (terminal state)
--
-- Run with:
--   psql "postgresql://postgres:postgres@localhost:54322/postgres" \
--        --set ON_ERROR_STOP=1 \
--        -f supabase/tests/pgtap/billing_accountant_grant/mark_received.spec.sql
-- ============================================================================

BEGIN;
SELECT plan(8);

-- ── 1. Policy exists ─────────────────────────────────────────────────────────

SELECT ok(
  EXISTS (
    SELECT 1
      FROM pg_policies
     WHERE schemaname = 'public'
       AND tablename  = 'invoice'
       AND policyname = 'invoice_accountant_mark_received'
  ),
  'invoice_accountant_mark_received policy exists on public.invoice'
);

-- ── 2. Policy is FOR UPDATE ──────────────────────────────────────────────────

SELECT ok(
  EXISTS (
    SELECT 1
      FROM pg_policies
     WHERE schemaname = 'public'
       AND tablename  = 'invoice'
       AND policyname = 'invoice_accountant_mark_received'
       AND cmd        = 'UPDATE'
  ),
  'invoice_accountant_mark_received is FOR UPDATE'
);

-- ── 3. USING references billing.is_accountant_for_company ────────────────────

SELECT ok(
  EXISTS (
    SELECT 1
      FROM pg_policies
     WHERE schemaname = 'public'
       AND tablename  = 'invoice'
       AND policyname = 'invoice_accountant_mark_received'
       AND qual       ILIKE '%billing.is_accountant_for_company%'
  ),
  'USING clause calls billing.is_accountant_for_company (company-scoped gate)'
);

-- ── 4. USING references ''issued'' ────────────────────────────────────────────

SELECT ok(
  EXISTS (
    SELECT 1
      FROM pg_policies
     WHERE schemaname = 'public'
       AND tablename  = 'invoice'
       AND policyname = 'invoice_accountant_mark_received'
       AND qual       ILIKE '%issued%'
  ),
  'USING clause allows status ''issued'' (transition source)'
);

-- ── 5. USING references ''sent'' ──────────────────────────────────────────────

SELECT ok(
  EXISTS (
    SELECT 1
      FROM pg_policies
     WHERE schemaname = 'public'
       AND tablename  = 'invoice'
       AND policyname = 'invoice_accountant_mark_received'
       AND qual       ILIKE '%sent%'
  ),
  'USING clause allows status ''sent'' (transition source)'
);

-- ── 6. USING references ''overdue'' ──────────────────────────────────────────

SELECT ok(
  EXISTS (
    SELECT 1
      FROM pg_policies
     WHERE schemaname = 'public'
       AND tablename  = 'invoice'
       AND policyname = 'invoice_accountant_mark_received'
       AND qual       ILIKE '%overdue%'
  ),
  'USING clause allows status ''overdue'' (transition source)'
);

-- ── 7. WITH CHECK references billing.is_accountant_for_company ───────────────

SELECT ok(
  EXISTS (
    SELECT 1
      FROM pg_policies
     WHERE schemaname = 'public'
       AND tablename  = 'invoice'
       AND policyname = 'invoice_accountant_mark_received'
       AND with_check ILIKE '%billing.is_accountant_for_company%'
  ),
  'WITH CHECK clause calls billing.is_accountant_for_company (write-side gate)'
);

-- ── 8. WITH CHECK references ''paid'' (only valid target status) ──────────────

SELECT ok(
  EXISTS (
    SELECT 1
      FROM pg_policies
     WHERE schemaname = 'public'
       AND tablename  = 'invoice'
       AND policyname = 'invoice_accountant_mark_received'
       AND with_check ILIKE '%paid%'
  ),
  'WITH CHECK clause restricts target status to ''paid'' only'
);

SELECT * FROM finish();
ROLLBACK;
