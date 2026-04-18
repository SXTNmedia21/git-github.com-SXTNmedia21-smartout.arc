-- Billing Engine Fase 2 — B3 dispatch UI tests.
-- Run with: npx supabase db test
--
-- Scope:
--   1. CHECK constraint: platform rule (workspace_id NULL) with
--      action=suppress is rejected. Complements the Zod mirror.
--   2. CHECK constraint: platform rule with company_id set is rejected.
--   3. canonical_json UNION dedup: platform + workspace rules with
--      matching dedup-key + action=send produce exactly one active
--      rule, NOT two (workspace wins).
--   4. effective_dispatch_rules: a workspace 'send' rule with the same
--      dedup-key as a platform rule OVERRIDES (not adds) — the result
--      set must not contain both.
--   5. effective_dispatch_rules: a workspace rule in ANOTHER workspace
--      does NOT affect an invoice owned by this company's workspace.
--
-- RLS for workspace-admin read/CRUD is exercised indirectly by the
-- policy presence test in 20260511200000_billing_fase2_schema.spec.sql.
-- Full JWT-scoped RLS smoke is deferred to the B3 Playwright journey.

BEGIN;
SELECT plan(5);

-- ═══════════════════════════════════════════════════════════════
-- 1 + 2. Platform rule CHECK constraint (ADR-0127)
-- ═══════════════════════════════════════════════════════════════
-- ADR-0127: platform baseline rules (workspace_id NULL) must be
-- action=send AND cannot be company-scoped. CHECK constraint
-- billing_dispatch_rule_platform_constraints enforces this.

SELECT throws_ok(
  $$INSERT INTO public.billing_dispatch_rule
      (workspace_id, channel, trigger_event, target, action)
    VALUES
      (NULL, 'email_customer', 'invoice issued',
       '{"email": "x@y.z"}'::jsonb, 'suppress')$$,
  '23514',
  NULL,
  'Platform rule with action=suppress is rejected by CHECK constraint'
);

-- Company-scoped platform rule — should also fail.
-- We need a real company_id for the FK; set_replication skips the FK
-- check so we can also assert via a bogus uuid without impacting FK
-- integrity for the scope of this specific test.
SET session_replication_role = 'replica';
SELECT throws_ok(
  format(
    $$INSERT INTO public.billing_dispatch_rule
        (workspace_id, company_id, channel, trigger_event, target, action)
      VALUES
        (NULL, %L::uuid, 'email_customer', 'invoice issued',
         '{"email": "x@y.z"}'::jsonb, 'send')$$,
    gen_random_uuid()
  ),
  '23514',
  NULL,
  'Platform rule with company_id set is rejected by CHECK constraint'
);
SET session_replication_role = 'origin';

-- ═══════════════════════════════════════════════════════════════
-- 3. Workspace 'send' with same dedup-key as platform → override (no dup)
-- ═══════════════════════════════════════════════════════════════
-- Fixture: platform rule + workspace rule with matching
-- (channel, trigger_event, target). effective_dispatch_rules must
-- return ONLY the workspace rule (one result, rule_source='workspace').

SET session_replication_role = 'replica';
DO $$
DECLARE
  v_workspace uuid := gen_random_uuid();
  v_company   uuid := gen_random_uuid();
  v_invoice   uuid := gen_random_uuid();
