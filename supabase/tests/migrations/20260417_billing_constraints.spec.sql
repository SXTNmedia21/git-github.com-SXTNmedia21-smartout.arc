-- Billing Engine Fase 1 — invoice CHECK + trigger constraint tests (Task 1.11)
-- Run with: npx supabase db test
--
-- Validates that the CHECK constraints and triggers on public.invoice
-- reject the illegal states documented in ADR-0120.

BEGIN;
SELECT plan(8);

-- Skip unrelated triggers + FK checks during fixture setup.
SET session_replication_role = 'replica';

-- ── Fixture: one company + one normal invoice for credit-note linkage ──
DO $$
DECLARE
  v_company_id      UUID := gen_random_uuid();
  v_parent_invoice  UUID := gen_random_uuid();
  v_credit_note     UUID := gen_random_uuid();
BEGIN
  PERFORM set_config('test.company_id',     v_company_id::text,     false);
  PERFORM set_config('test.parent_invoice', v_parent_invoice::text, false);
  PERFORM set_config('test.credit_note',    v_credit_note::text,    false);

  -- Minimal company (workspace + user_identity not needed for this test
  -- since FK checks are skipped under replication_role = replica).
  INSERT INTO public.company (company_id, name, org_number, default_currency)
  VALUES (v_company_id, 'Test Co', NULL, 'NOK');

  -- Parent invoice (recurring).
  INSERT INTO public.invoice (
    invoice_id, company_id, invoice_type, status,
    period_from, period_to,
    amount_excl_vat, vat_rate, vat_amount, amount_incl_vat
  ) VALUES (
    v_parent_invoice, v_company_id, 'recurring', 'issued',
    '2026-03-01', '2026-03-31',
    100, 25, 25, 125
  );

  -- Valid credit note against parent.
  INSERT INTO public.invoice (
    invoice_id, company_id, invoice_type, status, credits_invoice_id,
    period_from, period_to,
    amount_excl_vat, vat_rate, vat_amount, amount_incl_vat
  ) VALUES (
    v_credit_note, v_company_id, 'credit_note', 'issued', v_parent_invoice,
    '2026-03-01', '2026-03-31',
    50, 25, 12.50, 62.50
  );
END $$;

-- Flip back to origin so triggers under test fire on the ACT inserts.
SET session_replication_role = 'origin';

-- ── Test 1: credit_note pointing at another credit_note is rejected ──
SELECT throws_ok(
  format($sql$
    INSERT INTO public.invoice (
      company_id, invoice_type, status, credits_invoice_id,
      period_from, period_to,
      amount_excl_vat, vat_rate, vat_amount, amount_incl_vat
    ) VALUES (
      %L::uuid, 'credit_note', 'issued', %L::uuid,
      '2026-03-01', '2026-03-31',
      10, 25, 2.50, 12.50
    )
  $sql$,
    current_setting('test.company_id'),
    current_setting('test.credit_note')
  ),
  'P0001',
  NULL,
  'Nested credit note (credit_note crediting another credit_note) is rejected by trigger'
);

-- ── Test 2: credit_note WITHOUT credits_invoice_id is rejected (CHECK) ──
SELECT throws_ok(
  format($sql$
    INSERT INTO public.invoice (
      company_id, invoice_type,
      period_from, period_to,
      amount_excl_vat, vat_rate, vat_amount, amount_incl_vat
    ) VALUES (
      %L::uuid, 'credit_note',
      '2026-03-01', '2026-03-31',
      100, 25, 25, 125
    )
  $sql$,
    current_setting('test.company_id')
  ),
  '23514',   -- check_violation
  NULL,
  'credit_note without credits_invoice_id rejected (invoice_credit_note_linkage)'
);

-- ── Test 3: non-credit_note WITH credits_invoice_id is rejected (CHECK) ──
SELECT throws_ok(
  format($sql$
    INSERT INTO public.invoice (
      company_id, invoice_type, credits_invoice_id,
      period_from, period_to,
      amount_excl_vat, vat_rate, vat_amount, amount_incl_vat
    ) VALUES (
      %L::uuid, 'recurring', %L::uuid,
      '2026-04-01', '2026-04-30',
      100, 25, 25, 125
    )
  $sql$,
    current_setting('test.company_id'),
    current_setting('test.parent_invoice')
  ),
  '23514',
  NULL,
  'non-credit_note with credits_invoice_id rejected (invoice_credit_note_linkage)'
);

