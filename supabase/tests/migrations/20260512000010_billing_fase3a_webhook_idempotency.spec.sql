-- Billing Engine Fase 3A — B2.6 stripe-webhook idempotency tests
-- Run with: npx supabase db test
--
-- Scope:
--   1. payment_attempt.stripe_event_id UNIQUE enforces idempotency
--      (second insert of same event id raises unique_violation)
--   2. Credit-note creation path: credits_invoice_id FK valid + inherits
--      period + company from original
--   3. payment.external_id UNIQUE partial index prevents duplicate
--      pending rows for the same Stripe PaymentIntent
--   4. ADR-0120 nested credit-note rejection via trigger
--   5. ADR-0132 redacted_payload default '{}'::jsonb never NULL

BEGIN;
SELECT plan(11);

-- ═══════════════════════════════════════════════════════════════
-- Fixtures (same pattern as 20260512000009 — disable FK checks)
-- ═══════════════════════════════════════════════════════════════
SET session_replication_role = 'replica';
DO $$
DECLARE
  v_company uuid := gen_random_uuid();
  v_invoice uuid := gen_random_uuid();
  v_payment uuid := gen_random_uuid();
BEGIN
  PERFORM set_config('test.p_company', v_company::text, false);
  PERFORM set_config('test.p_invoice', v_invoice::text, false);
  PERFORM set_config('test.p_payment', v_payment::text, false);

  INSERT INTO public.company (company_id, name, org_number, default_currency)
  VALUES (v_company, 'Fase3A Webhook Test Co', NULL, 'NOK');

  INSERT INTO public.invoice (
    invoice_id, company_id, invoice_type, status,
    period_from, period_to,
    amount_excl_vat, vat_rate, vat_amount, amount_incl_vat
  ) VALUES (
    v_invoice, v_company, 'recurring', 'issued',
    '2026-04-01', '2026-04-30', 100, 25, 25, 125
  );

  INSERT INTO public.payment (
    payment_id, invoice_id, company_id, payment_method,
    amount, currency, status, external_id
  ) VALUES (
    v_payment, v_invoice, v_company, 'stripe_card',
    125.00, 'NOK', 'pending', 'pi_fase3a_webhook_test_1'
  );
END $$;
SET session_replication_role = 'origin';

-- ═══════════════════════════════════════════════════════════════
-- 1. payment_attempt UNIQUE idempotency
-- ═══════════════════════════════════════════════════════════════

-- First insert succeeds
DO $$
BEGIN
  INSERT INTO public.payment_attempt (
    payment_id, attempt_number, stripe_event_id, status, redacted_payload
  ) VALUES (
    current_setting('test.p_payment')::uuid, 1,
    'evt_fase3a_webhook_1', 'payment_intent.succeeded',
    '{"event_id":"evt_fase3a_webhook_1","amount":12500}'::jsonb
  );
END $$;

SELECT ok(
  EXISTS (SELECT 1 FROM public.payment_attempt WHERE stripe_event_id = 'evt_fase3a_webhook_1'),
  'First payment_attempt insert succeeds'
);

-- Duplicate stripe_event_id must raise 23505
SELECT throws_ok(
  format(
    $$INSERT INTO public.payment_attempt
        (payment_id, attempt_number, stripe_event_id, status, redacted_payload)
      VALUES (%L::uuid, 2, 'evt_fase3a_webhook_1', 'payment_intent.succeeded', '{}'::jsonb)$$,
    current_setting('test.p_payment')
  ),
  '23505',
  NULL,
  'Duplicate stripe_event_id raises unique_violation (webhook idempotent)'
);

-- ═══════════════════════════════════════════════════════════════
-- 2. Credit-note with credits_invoice_id + positive amounts
-- ═══════════════════════════════════════════════════════════════

DO $$
DECLARE
  v_credit_note uuid := gen_random_uuid();
BEGIN
  PERFORM set_config('test.p_credit_note', v_credit_note::text, false);

  INSERT INTO public.invoice (
    invoice_id, company_id, invoice_type, status, credits_invoice_id,
    period_from, period_to,
    amount_excl_vat, vat_rate, vat_amount, amount_incl_vat, currency,
    void_reason
  ) VALUES (
    v_credit_note,
    current_setting('test.p_company')::uuid,
    'credit_note', 'issued',
    current_setting('test.p_invoice')::uuid,
    '2026-04-01', '2026-04-30',
    100.00, 25, 25.00, 125.00, 'NOK',
    'stripe_full_refund: re_fase3a_full'
  );
END $$;

SELECT ok(
  EXISTS (
    SELECT 1 FROM public.invoice
    WHERE invoice_id = current_setting('test.p_credit_note')::uuid
      AND invoice_type = 'credit_note'
      AND credits_invoice_id = current_setting('test.p_invoice')::uuid
  ),
  'Credit-note row inserted with credits_invoice_id pointing at original'
);

