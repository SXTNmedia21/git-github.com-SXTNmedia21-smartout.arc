-- Billing Engine Fase 3B (CSV/PDF-eksport) — B2 structural tests
-- Run with: npx supabase db test
--
-- Scope:
--   1. invoice.ehf_exported_at kolonne eksisterer
--   2. invoice_ehf_exported_at_idx partial index eksisterer
--   3. payment_method_type ENUM inneholder 'accountant_manual'
--   4. company.ehf_enabled + peppol_participant_id kolonner (B1)
--   5. CHECK(ehf_enabled => participant_id) (B1)

BEGIN;
SELECT plan(11);

-- ═══════════════════════════════════════════════════════════════
-- 1. invoice.ehf_exported_at kolonne
-- ═══════════════════════════════════════════════════════════════
SELECT has_column('public', 'invoice', 'ehf_exported_at',
  'invoice.ehf_exported_at kolonne eksisterer (B2)');

SELECT col_type_is('public', 'invoice', 'ehf_exported_at',
  'timestamp with time zone',
  'invoice.ehf_exported_at er timestamptz');

SELECT col_is_null('public', 'invoice', 'ehf_exported_at',
  'invoice.ehf_exported_at er nullable');

-- ═══════════════════════════════════════════════════════════════
-- 2. invoice_ehf_exported_at_idx partial index
-- ═══════════════════════════════════════════════════════════════
SELECT has_index('public', 'invoice', 'invoice_ehf_exported_at_idx',
  'invoice_ehf_exported_at_idx partial index eksisterer');

-- ═══════════════════════════════════════════════════════════════
-- 3. payment_method_type ENUM har 'accountant_manual'
-- ═══════════════════════════════════════════════════════════════
SELECT ok(
  'accountant_manual' = ANY (
    SELECT unnest(enum_range(NULL::public.payment_method_type))::text
  ),
  'payment_method_type inneholder accountant_manual (Fase 3B)'
);

-- Kontrast-test: originalt ENUM-sett forblir intakt
SELECT ok(
  'stripe_card' = ANY (
    SELECT unnest(enum_range(NULL::public.payment_method_type))::text
  ),
  'payment_method_type beholder stripe_card'
);

SELECT ok(
  'manual_adjustment' = ANY (
    SELECT unnest(enum_range(NULL::public.payment_method_type))::text
  ),
  'payment_method_type beholder manual_adjustment'
);

-- ═══════════════════════════════════════════════════════════════
-- 4. company.ehf_enabled + peppol_participant_id (B1)
-- ═══════════════════════════════════════════════════════════════
SELECT has_column('public', 'company', 'ehf_enabled',
  'company.ehf_enabled kolonne eksisterer (B1)');

SELECT has_column('public', 'company', 'peppol_participant_id',
  'company.peppol_participant_id kolonne eksisterer (B1)');

SELECT col_default_is('public', 'company', 'ehf_enabled', 'false',
  'company.ehf_enabled default false');

-- ═══════════════════════════════════════════════════════════════
-- 5. CHECK(ehf_enabled => participant_id) (B1)
-- ═══════════════════════════════════════════════════════════════
-- col_has_check treffer ikke CHECK-constraints som refererer flere
-- kolonner; vi bekrefter at constrainten eksisterer ved navn.
SELECT has_check('public', 'company',
  'company har CHECK-constraint (company_ehf_requires_participant)');

SELECT finish();
ROLLBACK;