BEGIN
  PERFORM set_config('test.ov_workspace', v_workspace::text, false);
  PERFORM set_config('test.ov_invoice',   v_invoice::text,   false);

  INSERT INTO public.company (company_id, name, org_number, default_currency)
  VALUES (v_company, 'Override Co', NULL, 'NOK');
  INSERT INTO public.workspace (workspace_id, name, slug, company_id)
  VALUES (v_workspace, 'Override WS', 'override-ws-' || substr(v_workspace::text, 1, 8), v_company);
  INSERT INTO public.invoice (
    invoice_id, company_id, invoice_type, status,
    period_from, period_to,
    amount_excl_vat, vat_rate, vat_amount, amount_incl_vat
  ) VALUES (
    v_invoice, v_company, 'recurring', 'issued',
    '2026-09-01', '2026-09-30', 100, 25, 25, 125
  );

  -- Platform baseline with dedicated trigger_event so we don't
  -- collide with 'invoice issued' scenarios in the main schema spec.
  INSERT INTO public.billing_dispatch_rule
    (workspace_id, channel, trigger_event, target, action)
  VALUES
    (NULL, 'email_customer', 'invoice ov_probe',
     '{"email": "audit@smartout.no"}'::jsonb, 'send');

  -- Workspace override: same dedup-key, also action=send
  INSERT INTO public.billing_dispatch_rule
    (workspace_id, channel, trigger_event, target, action)
  VALUES
    (v_workspace, 'email_customer', 'invoice ov_probe',
     '{"email": "audit@smartout.no"}'::jsonb, 'send');
END $$;
SET session_replication_role = 'origin';

SELECT is(
  (SELECT count(*)::int
   FROM public.effective_dispatch_rules(
     current_setting('test.ov_invoice')::uuid,
     'invoice ov_probe'
   )),
  1,
  'Workspace send with matching dedup-key overrides platform (one active rule, not two)'
);

SELECT is(
  (SELECT rule_source
   FROM public.effective_dispatch_rules(
     current_setting('test.ov_invoice')::uuid,
     'invoice ov_probe'
   )
   LIMIT 1),
  'workspace'::text,
  'Override surfaces with rule_source=workspace (workspace wins)'
);

-- ═══════════════════════════════════════════════════════════════
-- 5. Cross-workspace isolation: a rule in workspace B does not
--    affect an invoice in workspace A's company.
-- ═══════════════════════════════════════════════════════════════
SET session_replication_role = 'replica';
DO $$
DECLARE
  v_wsA  uuid := gen_random_uuid();
  v_wsB  uuid := gen_random_uuid();
  v_cA   uuid := gen_random_uuid();
  v_cB   uuid := gen_random_uuid();
  v_invA uuid := gen_random_uuid();
BEGIN
  PERFORM set_config('test.iso_invoice', v_invA::text, false);

  INSERT INTO public.company (company_id, name, org_number, default_currency)
  VALUES (v_cA, 'Iso Co A', NULL, 'NOK'),
         (v_cB, 'Iso Co B', NULL, 'NOK');
  INSERT INTO public.workspace (workspace_id, name, slug, company_id)
  VALUES
    (v_wsA, 'Iso WS A', 'iso-ws-a-' || substr(v_wsA::text, 1, 8), v_cA),
    (v_wsB, 'Iso WS B', 'iso-ws-b-' || substr(v_wsB::text, 1, 8), v_cB);

  INSERT INTO public.invoice (
    invoice_id, company_id, invoice_type, status,
    period_from, period_to,
    amount_excl_vat, vat_rate, vat_amount, amount_incl_vat
  ) VALUES (
    v_invA, v_cA, 'recurring', 'issued',
    '2026-10-01', '2026-10-31', 100, 25, 25, 125
  );

  -- Rule for workspace B only — MUST NOT surface for invoice in A.
  INSERT INTO public.billing_dispatch_rule
    (workspace_id, channel, trigger_event, target, action)
  VALUES
    (v_wsB, 'email_customer', 'invoice iso_probe',
     '{"email": "leak@workspace-b.no"}'::jsonb, 'send');
END $$;
SET session_replication_role = 'origin';

SELECT is(
  (SELECT count(*)::int
   FROM public.effective_dispatch_rules(
     current_setting('test.iso_invoice')::uuid,
     'invoice iso_probe'
   )),
  0,
  'Rules in other workspaces do not leak into effective set for this invoice'
);

SELECT * FROM finish();
ROLLBACK;
