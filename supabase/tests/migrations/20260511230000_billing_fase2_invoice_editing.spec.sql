-- Billing Engine Fase 2 — B5 invoice editing tests.
-- Run with: npx supabase db test
--
-- Scope:
--   1. Manual line add on a draft invoice succeeds + affects totals when
--      aggregated (no DB-side auto-aggregation, the pure function does
--      it — here we just prove the INSERT lands cleanly).
--   2. UPDATE of a usage-backed line on a non-draft invoice is rejected
--      by the B1 trigger (prevent_usage_line_mutation_on_locked_invoice).
--   3. DELETE of any line on an issued invoice is rejected for
--      usage-backed rows (manual lines on issued invoices aren't
--      blocked by the trigger — that gate is enforced at the app layer
--      via Zod + status guard).
--   4. Ad-hoc (one_off) invoice composition produces a row with
--      invoice_type='one_off' + all manual lines (usage_snapshot_id
--      NULL).

BEGIN;
SELECT plan(7);

-- Skip FK checks during fixture setup.
SET session_replication_role = 'replica';

-- ═══════════════════════════════════════════════════════════════
-- Fixture A: draft invoice + one manual line for editing tests
-- ═══════════════════════════════════════════════════════════════
DO $$
DECLARE
  v_company uuid := gen_random_uuid();
  v_draft   uuid := gen_random_uuid();
  v_issued  uuid := gen_random_uuid();
  v_snap    uuid := gen_random_uuid();
  v_derived uuid := gen_random_uuid();
BEGIN
  PERFORM set_config('test.company',    v_company::text, false);
  PERFORM set_config('test.draft',      v_draft::text,   false);
  PERFORM set_config('test.issued',     v_issued::text,  false);
  PERFORM set_config('test.snapshot',   v_snap::text,    false);
  PERFORM set_config('test.derived',    v_derived::text, false);

  INSERT INTO public.company (company_id, name, org_number, default_currency)
  VALUES (v_company, 'Editing Co', NULL, 'NOK');

  -- Draft invoice: manual lines freely mutable.
  INSERT INTO public.invoice (
    invoice_id, company_id, invoice_type, status,
    period_from, period_to,
    amount_excl_vat, vat_rate, vat_amount, amount_incl_vat
  ) VALUES (
    v_draft, v_company, 'recurring', 'draft',
    '2026-05-01', '2026-05-31',
    0, 25, 0, 0
  );

  -- Issued invoice: carries a usage-backed (derived) line that must be locked.
  INSERT INTO public.invoice (
    invoice_id, company_id, invoice_type, status,
    period_from, period_to,
    amount_excl_vat, vat_rate, vat_amount, amount_incl_vat
  ) VALUES (
    v_issued, v_company, 'recurring', 'issued',
    '2026-04-01', '2026-04-30',
    100, 25, 25, 125
  );

  INSERT INTO public.invoice_line_item (
    line_item_id, invoice_id, line_type, description,
    quantity, unit_price, amount_excl_vat, vat_rate, vat_amount, amount_incl_vat,
    usage_snapshot_id
  ) VALUES (
    v_derived, v_issued, 'base_plan', 'Usage-backed line',
    1, 100, 100, 25, 25, 125,
    v_snap
  );
END $$;

SET session_replication_role = 'origin';

-- ═══════════════════════════════════════════════════════════════
-- 1. Manual INSERT on draft invoice lives (no trigger block)
-- ═══════════════════════════════════════════════════════════════
SELECT lives_ok(
  format(
    $$INSERT INTO public.invoice_line_item (
        line_item_id, invoice_id, line_type, description,
        quantity, unit_price, amount_excl_vat, vat_rate, vat_amount, amount_incl_vat,
        usage_snapshot_id
      ) VALUES (
        gen_random_uuid(), %L::uuid, 'adjustment', 'Ekstra linje',
        2, 500, 1000, 25, 250, 1250,
        NULL
      )$$,
    current_setting('test.draft')
  ),
  'Manual INSERT on draft invoice succeeds'
);

