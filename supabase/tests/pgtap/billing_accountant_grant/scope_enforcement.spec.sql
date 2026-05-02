-- ============================================================================
-- supabase/tests/pgtap/billing_accountant_grant/scope_enforcement.spec.sql
--
-- Verifies that the orders_only / full_kartotek scope split is encoded
-- in the RLS policy USING clauses for scope-gated tables.
--
-- Tables gated to full_kartotek only:
--   - public.pricing_terms
--   - public.company_member
--   - public.employment_contract
--
-- Tables available at orders_only scope (via is_accountant_for_company):
--   - public.invoice, payment, billing_activity_log, etc.
--
-- We verify that the policy USING clauses for full_kartotek tables explicitly
-- reference 'full_kartotek' (the scope check), while orders_only tables use
-- billing.is_accountant_for_company (which allows both scopes).
--
-- Tests (10 total):
--   1.  pricing_terms_accountant_select policy exists
--   2.  pricing_terms USING clause references 'full_kartotek' scope
--   3.  pricing_terms USING clause references billing.accountant_company_grant
--   4.  company_member_accountant_select policy exists
--   5.  company_member USING clause references 'full_kartotek' scope
--   6.  employment_contract_accountant_select policy exists
--   7.  employment_contract USING clause references 'full_kartotek' scope
--   8.  invoice_line_item policy exists (orders_only sufficient — no scope filter)
--   9.  invoice_line_item USING does NOT require full_kartotek (uses is_accountant_for_company via invoice join)
--   10. invoice_dispatch policy exists (orders_only sufficient)
--
-- Run with:
--   psql "postgresql://postgres:postgres@localhost:54322/postgres" \
--        --set ON_ERROR_STOP=1 \
--        -f supabase/tests/pgtap/billing_accountant_grant/scope_enforcement.spec.sql
-- ============================================================================

BEGIN;
SELECT plan(10);

-- ── 1-3. pricing_terms — full_kartotek only ───────────────────────────────────

SELECT ok(
  EXISTS (
    SELECT 1
      FROM pg_policies
     WHERE schemaname = 'public'
       AND tablename  = 'pricing_terms'
       AND policyname = 'pricing_terms_accountant_select'
  ),
  'pricing_terms_accountant_select policy exists'
);

SELECT ok(
  EXISTS (
    SELECT 1
      FROM pg_policies
     WHERE schemaname = 'public'
       AND tablename  = 'pricing_terms'
       AND policyname = 'pricing_terms_accountant_select'
       AND qual       ILIKE '%full_kartotek%'
  ),
  'pricing_terms policy USING clause contains full_kartotek scope guard'
);

SELECT ok(
  EXISTS (
    SELECT 1
      FROM pg_policies
     WHERE schemaname = 'public'
       AND tablename  = 'pricing_terms'
       AND policyname = 'pricing_terms_accountant_select'
       AND qual       ILIKE '%accountant_company_grant%'
  ),
  'pricing_terms policy USING clause reads billing.accountant_company_grant directly (scope join)'
);

-- ── 4-5. company_member — full_kartotek only ─────────────────────────────────

SELECT ok(
  EXISTS (
    SELECT 1
      FROM pg_policies
     WHERE schemaname = 'public'
       AND tablename  = 'company_member'
       AND policyname = 'company_member_accountant_select'
  ),
  'company_member_accountant_select policy exists'
);

SELECT ok(
  EXISTS (
    SELECT 1
      FROM pg_policies
     WHERE schemaname = 'public'
       AND tablename  = 'company_member'
       AND policyname = 'company_member_accountant_select'
       AND qual       ILIKE '%full_kartotek%'
  ),
  'company_member policy USING clause contains full_kartotek scope guard'
);

-- ── 6-7. employment_contract — full_kartotek only ────────────────────────────

SELECT ok(
  EXISTS (
    SELECT 1
      FROM pg_policies
     WHERE schemaname = 'public'
       AND tablename  = 'employment_contract'
       AND policyname = 'employment_contract_accountant_select'
  ),
  'employment_contract_accountant_select policy exists'
);

SELECT ok(
  EXISTS (
    SELECT 1
      FROM pg_policies
     WHERE schemaname = 'public'
       AND tablename  = 'employment_contract'
       AND policyname = 'employment_contract_accountant_select'
       AND qual       ILIKE '%full_kartotek%'
  ),
  'employment_contract policy USING clause contains full_kartotek scope guard'
);

-- ── 8-9. invoice_line_item — orders_only is sufficient (no scope filter) ──────

SELECT ok(
  EXISTS (
    SELECT 1
      FROM pg_policies
     WHERE schemaname = 'public'
       AND tablename  = 'invoice_line_item'
       AND policyname = 'invoice_line_item_accountant_select'
  ),
  'invoice_line_item_accountant_select policy exists (orders_only sufficient)'
);

SELECT ok(
  NOT EXISTS (
    SELECT 1
      FROM pg_policies
     WHERE schemaname = 'public'
       AND tablename  = 'invoice_line_item'
       AND policyname = 'invoice_line_item_accountant_select'
       AND qual       ILIKE '%full_kartotek%'
  ),
  'invoice_line_item policy does NOT require full_kartotek (orders_only scope is sufficient)'
);

-- ── 10. invoice_dispatch — orders_only is sufficient ────────────────────────

SELECT ok(
  EXISTS (
    SELECT 1
      FROM pg_policies
     WHERE schemaname = 'public'
       AND tablename  = 'invoice_dispatch'
       AND policyname = 'invoice_dispatch_accountant_select'
  ),
  'invoice_dispatch_accountant_select policy exists (orders_only sufficient)'
);

SELECT * FROM finish();
ROLLBACK;
