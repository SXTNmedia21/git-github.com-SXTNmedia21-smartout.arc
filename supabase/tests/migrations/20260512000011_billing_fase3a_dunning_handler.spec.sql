-- Billing Engine Fase 3A — B4 dunning handler contract tests.
-- Run with: npx supabase db test
--
-- Scope:
--   1. dunning_status enum carries Fase 3A values (reminder_1 / reminder_2 /
--      collection_notice) — gap-fill Migration 20260512000009
--   2. invoice_status_dunning_legal CHECK accepts the new enum values for
--      active invoices (issued/sent/overdue)
--   3. Idempotency: re-running the escalation for the same (invoice,
--      stage) pair raises 23505 on dunning_escalation_log
--   4. Cascade: same-day run can advance an invoice across multiple
--      stages (e.g. NULL → reminder_1 → reminder_2 if the
--      transition targets are independent rows)
--   5. engine_process blueprint's action_payload stages match the
--      handler contract (days monotonic, from chain valid)
--
-- The handler itself is Deno/TS and cannot be invoked from pgTAP. These
-- tests verify the schema + constraints the handler relies on — any
-- divergence surfaces here before it surfaces in the daily cron.
--
-- Ref: ADR-0143, spec §4.2.

BEGIN;
SELECT plan(15);

-- ═══════════════════════════════════════════════════════════════
-- 1. dunning_status enum carries Fase 3A values
-- ═══════════════════════════════════════════════════════════════
SELECT ok(
  array['reminder_1', 'reminder_2', 'collection_notice']::text[] <@ (
    SELECT array_agg(enumlabel::text)
    FROM pg_enum WHERE enumtypid = 'public.dunning_status'::regtype
  ),
  'dunning_status enum contains Fase 3A values (Migration 20260512000009)'
);

-- Legacy values still present for backward compatibility.
SELECT ok(
  array['none', 'in_negotiation', 'reminder_sent', 'escalated']::text[] <@ (
    SELECT array_agg(enumlabel::text)
    FROM pg_enum WHERE enumtypid = 'public.dunning_status'::regtype
  ),
  'dunning_status enum retains legacy Fase 1 values'
);

-- ═══════════════════════════════════════════════════════════════
-- 2. engine_process blueprint payload contract
-- ═══════════════════════════════════════════════════════════════

SELECT ok(
  (
    SELECT action_payload->'stages'->0->>'to'
    FROM public.engine_step
    WHERE process_id = 'dunning_escalation_scan' AND step_order = 1
  ) = 'reminder_1',
  'stage[0].to = reminder_1'
);

SELECT ok(
  (
    SELECT (action_payload->'stages'->0->>'from') IS NULL
    FROM public.engine_step
    WHERE process_id = 'dunning_escalation_scan' AND step_order = 1
  ),
  'stage[0].from IS NULL (entry escalation)'
);

SELECT ok(
  (
    SELECT (action_payload->'stages'->1->>'from') = 'reminder_1'
       AND (action_payload->'stages'->1->>'to')   = 'reminder_2'
    FROM public.engine_step
    WHERE process_id = 'dunning_escalation_scan' AND step_order = 1
  ),
  'stage[1] transitions reminder_1 -> reminder_2'
);

SELECT ok(
  (
    SELECT (action_payload->'stages'->2->>'from') = 'reminder_2'
       AND (action_payload->'stages'->2->>'to')   = 'collection_notice'
    FROM public.engine_step
    WHERE process_id = 'dunning_escalation_scan' AND step_order = 1
  ),
  'stage[2] transitions reminder_2 -> collection_notice'
);

-- days ordering is strictly increasing (handler walks stages in order).
SELECT ok(
  (
    SELECT (action_payload->'stages'->0->>'days')::int
         < (action_payload->'stages'->1->>'days')::int
       AND (action_payload->'stages'->1->>'days')::int
         < (action_payload->'stages'->2->>'days')::int
    FROM public.engine_step
    WHERE process_id = 'dunning_escalation_scan' AND step_order = 1
  ),
  'stages are ordered by days ascending (cascade semantics)'
);

-- ═══════════════════════════════════════════════════════════════
-- 3. Fixtures — company + overdue invoice candidates
-- ═══════════════════════════════════════════════════════════════
-- session_replication_role='replica' bypasses FK validation so we can
-- seed the invoices without a full workspace graph. This is the same
-- pattern used in 20260512000009_billing_fase3a_schema.spec.sql.
SET session_replication_role = 'replica';
DO $$
DECLARE
  v_company  uuid := gen_random_uuid();
  v_inv3d    uuid := gen_random_uuid();
  v_inv7d    uuid := gen_random_uuid();
  v_inv14d   uuid := gen_random_uuid();