-- ── Test 4: illegal (status, dunning_status) combo is rejected ──
SELECT throws_ok(
  format($sql$
    INSERT INTO public.invoice (
      company_id, invoice_type, status, dunning_status,
      period_from, period_to,
      amount_excl_vat, vat_rate, vat_amount, amount_incl_vat
    ) VALUES (
      %L::uuid, 'recurring', 'paid', 'escalated',
      '2026-04-01', '2026-04-30',
      100, 25, 25, 125
    )
  $sql$,
    current_setting('test.company_id')
  ),
  '23514',
  NULL,
  'paid + escalated (illegal combo) rejected by invoice_status_dunning_legal CHECK'
);

-- ── Test 5: idempotency — double recurring insert for same period rejected ──
-- Uses a distinct company + new period to avoid collision with fixture.
DO $$
DECLARE
  v_comp UUID := gen_random_uuid();
BEGIN
  PERFORM set_config('test.idem_company', v_comp::text, false);
  SET session_replication_role = 'replica';
  INSERT INTO public.company (company_id, name, org_number, default_currency)
  VALUES (v_comp, 'Idem Co', NULL, 'NOK');
  -- First recurring invoice — should succeed.
  INSERT INTO public.invoice (
    company_id, invoice_type, status,
    period_from, period_to,
    amount_excl_vat, vat_rate, vat_amount, amount_incl_vat
  ) VALUES (
    v_comp, 'recurring', 'issued',
    '2026-05-01', '2026-05-31',
    100, 25, 25, 125
  );
  SET session_replication_role = 'origin';
END $$;

SELECT throws_ok(
  format($sql$
    INSERT INTO public.invoice (
      company_id, invoice_type, status,
      period_from, period_to,
      amount_excl_vat, vat_rate, vat_amount, amount_incl_vat
    ) VALUES (
      %L::uuid, 'recurring', 'issued',
      '2026-05-01', '2026-05-31',
      100, 25, 25, 125
    )
  $sql$,
    current_setting('test.idem_company')
  ),
  '23505',   -- unique_violation
  NULL,
  'Second non-void recurring invoice for same (company, period) is rejected by idx_invoice_one_recurring_per_period'
);

-- ── Test 6: sent + reminder_sent is legal (Phase 1.5 CHECK relaxation) ──
-- Reinstates the dunning flow described in ADR-0120 intent: invoice_status
-- stays at 'sent' while dunning_status progresses through reminder_sent
-- and escalated. Pre-Phase-1.5 CHECK rejected this combo.
DO $$
DECLARE
  v_comp UUID := gen_random_uuid();
BEGIN
  PERFORM set_config('test.dunning_company', v_comp::text, false);
  SET session_replication_role = 'replica';
  INSERT INTO public.company (company_id, name, org_number, default_currency)
  VALUES (v_comp, 'Dunning Co', NULL, 'NOK');
  SET session_replication_role = 'origin';
END $$;

SELECT lives_ok(
  format($sql$
    INSERT INTO public.invoice (
      company_id, invoice_type, status, dunning_status,
      period_from, period_to,
      amount_excl_vat, vat_rate, vat_amount, amount_incl_vat
    ) VALUES (
      %L::uuid, 'recurring', 'sent', 'reminder_sent',
      '2026-06-01', '2026-06-30',
      100, 25, 25, 125
    )
  $sql$,
    current_setting('test.dunning_company')
  ),
  'sent + reminder_sent is legal under relaxed invoice_status_dunning_legal CHECK (Phase 1.5)'
);

-- ── Test 7: invoice.pricing_terms_id column exists (Phase 1.5 snapshot) ──
SELECT has_column(
  'public', 'invoice', 'pricing_terms_id',
  'invoice has pricing_terms_id FK column for Phase 1.5 pricing snapshot'
);

-- ── Test 8: UPDATE trigger WHEN clause includes invoice_number IS NULL guard ──
-- Structural assertion for Phase 1.5 Fix #3 (code-reviewer important #3).
-- pg_get_triggerdef exposes the WHEN clause verbatim; absence of the guard
-- re-admits the wasted-sequence race the migration was written to close.
SELECT ok(
  (SELECT pg_get_triggerdef(oid)
     FROM pg_trigger
    WHERE tgname = 'trg_invoice_assign_number_update'
      AND tgrelid = 'public.invoice'::regclass)
  LIKE '%invoice_number IS NULL%',
  'trg_invoice_assign_number_update WHEN clause includes invoice_number IS NULL (Phase 1.5 idempotency guard)'
);

SELECT * FROM finish();
ROLLBACK;