-- The newly inserted manual line has the expected totals.
SELECT is(
  (SELECT amount_incl_vat::numeric
     FROM public.invoice_line_item
    WHERE invoice_id = current_setting('test.draft')::uuid
      AND description = 'Ekstra linje'),
  1250::numeric,
  'Inserted manual line has amount_incl_vat = 1250'
);

-- ═══════════════════════════════════════════════════════════════
-- 2. UPDATE of usage-backed line on issued invoice rejected
-- ═══════════════════════════════════════════════════════════════
SELECT throws_ok(
  format(
    $$UPDATE public.invoice_line_item
         SET description = 'tampered'
       WHERE line_item_id = %L::uuid$$,
    current_setting('test.derived')
  ),
  '23514',
  NULL,
  'UPDATE of usage-backed line on issued invoice throws check_violation'
);

-- ═══════════════════════════════════════════════════════════════
-- 3. DELETE of usage-backed line on issued invoice rejected
-- ═══════════════════════════════════════════════════════════════
SELECT throws_ok(
  format(
    $$DELETE FROM public.invoice_line_item WHERE line_item_id = %L::uuid$$,
    current_setting('test.derived')
  ),
  '23514',
  NULL,
  'DELETE of usage-backed line on issued invoice throws check_violation'
);

-- ═══════════════════════════════════════════════════════════════
-- 4. Ad-hoc invoice composition: invoice_type='one_off' + manual lines
-- ═══════════════════════════════════════════════════════════════
SET session_replication_role = 'replica';

DO $$
DECLARE
  v_company uuid := current_setting('test.company')::uuid;
  v_adhoc   uuid := gen_random_uuid();
  v_l1      uuid := gen_random_uuid();
  v_l2      uuid := gen_random_uuid();
BEGIN
  PERFORM set_config('test.adhoc', v_adhoc::text, false);

  INSERT INTO public.invoice (
    invoice_id, company_id, invoice_type, status,
    period_from, period_to,
    amount_excl_vat, vat_rate, vat_amount, amount_incl_vat
  ) VALUES (
    v_adhoc, v_company, 'one_off', 'draft',
    '2026-05-01', '2026-05-01',
    6000, 25, 1500, 7500
  );

  INSERT INTO public.invoice_line_item (
    line_item_id, invoice_id, line_type, description,
    quantity, unit_price, amount_excl_vat, vat_rate, vat_amount, amount_incl_vat,
    usage_snapshot_id
  ) VALUES
    (v_l1, v_adhoc, 'adjustment', 'Oppstartsgebyr',
     1, 5000, 5000, 25, 1250, 6250, NULL),
    (v_l2, v_adhoc, 'adjustment', 'Konsulenttime',
     2, 500, 1000, 25, 250, 1250, NULL);
END $$;

SET session_replication_role = 'origin';

SELECT is(
  (SELECT invoice_type::text FROM public.invoice
     WHERE invoice_id = current_setting('test.adhoc')::uuid),
  'one_off',
  'Ad-hoc invoice has invoice_type=one_off (no new enum needed)'
);

SELECT is(
  (SELECT count(*)::int FROM public.invoice_line_item
     WHERE invoice_id = current_setting('test.adhoc')::uuid
       AND usage_snapshot_id IS NULL),
  2,
  'Ad-hoc invoice has 2 manual lines (usage_snapshot_id NULL on all)'
);

-- None of the ad-hoc lines carries a usage_snapshot binding.
SELECT is(
  (SELECT count(*)::int FROM public.invoice_line_item
     WHERE invoice_id = current_setting('test.adhoc')::uuid
       AND usage_snapshot_id IS NOT NULL),
  0,
  'Ad-hoc invoice has no usage-backed lines'
);

SELECT * FROM finish();
ROLLBACK;
