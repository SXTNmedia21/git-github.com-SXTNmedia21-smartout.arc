-- Billing Engine Fase 3B — B1 structural tests (Migration H)
-- Run with: npx supabase db test
--
-- Scope:
--   1. company.peppol_participant_id + ehf_enabled columns + CHECK
--   2. payment_external_id_company_unique partial index exists +
--      rejects duplicates
--   3. billing_integration_oauth_state table + UNIQUE nonce + RLS
--   4. billing_integration.workspace_admin_own_crud policy exists
--   5. engine_process integration_poll_payments seeded with
--      allowed_channels=['autonomous']
--   6. engine_trigger for 'billing integration_poll_tick' → process
--
-- Ref: Fase 3B spec §3-§6, ADR-0136, ADR-0137, ADR-0138.

BEGIN;
SELECT plan(21);

-- ═══════════════════════════════════════════════════════════════
-- 1. company EHF columns (Migration A)
-- ═══════════════════════════════════════════════════════════════
SELECT has_column('public', 'company', 'peppol_participant_id',
  'company has peppol_participant_id column (ADR-0137)');
SELECT has_column('public', 'company', 'ehf_enabled',
  'company has ehf_enabled column (ADR-0137)');

SELECT col_not_null('public', 'company', 'ehf_enabled',
  'ehf_enabled is NOT NULL');

SELECT is(
  (SELECT column_default
     FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'company'
      AND column_name = 'ehf_enabled'),
  'false',
  'ehf_enabled defaults to false');

-- CHECK enforces the invariant: ehf_enabled=true requires participant id.
-- Isolated company row — no FK side-effects.
SELECT throws_ok(
  $$INSERT INTO public.company
      (company_id, name, org_number, default_currency, peppol_participant_id, ehf_enabled)
    VALUES (gen_random_uuid(), 'BadCo', NULL, 'NOK', NULL, true)$$,
  '23514',
  NULL,
  'company_ehf_requires_participant rejects ehf_enabled=true with NULL participant_id');

-- Happy path — participant + enabled = legal
SELECT lives_ok(
  $$INSERT INTO public.company
      (company_id, name, org_number, default_currency, peppol_participant_id, ehf_enabled)
    VALUES (gen_random_uuid(), 'GoodCo', NULL, 'NOK', '0192:123456789', true)$$,
  'company with participant_id + ehf_enabled=true is accepted');

-- ═══════════════════════════════════════════════════════════════
-- 2. payment_external_id_company_unique partial index (Migration B)
-- ═══════════════════════════════════════════════════════════════
SELECT has_index('public', 'payment', 'payment_external_id_company_unique',
  'payment_external_id_company_unique partial index exists (ADR-0138)');

-- Index is UNIQUE + WHERE external_id IS NOT NULL.
SELECT ok(
  (SELECT indisunique FROM pg_index
   WHERE indexrelid = 'public.payment_external_id_company_unique'::regclass),
  'payment_external_id_company_unique is UNIQUE');

SELECT ok(
  (SELECT indpred IS NOT NULL FROM pg_index
   WHERE indexrelid = 'public.payment_external_id_company_unique'::regclass),
  'payment_external_id_company_unique is partial (has WHERE clause)');

-- Functional test: two rows with same (external_id, company_id) fail.
SET session_replication_role = 'replica';
DO $$
DECLARE
  v_company uuid := gen_random_uuid();
  v_invoice uuid := gen_random_uuid();
BEGIN
  PERFORM set_config('test.dup_company', v_company::text, false);
  PERFORM set_config('test.dup_invoice', v_invoice::text, false);

  INSERT INTO public.company (company_id, name, org_number, default_currency)
  VALUES (v_company, 'DupCheck Co', NULL, 'NOK');

  INSERT INTO public.invoice (
    invoice_id, company_id, invoice_type, status,
    period_from, period_to,
    amount_excl_vat, vat_rate, vat_amount, amount_incl_vat
  ) VALUES (
    v_invoice, v_company, 'recurring', 'issued',
    '2026-09-01', '2026-09-30',
    100, 25, 25, 125
  );

  INSERT INTO public.payment
    (invoice_id, company_id, payment_method, amount, currency, status, external_id, paid_at)
  VALUES (
    v_invoice, v_company, 'bank_transfer', 125, 'NOK', 'succeeded', 'fiken-payment-777', now()
  );