BEGIN
  PERFORM set_config('test.p_company', v_company::text, false);
  PERFORM set_config('test.p_inv3d',   v_inv3d::text,   false);
  PERFORM set_config('test.p_inv7d',   v_inv7d::text,   false);
  PERFORM set_config('test.p_inv14d',  v_inv14d::text,  false);

  INSERT INTO public.company (company_id, name, org_number, default_currency, billing_email)
  VALUES (v_company, 'B4 Dunning Test Co', NULL, 'NOK', 'ops@dunning-test.example');

  -- 3 days overdue, no prior escalation.
  -- Each fixture uses a distinct period to clear
  -- idx_invoice_one_recurring_per_period UNIQUE (company_id,
  -- period_from, period_to).
  INSERT INTO public.invoice (
    invoice_id, company_id, invoice_type, status,
    period_from, period_to, due_at,
    amount_excl_vat, vat_rate, vat_amount, amount_incl_vat,
    dunning_status
  ) VALUES (
    v_inv3d, v_company, 'recurring', 'sent',
    '2026-04-01', '2026-04-30', (now() - INTERVAL '3 days')::date,
    100, 25, 25, 125,
    NULL
  );

  -- 7 days overdue, already at reminder_1
  INSERT INTO public.invoice (
    invoice_id, company_id, invoice_type, status,
    period_from, period_to, due_at,
    amount_excl_vat, vat_rate, vat_amount, amount_incl_vat,
    dunning_status
  ) VALUES (
    v_inv7d, v_company, 'recurring', 'sent',
    '2026-03-01', '2026-03-31', (now() - INTERVAL '7 days')::date,
    100, 25, 25, 125,
    'reminder_1'
  );

  -- 14 days overdue, already at reminder_2
  INSERT INTO public.invoice (
    invoice_id, company_id, invoice_type, status,
    period_from, period_to, due_at,
    amount_excl_vat, vat_rate, vat_amount, amount_incl_vat,
    dunning_status
  ) VALUES (
    v_inv14d, v_company, 'recurring', 'sent',
    '2026-02-01', '2026-02-28', (now() - INTERVAL '14 days')::date,
    100, 25, 25, 125,
    'reminder_2'
  );
END $$;
SET session_replication_role = 'origin';

-- Sanity: all 3 invoices carry a valid dunning_status per
-- invoice_status_dunning_legal CHECK.
SELECT is(
  (SELECT count(*)::int FROM public.invoice
     WHERE invoice_id IN (
       current_setting('test.p_inv3d')::uuid,
       current_setting('test.p_inv7d')::uuid,
       current_setting('test.p_inv14d')::uuid
     )),
  3,
  'all 3 fixture invoices inserted (CHECK constraint accepts Fase 3A dunning_status)'
);

-- ═══════════════════════════════════════════════════════════════
-- 4. Simulate handler effects + assert idempotency
-- ═══════════════════════════════════════════════════════════════
-- We mimic the handler's per-invoice path:
--   1. INSERT dunning_escalation_log (idempotency gate)
--   2. UPDATE invoice.dunning_status
-- The handler's enqueue step is NOT simulated (Deno-only side effect).
-- These tests verify the invariants the handler relies on — if UNIQUE
-- stops holding or CHECK rejects a new value, the handler will fail
-- at the same point this test fails.

-- Stage 1: NULL -> reminder_1 for the 3-day invoice.
INSERT INTO public.dunning_escalation_log (invoice_id, from_stage, to_stage)
VALUES (current_setting('test.p_inv3d')::uuid, NULL, 'reminder_1');

UPDATE public.invoice
  SET dunning_status = 'reminder_1'
  WHERE invoice_id = current_setting('test.p_inv3d')::uuid;

SELECT is(
  (SELECT dunning_status::text FROM public.invoice
     WHERE invoice_id = current_setting('test.p_inv3d')::uuid),
  'reminder_1',
  'invoice.dunning_status advances to reminder_1 (enum accepts Fase 3A value)'
);

-- Idempotency: re-running the INSERT raises 23505.
SELECT throws_ok(
  format(
    $$INSERT INTO public.dunning_escalation_log (invoice_id, from_stage, to_stage)
      VALUES (%L::uuid, NULL, 'reminder_1')$$,
    current_setting('test.p_inv3d')
  ),
  '23505',
  NULL,
  're-inserting (invoice, reminder_1) raises unique_violation (ADR-0143 idempotency)'
);

