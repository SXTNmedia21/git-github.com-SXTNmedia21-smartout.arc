-- ============================================================================
-- supabase/tests/pgtap/billing_accountant_grant/schema_objects.spec.sql
--
-- Verifies the billing schema and all its objects exist with correct
-- properties. Catalog-only checks — no live data inserts.
--
-- Tests (17 total):
--   1.    billing schema exists
--   2.    billing.accountant_company_grant table exists
--   3-4.  Primary key + unique constraint exist
--   5.    accountant_grant_scope enum exists in billing schema
--   6-7.  Enum values: orders_only, full_kartotek
--   8.    billing.get_accountant_company_ids function exists
--   9.    billing.get_accountant_company_ids is SECURITY DEFINER
--   10.   billing.is_accountant_for_company function exists
--   11.   billing.is_accountant_for_company is SECURITY DEFINER
--   12.   billing.v_workspace_kartotek_summary view exists
--   13.   accountant_company_grant RLS is enabled
--   14.   accountant_company_grant_self_select policy exists
--   15.   updated_at trigger exists on billing.accountant_company_grant
--   16.   active grants index exists on user_id
--   17.   active grants index exists on company_id
--
-- Run with:
--   psql "postgresql://postgres:postgres@localhost:54322/postgres" \
--        --set ON_ERROR_STOP=1 \
--        -f supabase/tests/pgtap/billing_accountant_grant/schema_objects.spec.sql
-- ============================================================================

BEGIN;
SELECT plan(17);

-- ── 1. billing schema exists ──────────────────────────────────────────────────
SELECT ok(
  EXISTS (SELECT 1 FROM pg_namespace WHERE nspname = 'billing'),
  'billing schema exists'
);

-- ── 2. billing.accountant_company_grant table exists ─────────────────────────
SELECT has_table(
  'billing', 'accountant_company_grant',
  'billing.accountant_company_grant table exists'
);

-- ── 3. Primary key on grant_id ────────────────────────────────────────────────
SELECT col_is_pk(
  'billing', 'accountant_company_grant', 'grant_id',
  'billing.accountant_company_grant.grant_id is PRIMARY KEY'
);

-- ── 4. Unique constraint user_id + company_id ────────────────────────────────
SELECT ok(
  EXISTS (
    SELECT 1
      FROM pg_constraint c
      JOIN pg_class t      ON t.oid = c.conrelid
      JOIN pg_namespace n  ON n.oid = t.relnamespace
     WHERE n.nspname  = 'billing'
       AND t.relname  = 'accountant_company_grant'
       AND c.contype  = 'u'
       AND c.conname  = 'accountant_company_grant_user_company_unique'
  ),
  'UNIQUE(user_id, company_id) constraint exists on billing.accountant_company_grant'
);

-- ── 5. accountant_grant_scope enum exists in billing schema ──────────────────
SELECT ok(
  EXISTS (
    SELECT 1
      FROM pg_type pt
      JOIN pg_namespace n ON n.oid = pt.typnamespace
     WHERE pt.typname  = 'accountant_grant_scope'
       AND n.nspname   = 'billing'
  ),
  'billing.accountant_grant_scope enum type exists'
);

-- ── 6. Enum value: orders_only ───────────────────────────────────────────────
SELECT ok(
  EXISTS (
    SELECT 1
      FROM pg_enum pe
      JOIN pg_type  pt ON pt.oid = pe.enumtypid
      JOIN pg_namespace n ON n.oid = pt.typnamespace
     WHERE pt.typname    = 'accountant_grant_scope'
       AND n.nspname     = 'billing'
       AND pe.enumlabel  = 'orders_only'
  ),
  'billing.accountant_grant_scope has value ''orders_only'''
);

-- ── 7. Enum value: full_kartotek ─────────────────────────────────────────────
SELECT ok(
  EXISTS (
    SELECT 1
      FROM pg_enum pe
      JOIN pg_type  pt ON pt.oid = pe.enumtypid
      JOIN pg_namespace n ON n.oid = pt.typnamespace
     WHERE pt.typname    = 'accountant_grant_scope'
       AND n.nspname     = 'billing'
       AND pe.enumlabel  = 'full_kartotek'
  ),
  'billing.accountant_grant_scope has value ''full_kartotek'''
);