END $$;
SET session_replication_role = 'origin';

-- Second insert with same (external_id, company_id) must fail. Depending
-- on which unique constraint fires first (the pre-existing global
-- external_id index or the new composite one) we accept either
-- 23505 unique_violation path — both represent the intended dedup.
SELECT throws_ok(
  format(
    $$INSERT INTO public.payment
        (invoice_id, company_id, payment_method, amount, currency, status, external_id, paid_at)
      VALUES (%L::uuid, %L::uuid, 'bank_transfer', 125, 'NOK', 'succeeded', 'fiken-payment-777', now())$$,
    current_setting('test.dup_invoice'),
    current_setting('test.dup_company')
  ),
  '23505',
  NULL,
  'Duplicate (external_id, company_id) is rejected (unique_violation)');

-- ═══════════════════════════════════════════════════════════════
-- 3. billing_integration_oauth_state table + UNIQUE nonce + RLS (Migrations C, D)
-- ═══════════════════════════════════════════════════════════════
SELECT has_table('public', 'billing_integration_oauth_state',
  'billing_integration_oauth_state table exists');

SELECT has_column('public', 'billing_integration_oauth_state', 'state_nonce',
  'oauth_state has state_nonce');
SELECT has_column('public', 'billing_integration_oauth_state', 'consumed_at',
  'oauth_state has consumed_at');

-- UNIQUE constraint on state_nonce.
SELECT ok(
  EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.billing_integration_oauth_state'::regclass
      AND contype = 'u'
      AND array_length(conkey, 1) = 1
      AND (
        SELECT attname FROM pg_attribute
        WHERE attrelid = conrelid AND attnum = conkey[1]
      ) = 'state_nonce'
  ),
  'billing_integration_oauth_state.state_nonce has UNIQUE constraint');

-- RLS enabled.
SELECT ok(
  (SELECT relrowsecurity FROM pg_class
   WHERE relname = 'billing_integration_oauth_state' AND relnamespace = 'public'::regnamespace),
  'RLS enabled on billing_integration_oauth_state');

-- Policy exists
SELECT policies_are('public', 'billing_integration_oauth_state',
  ARRAY[
    'billing_integration_oauth_state_platform_admin_all'
  ],
  'billing_integration_oauth_state has platform-admin-only policy');

-- ═══════════════════════════════════════════════════════════════
-- 4. billing_integration workspace_admin_own_crud policy (Migration D)
-- ═══════════════════════════════════════════════════════════════
SELECT ok(
  EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'billing_integration'
      AND policyname = 'billing_integration_workspace_admin_own_crud'
  ),
  'billing_integration_workspace_admin_own_crud policy exists (Fase 3B Spor E)');

-- ═══════════════════════════════════════════════════════════════
-- 5. engine_process integration_poll_payments (Migration E)
-- ═══════════════════════════════════════════════════════════════
SELECT is(
  (SELECT count(*)::int FROM public.engine_process
   WHERE id = 'integration_poll_payments'),
  1,
  'engine_process integration_poll_payments seeded (ADR-0138)');

SELECT is(
  (SELECT allowed_channels FROM public.engine_process
   WHERE id = 'integration_poll_payments'),
  ARRAY['autonomous']::TEXT[],
  'integration_poll_payments.allowed_channels = [autonomous]');

SELECT is(
  (SELECT action_type FROM public.engine_step
   WHERE process_id = 'integration_poll_payments' AND step_order = 1),
  'poll_integration_payments',
  'integration_poll_payments step 1 action_type=poll_integration_payments');

-- ═══════════════════════════════════════════════════════════════
-- 6. engine_trigger for billing.integration_poll_tick (Migration E)
-- ═══════════════════════════════════════════════════════════════
SELECT is(
  (SELECT count(*)::int FROM public.engine_trigger
   WHERE event_type = 'billing integration_poll_tick'
     AND process_id = 'integration_poll_payments'
     AND workspace_id IS NULL),
  1,
  'engine_trigger (billing integration_poll_tick → integration_poll_payments) seeded platform-scoped');

SELECT * FROM finish();
ROLLBACK;