SELECT ok(
  (SELECT void_reason FROM public.invoice
    WHERE invoice_id = current_setting('test.p_credit_note')::uuid)
    LIKE 'stripe_full_refund:%',
  'Credit-note void_reason captures Stripe refund id for audit'
);

-- Amount stored POSITIVE per ADR-0120 §8 — invoice_type is sign flag.
SELECT ok(
  (SELECT amount_incl_vat FROM public.invoice
    WHERE invoice_id = current_setting('test.p_credit_note')::uuid) > 0,
  'ADR-0120 §8: credit-note amount stored positive (invoice_type is sign flag)'
);

-- ═══════════════════════════════════════════════════════════════
-- 3. Nested credit-note rejected by existing ADR-0120 trigger
-- ═══════════════════════════════════════════════════════════════

SELECT throws_ok(
  format(
    $$INSERT INTO public.invoice
        (company_id, invoice_type, status, credits_invoice_id,
         period_from, period_to,
         amount_excl_vat, vat_rate, vat_amount, amount_incl_vat, currency)
      VALUES (%L::uuid, 'credit_note', 'issued', %L::uuid,
              '2026-04-01', '2026-04-30',
              10.00, 25, 2.50, 12.50, 'NOK')$$,
    current_setting('test.p_company'),
    current_setting('test.p_credit_note')
  ),
  NULL, NULL,
  'Nested credit-note insert rejected (ADR-0120 prevent_nested_credit_notes trigger)'
);

-- ═══════════════════════════════════════════════════════════════
-- 4. payment.external_id UNIQUE partial index
-- ═══════════════════════════════════════════════════════════════

SELECT throws_ok(
  format(
    $$INSERT INTO public.payment
        (invoice_id, company_id, payment_method,
         amount, currency, status, external_id)
      VALUES (%L::uuid, %L::uuid, 'stripe_card',
              125.00, 'NOK', 'pending', 'pi_fase3a_webhook_test_1')$$,
    current_setting('test.p_invoice'),
    current_setting('test.p_company')
  ),
  '23505',
  NULL,
  'Duplicate payment.external_id raises unique_violation'
);

-- NULL external_id bypasses partial unique — two manual rows allowed.
DO $$
BEGIN
  INSERT INTO public.payment (
    invoice_id, company_id, payment_method,
    amount, currency, status, external_id
  ) VALUES
    (current_setting('test.p_invoice')::uuid, current_setting('test.p_company')::uuid,
     'bank_transfer', 10.00, 'NOK', 'succeeded', NULL),
    (current_setting('test.p_invoice')::uuid, current_setting('test.p_company')::uuid,
     'manual_adjustment', 5.00, 'NOK', 'succeeded', NULL);
END $$;

SELECT ok(
  (SELECT count(*) FROM public.payment
     WHERE invoice_id = current_setting('test.p_invoice')::uuid
       AND external_id IS NULL) >= 2,
  'Partial UNIQUE index allows multiple NULL external_id rows (manual + bank)'
);

-- ═══════════════════════════════════════════════════════════════
-- 5. ADR-0132 redacted_payload default
-- ═══════════════════════════════════════════════════════════════

DO $$
BEGIN
  INSERT INTO public.payment_attempt (
    payment_id, attempt_number, stripe_event_id, status
  ) VALUES (
    current_setting('test.p_payment')::uuid, 10,
    'evt_fase3a_default_payload', 'payment_intent.succeeded'
  );
END $$;

SELECT ok(
  (SELECT redacted_payload FROM public.payment_attempt
     WHERE stripe_event_id = 'evt_fase3a_default_payload') = '{}'::jsonb,
  'payment_attempt.redacted_payload defaults to empty jsonb, never NULL (handler safety)'
);

-- ═══════════════════════════════════════════════════════════════
-- 6. Refund state coherence CHECK
-- ═══════════════════════════════════════════════════════════════

SELECT throws_ok(
  format(
    $$UPDATE public.payment SET refunded_amount = 50.00
      WHERE payment_id = %L::uuid$$,
    current_setting('test.p_payment')
  ),
  '23514',
  NULL,
  'Setting refunded_amount without status IN (refunded, partially_refunded) violates CHECK'
);

-- Valid coherent transition
DO $$
BEGIN
  UPDATE public.payment
  SET status = 'partially_refunded', refunded_amount = 50.00
  WHERE payment_id = current_setting('test.p_payment')::uuid;
END $$;

SELECT ok(
  (SELECT refunded_amount FROM public.payment
     WHERE payment_id = current_setting('test.p_payment')::uuid) = 50.00,
  'Coherent refund state transition accepted'
);

SELECT * FROM finish();
ROLLBACK;