-- ── 8. get_accountant_company_ids function exists ────────────────────────────
SELECT has_function(
  'billing', 'get_accountant_company_ids', ARRAY['uuid'],
  'billing.get_accountant_company_ids(uuid) function exists'
);

-- ── 9. get_accountant_company_ids is SECURITY DEFINER ────────────────────────
SELECT ok(
  EXISTS (
    SELECT 1
      FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE p.proname   = 'get_accountant_company_ids'
       AND n.nspname   = 'billing'
       AND p.prosecdef = true
  ),
  'billing.get_accountant_company_ids is SECURITY DEFINER'
);

-- ── 10. is_accountant_for_company function exists ────────────────────────────
SELECT has_function(
  'billing', 'is_accountant_for_company', ARRAY['uuid'],
  'billing.is_accountant_for_company(uuid) function exists'
);

-- ── 11. is_accountant_for_company is SECURITY DEFINER ────────────────────────
SELECT ok(
  EXISTS (
    SELECT 1
      FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE p.proname   = 'is_accountant_for_company'
       AND n.nspname   = 'billing'
       AND p.prosecdef = true
  ),
  'billing.is_accountant_for_company is SECURITY DEFINER'
);

-- ── 12. billing.v_workspace_kartotek_summary view exists ─────────────────────
SELECT has_view(
  'billing', 'v_workspace_kartotek_summary',
  'billing.v_workspace_kartotek_summary view exists'
);

-- ── 13. RLS enabled on billing.accountant_company_grant ──────────────────────
SELECT ok(
  EXISTS (
    SELECT 1
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
     WHERE c.relname   = 'accountant_company_grant'
       AND n.nspname   = 'billing'
       AND c.relrowsecurity = true
  ),
  'RLS is enabled on billing.accountant_company_grant'
);

-- ── 14. Self-select policy exists ────────────────────────────────────────────
SELECT ok(
  EXISTS (
    SELECT 1
      FROM pg_policies
     WHERE schemaname = 'billing'
       AND tablename  = 'accountant_company_grant'
       AND policyname = 'accountant_company_grant_self_select'
  ),
  'accountant_company_grant_self_select policy exists on billing.accountant_company_grant'
);

-- ── 15. updated_at trigger exists ────────────────────────────────────────────
SELECT ok(
  EXISTS (
    SELECT 1
      FROM pg_trigger t
      JOIN pg_class   c ON c.oid = t.tgrelid
      JOIN pg_namespace n ON n.oid = c.relnamespace
     WHERE c.relname   = 'accountant_company_grant'
       AND n.nspname   = 'billing'
       AND t.tgname    = 'set_billing_accountant_company_grant_updated_at'
  ),
  'updated_at trigger exists on billing.accountant_company_grant'
);

-- ── 16. Partial index on user_id (active grants) ─────────────────────────────
SELECT ok(
  EXISTS (
    SELECT 1
      FROM pg_indexes
     WHERE schemaname = 'billing'
       AND tablename  = 'accountant_company_grant'
       AND indexname  = 'accountant_company_grant_user_active_idx'
       AND indexdef   ILIKE '%where%'
  ),
  'partial index accountant_company_grant_user_active_idx exists on billing.accountant_company_grant'
);

-- ── 17. Partial index on company_id (active grants) ──────────────────────────
SELECT ok(
  EXISTS (
    SELECT 1
      FROM pg_indexes
     WHERE schemaname = 'billing'
       AND tablename  = 'accountant_company_grant'
       AND indexname  = 'accountant_company_grant_company_idx'
       AND indexdef   ILIKE '%where%'
  ),
  'partial index accountant_company_grant_company_idx exists on billing.accountant_company_grant'
);

SELECT * FROM finish();
ROLLBACK;