-- Stage 2: reminder_1 -> reminder_2 for the 7-day invoice.
INSERT INTO public.dunning_escalation_log (invoice_id, from_stage, to_stage)
VALUES (current_setting('test.p_inv7d')::uuid, 'reminder_1', 'reminder_2');

UPDATE public.invoice
  SET dunning_status = 'reminder_2'
  WHERE invoice_id = current_setting('test.p_inv7d')::uuid;

SELECT is(
  (SELECT dunning_status::text FROM public.invoice
     WHERE invoice_id = current_setting('test.p_inv7d')::uuid),
  'reminder_2',
  'invoice.dunning_status advances to reminder_2'
);

-- Stage 3: reminder_2 -> collection_notice for the 14-day invoice.
INSERT INTO public.dunning_escalation_log (invoice_id, from_stage, to_stage)
VALUES (current_setting('test.p_inv14d')::uuid, 'reminder_2', 'collection_notice');

UPDATE public.invoice
  SET dunning_status = 'collection_notice'
  WHERE invoice_id = current_setting('test.p_inv14d')::uuid;

SELECT is(
  (SELECT dunning_status::text FROM public.invoice
     WHERE invoice_id = current_setting('test.p_inv14d')::uuid),
  'collection_notice',
  'invoice.dunning_status advances to collection_notice (terminal stage)'
);

-- ═══════════════════════════════════════════════════════════════
-- 5. Cross-stage idempotency — two stages for the same invoice
-- ═══════════════════════════════════════════════════════════════
-- A cascading day (e.g. an invoice that's 10 days overdue with
-- dunning_status=NULL) should be escalated first to reminder_1 then
-- picked up by stage 2 which re-queries. Both log rows coexist:
-- UNIQUE is (invoice, to_stage), NOT (invoice).
INSERT INTO public.dunning_escalation_log (invoice_id, from_stage, to_stage)
VALUES (current_setting('test.p_inv3d')::uuid, 'reminder_1', 'reminder_2');

SELECT is(
  (SELECT count(*)::int FROM public.dunning_escalation_log
     WHERE invoice_id = current_setting('test.p_inv3d')::uuid),
  2,
  'one invoice can accumulate multiple log rows (different to_stage values)'
);

-- ═══════════════════════════════════════════════════════════════
-- 6. invoice_status_dunning_legal CHECK accepts new enum values
-- ═══════════════════════════════════════════════════════════════
-- The CHECK was relaxed in Migration 20260417130100 to accept any
-- dunning_status for issued/sent/overdue. Still worth a direct assertion
-- since the handler relies on it.

SET session_replication_role = 'replica';
DO $$
DECLARE
  v_inv_collection uuid := gen_random_uuid();
BEGIN
  PERFORM set_config('test.p_inv_collection', v_inv_collection::text, false);
  -- Insert directly with collection_notice — if the CHECK rejects the
  -- new enum value, this fails with 23514.
  INSERT INTO public.invoice (
    invoice_id, company_id, invoice_type, status,
    period_from, period_to, due_at,
    amount_excl_vat, vat_rate, vat_amount, amount_incl_vat,
    dunning_status
  ) VALUES (
    v_inv_collection, current_setting('test.p_company')::uuid,
    'recurring', 'overdue',
    '2026-01-01', '2026-01-31', (now() - INTERVAL '30 days')::date,
    100, 25, 25, 125,
    'collection_notice'
  );
END $$;
SET session_replication_role = 'origin';

SELECT ok(
  EXISTS (
    SELECT 1 FROM public.invoice
    WHERE invoice_id = current_setting('test.p_inv_collection')::uuid
      AND dunning_status = 'collection_notice'
  ),
  'CHECK constraint accepts overdue + collection_notice combination'
);

-- Terminal invoice statuses (paid) must still require dunning_status IS NULL.
-- Use a distinct period to avoid colliding with the active-dunning fixtures
-- (CHECK is evaluated before UNIQUE so either order would surface the CHECK
-- violation, but picking a free period makes the test intention explicit).
SELECT throws_ok(
  format(
    $$INSERT INTO public.invoice (
        invoice_id, company_id, invoice_type, status,
        period_from, period_to,
        amount_excl_vat, vat_rate, vat_amount, amount_incl_vat,
        dunning_status
      ) VALUES (
        %L::uuid, %L::uuid, 'recurring', 'paid',
        '2025-12-01', '2025-12-31',
        100, 25, 25, 125,
        'reminder_1'
      )$$,
    gen_random_uuid(),
    current_setting('test.p_company')
  ),
  '23514',
  NULL,
  'CHECK rejects paid + reminder_1 (terminal status requires NULL dunning_status)'
);

SELECT * FROM finish();
ROLLBACK;
