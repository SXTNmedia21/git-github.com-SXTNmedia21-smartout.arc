-- Billing Engine Fase 2 — B1 structural tests (Migration J)
-- Run with: npx supabase db test
--
-- Scope:
--   1. Enums exist (Migration A)
--   2. Tables exist with required columns (Migrations B-E)
--   3. RLS enabled + policies named correctly (Migration G)
--   4. CHECK constraint on billing_dispatch_rule (ADR-0127)
--   5. Immutability trigger (Migration F, ADR-0119)
--   6. canonical_json correctness (Migration H)
--   7. effective_dispatch_rules suppress semantics (Migration H)
--   8. Event-name convention audit: no '.' in engine_trigger.event_type
--      or billing_dispatch_rule.trigger_event (ADR/spec §11)
--   9. Engine process seeds exist (Migration I)

BEGIN;
SELECT plan(46);

-- ═══════════════════════════════════════════════════════════════
-- 1. Enums exist
-- ═══════════════════════════════════════════════════════════════
SELECT has_type('public', 'billing_dispatch_channel',
  'billing_dispatch_channel enum exists');
SELECT has_type('public', 'dispatch_status',
  'dispatch_status enum exists');
SELECT has_type('public', 'dispatch_rule_action',
  'dispatch_rule_action enum exists');
SELECT has_type('public', 'billing_integration_type',
  'billing_integration_type enum exists');

-- Enum values present
SELECT ok(
  array['email_customer', 'email_internal', 'http_api', 'peppol_ehf']::text[] <@ (
    SELECT array_agg(enumlabel::text)
    FROM pg_enum WHERE enumtypid = 'public.billing_dispatch_channel'::regtype
  ),
  'billing_dispatch_channel contains all 4 required values'
);

SELECT ok(
  array['send', 'suppress']::text[] <@ (
    SELECT array_agg(enumlabel::text)
    FROM pg_enum WHERE enumtypid = 'public.dispatch_rule_action'::regtype
  ),
  'dispatch_rule_action contains send + suppress'
);

SELECT ok(
  array['fiken', 'tripletex', 'stripe', 'placeholder']::text[] <@ (
    SELECT array_agg(enumlabel::text)
    FROM pg_enum WHERE enumtypid = 'public.billing_integration_type'::regtype
  ),
  'billing_integration_type contains all 4 required values'
);

-- ═══════════════════════════════════════════════════════════════
-- 2. Tables + columns
-- ═══════════════════════════════════════════════════════════════
SELECT has_table('public', 'billing_dispatch_rule',
  'billing_dispatch_rule table exists');
SELECT has_table('public', 'billing_dispatch_template',
  'billing_dispatch_template table exists');
SELECT has_table('public', 'invoice_dispatch',
  'invoice_dispatch table exists');
SELECT has_table('public', 'billing_integration',
  'billing_integration table exists');

SELECT has_column('public', 'invoice_dispatch', 'engine_state_id',
  'invoice_dispatch has engine_state_id FK (ADR-0126)');

SELECT has_column('public', 'billing_integration', 'is_placeholder',
  'billing_integration has is_placeholder boolean (ADR-0129)');

-- Default for is_placeholder must be false (ADR-0129 agent-review gate)
SELECT is(
  (SELECT column_default
     FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'billing_integration'
      AND column_name = 'is_placeholder'),
  'false',
  'billing_integration.is_placeholder defaults to false'
);

-- ═══════════════════════════════════════════════════════════════
-- 3. RLS enabled + policy naming (Migration G)
-- ═══════════════════════════════════════════════════════════════
SELECT ok(
  (SELECT relrowsecurity FROM pg_class
   WHERE relname = 'billing_dispatch_rule' AND relnamespace = 'public'::regnamespace),
  'RLS enabled on billing_dispatch_rule'
);
SELECT ok(
  (SELECT relrowsecurity FROM pg_class
   WHERE relname = 'billing_dispatch_template' AND relnamespace = 'public'::regnamespace),
  'RLS enabled on billing_dispatch_template'
);
SELECT ok(
  (SELECT relrowsecurity FROM pg_class
   WHERE relname = 'invoice_dispatch' AND relnamespace = 'public'::regnamespace),
  'RLS enabled on invoice_dispatch'
);
SELECT ok(
  (SELECT relrowsecurity FROM pg_class
   WHERE relname = 'billing_integration' AND relnamespace = 'public'::regnamespace),
  'RLS enabled on billing_integration'
);

SELECT policies_are('public', 'billing_dispatch_rule',
  ARRAY[
    'billing_dispatch_rule_platform_admin_all',
    'billing_dispatch_rule_workspace_admin_read',
    'billing_dispatch_rule_workspace_admin_own_crud'
  ],
  'billing_dispatch_rule has expected policy set'
);

SELECT policies_are('public', 'billing_dispatch_template',
  ARRAY[
    'billing_dispatch_template_platform_admin_all',
    'billing_dispatch_template_workspace_admin_read'
  ],
  'billing_dispatch_template has expected policy set'
);

SELECT policies_are('public', 'invoice_dispatch',
  ARRAY[
    'invoice_dispatch_platform_admin_all',
    'invoice_dispatch_workspace_admin_read'
  ],
  'invoice_dispatch has expected policy set'
);

-- Fase 3B migration D (20260513000003_billing_integration_workspace_rls.sql)
-- adds billing_integration_workspace_admin_own_crud to give workspace-admins
-- self-serve OAuth-integration CRUD. The Fase 2 platform-admin-only policy
-- stays; the updated set is the superset below.
SELECT policies_are('public', 'billing_integration',
  ARRAY[
    'billing_integration_platform_admin_all',
    'billing_integration_workspace_admin_own_crud'
  ],
  'billing_integration has platform-admin policy + Fase 3B workspace-admin CRUD'
);

-- ═══════════════════════════════════════════════════════════════
-- 4. CHECK constraint on billing_dispatch_rule (ADR-0127)
-- ═══════════════════════════════════════════════════════════════
-- Platform rules (workspace_id NULL) with action='suppress' must be rejected.
-- We need a fixture to attempt insertion — the constraint alone does not
-- require other tables for this check.
SELECT throws_ok(
  $$INSERT INTO public.billing_dispatch_rule
      (workspace_id, channel, trigger_event, target, action)
    VALUES (NULL, 'email_customer', 'invoice issued', '{}'::jsonb, 'suppress')$$,
  '23514',   -- check_violation
  NULL,
  'Platform rule with action=suppress is rejected (ADR-0127 CHECK)'
);

-- Platform rule with company_id is rejected by CHECK constraint.
-- (CHECK fires before FK, so error code is check_violation = 23514.)
SELECT throws_ok(
  $$INSERT INTO public.billing_dispatch_rule
      (workspace_id, company_id, channel, trigger_event, target, action)
    VALUES (NULL, gen_random_uuid(), 'email_customer', 'invoice issued', '{}'::jsonb, 'send')$$,
  '23514',
  NULL,
  'Platform rule with company_id is rejected (ADR-0127 CHECK)'
);

-- trigger_event with '.' is rejected (event-name convention)
SELECT throws_ok(
  $$INSERT INTO public.billing_dispatch_rule
      (workspace_id, channel, trigger_event, target, action)
    VALUES (NULL, 'email_customer', 'invoice.issued', '{}'::jsonb, 'send')$$,
  '23514',
  NULL,
  'trigger_event with dot-separator is rejected (CHECK)'
);

-- ═══════════════════════════════════════════════════════════════
-- 5. Immutability trigger — usage-backed line is locked once issued
-- ═══════════════════════════════════════════════════════════════
-- Fixture: company + issued invoice + usage-backed line.
SET session_replication_role = 'replica';

DO $$
DECLARE
  v_company uuid := gen_random_uuid();
  v_invoice uuid := gen_random_uuid();
  v_line    uuid := gen_random_uuid();
  v_snap    uuid := gen_random_uuid();
BEGIN
  PERFORM set_config('test.imm_company', v_company::text, false);
  PERFORM set_config('test.imm_invoice', v_invoice::text, false);
  PERFORM set_config('test.imm_line',    v_line::text,    false);
  PERFORM set_config('test.imm_snap',    v_snap::text,    false);

  INSERT INTO public.company (company_id, name, org_number, default_currency)
  VALUES (v_company, 'Immutability Co', NULL, 'NOK');

  INSERT INTO public.invoice (
    invoice_id, company_id, invoice_type, status,
    period_from, period_to,
    amount_excl_vat, vat_rate, vat_amount, amount_incl_vat
  ) VALUES (
    v_invoice, v_company, 'recurring', 'issued',
    '2026-05-01', '2026-05-31',
    100, 25, 25, 125
  );

  INSERT INTO public.invoice_line_item (
    line_item_id, invoice_id, line_type, description,
    quantity, unit_price, amount_excl_vat, vat_rate, vat_amount, amount_incl_vat,
    usage_snapshot_id
  ) VALUES (
    v_line, v_invoice, 'base_plan', 'Usage-backed line',
    1, 100, 100, 25, 25, 125,
    v_snap
  );
END $$;

SET session_replication_role = 'origin';

-- UPDATE of usage-backed line on issued invoice must fail
SELECT throws_ok(
  format(
    $$UPDATE public.invoice_line_item
        SET description = 'changed'
      WHERE line_item_id = %L::uuid$$,
    current_setting('test.imm_line')
  ),
  '23514',
  NULL,
  'UPDATE of usage-backed line on issued invoice is rejected'
);

-- DELETE of usage-backed line on issued invoice must fail
SELECT throws_ok(
  format(
    $$DELETE FROM public.invoice_line_item WHERE line_item_id = %L::uuid$$,
    current_setting('test.imm_line')
  ),
  '23514',
  NULL,
  'DELETE of usage-backed line on issued invoice is rejected'
);

-- Manual line (usage_snapshot_id NULL) on DRAFT invoice must be mutable
DO $$
DECLARE
  v_comp uuid := gen_random_uuid();
  v_inv  uuid := gen_random_uuid();
  v_line uuid := gen_random_uuid();
BEGIN
  PERFORM set_config('test.mut_line', v_line::text, false);
  SET session_replication_role = 'replica';
  INSERT INTO public.company (company_id, name, org_number, default_currency)
  VALUES (v_comp, 'Mutable Co', NULL, 'NOK');
  INSERT INTO public.invoice (
    invoice_id, company_id, invoice_type, status,
    period_from, period_to,
    amount_excl_vat, vat_rate, vat_amount, amount_incl_vat
  ) VALUES (
    v_inv, v_comp, 'recurring', 'draft',
    '2026-06-01', '2026-06-30',
    0, 25, 0, 0
  );
  INSERT INTO public.invoice_line_item (
    line_item_id, invoice_id, line_type, description,
    quantity, unit_price, amount_excl_vat, vat_rate, vat_amount, amount_incl_vat,
    usage_snapshot_id
  ) VALUES (
    v_line, v_inv, 'adjustment', 'Manual line',
    1, 50, 50, 25, 12.5, 62.5,
    NULL
  );
  SET session_replication_role = 'origin';
END $$;

SELECT lives_ok(
  format(
    $$UPDATE public.invoice_line_item SET description = 'edited'
      WHERE line_item_id = %L::uuid$$,
    current_setting('test.mut_line')
  ),
  'Manual line on draft invoice remains mutable'
);

-- ═══════════════════════════════════════════════════════════════
-- 6. canonical_json correctness (ADR-0127)
-- ═══════════════════════════════════════════════════════════════
SELECT is(
  public.canonical_json('{"b": 1, "a": 2}'::jsonb),
  public.canonical_json('{"a": 2, "b": 1}'::jsonb),
  'canonical_json normalises key order (commutative)'
);

SELECT is(
  public.canonical_json('{"nested": {"z": 1, "a": 2}, "top": "v"}'::jsonb),
  public.canonical_json('{"top": "v", "nested": {"a": 2, "z": 1}}'::jsonb),
  'canonical_json normalises recursively'
);

SELECT is(
  public.canonical_json(NULL::jsonb),
  NULL,
  'canonical_json(NULL) returns NULL'
);

SELECT is(
  public.canonical_json('[1, 2, 3]'::jsonb),
  '[1, 2, 3]'::jsonb,
  'canonical_json preserves array order'
);

SELECT is(
  public.canonical_json('[{"b": 1, "a": 2}, {"d": 4, "c": 3}]'::jsonb),
  '[{"a": 2, "b": 1}, {"c": 3, "d": 4}]'::jsonb,
  'canonical_json normalises object keys inside array elements'
);

-- Verify IMMUTABLE marker (required for use in expression indexes)
SELECT ok(
  (SELECT provolatile = 'i'
     FROM pg_proc
    WHERE proname = 'canonical_json'
      AND pronamespace = 'public'::regnamespace
    LIMIT 1),
  'canonical_json is marked IMMUTABLE'
);

-- ═══════════════════════════════════════════════════════════════
-- 7. effective_dispatch_rules suppress semantics
-- ═══════════════════════════════════════════════════════════════
-- Fixture: workspace + company-in-workspace + invoice + platform rule +
-- workspace suppress rule with matching dedup-key.
SET session_replication_role = 'replica';

DO $$
DECLARE
  v_workspace uuid := gen_random_uuid();
  v_company   uuid := gen_random_uuid();
  v_invoice   uuid := gen_random_uuid();
BEGIN
  PERFORM set_config('test.eff_workspace', v_workspace::text, false);
  PERFORM set_config('test.eff_company',   v_company::text,   false);
  PERFORM set_config('test.eff_invoice',   v_invoice::text,   false);

  -- Create company first (workspace.company_id FK).
  INSERT INTO public.company (company_id, name, org_number, default_currency)
  VALUES (v_company, 'Effective Co', NULL, 'NOK');

  INSERT INTO public.workspace (workspace_id, name, slug, company_id)
  VALUES (v_workspace, 'Effective WS', 'effective-ws-' || substr(v_workspace::text, 1, 8), v_company);

  INSERT INTO public.invoice (
    invoice_id, company_id, invoice_type, status,
    period_from, period_to,
    amount_excl_vat, vat_rate, vat_amount, amount_incl_vat
  ) VALUES (
    v_invoice, v_company, 'recurring', 'issued',
    '2026-07-01', '2026-07-31',
    100, 25, 25, 125
  );

  -- Platform rule: send invoice to Smartout audit via email_internal
  INSERT INTO public.billing_dispatch_rule
    (workspace_id, channel, trigger_event, target, action)
  VALUES
    (NULL, 'email_internal', 'invoice issued',
     '{"email": "audit@smartout.no"}'::jsonb, 'send');

  -- Workspace: suppress same rule (same dedup-key)
  INSERT INTO public.billing_dispatch_rule
    (workspace_id, channel, trigger_event, target, action)
  VALUES
    (v_workspace, 'email_internal', 'invoice issued',
     '{"email": "audit@smartout.no"}'::jsonb, 'suppress');

  -- Workspace adds own recipient
  INSERT INTO public.billing_dispatch_rule
    (workspace_id, channel, trigger_event, target, action)
  VALUES
    (v_workspace, 'email_customer', 'invoice issued',
     '{"email": "ar@workspace.no"}'::jsonb, 'send');
END $$;

SET session_replication_role = 'origin';

-- After suppression + addition: platform rule gone, workspace send remains
SELECT is(
  (SELECT count(*)::int
   FROM public.effective_dispatch_rules(
     current_setting('test.eff_invoice')::uuid,
     'invoice issued'
   )
   WHERE action = 'send'),
  1,
  'effective_dispatch_rules: 1 active send rule after suppress + add (platform suppressed, workspace send survives)'
);

SELECT is(
  (SELECT rule_source
   FROM public.effective_dispatch_rules(
     current_setting('test.eff_invoice')::uuid,
     'invoice issued'
   )
   WHERE action = 'send'
   LIMIT 1),
  'workspace'::text,
  'effective_dispatch_rules: the surviving send rule is the workspace one'
);

-- Suppress with different key ORDER in target jsonb must still match
-- platform rule — canonical_json-based dedup. Uses a dedicated
-- trigger_event (not 'invoice issued') to isolate from the earlier
-- scenario's fixture so the assertion measures only this case.
SET session_replication_role = 'replica';
DO $$
DECLARE
  v_workspace uuid := gen_random_uuid();
  v_company   uuid := gen_random_uuid();
  v_invoice   uuid := gen_random_uuid();
BEGIN
  PERFORM set_config('test.key_workspace', v_workspace::text, false);
  PERFORM set_config('test.key_company',   v_company::text,   false);
  PERFORM set_config('test.key_invoice',   v_invoice::text,   false);

  INSERT INTO public.company (company_id, name, org_number, default_currency)
  VALUES (v_company, 'KeyOrder Co', NULL, 'NOK');
  INSERT INTO public.workspace (workspace_id, name, slug, company_id)
  VALUES (v_workspace, 'KeyOrder WS', 'keyorder-ws-' || substr(v_workspace::text, 1, 8), v_company);
  INSERT INTO public.invoice (
    invoice_id, company_id, invoice_type, status,
    period_from, period_to,
    amount_excl_vat, vat_rate, vat_amount, amount_incl_vat
  ) VALUES (
    v_invoice, v_company, 'recurring', 'issued',
    '2026-08-01', '2026-08-31',
    100, 25, 25, 125
  );

  -- Dedicated trigger_event to isolate from scenario 1 platform/workspace
  -- rules that also match 'invoice issued'.
  -- Platform: target with keys in order a, b
  INSERT INTO public.billing_dispatch_rule
    (workspace_id, channel, trigger_event, target, action)
  VALUES
    (NULL, 'http_api', 'invoice keyorder_probe',
     '{"a": 1, "b": 2}'::jsonb, 'send');
  -- Workspace suppress: target with keys in REVERSE order b, a
  INSERT INTO public.billing_dispatch_rule
    (workspace_id, channel, trigger_event, target, action)
  VALUES
    (v_workspace, 'http_api', 'invoice keyorder_probe',
     '{"b": 2, "a": 1}'::jsonb, 'suppress');
END $$;
SET session_replication_role = 'origin';

SELECT is(
  (SELECT count(*)::int
   FROM public.effective_dispatch_rules(
     current_setting('test.key_invoice')::uuid,
     'invoice keyorder_probe'
   )),
  0,
  'effective_dispatch_rules: key-order drift does NOT bypass suppression (canonical_json dedup)'
);

-- ═══════════════════════════════════════════════════════════════
-- 8. Event-name convention audit (Fase 2 scope)
-- ═══════════════════════════════════════════════════════════════
-- Legacy engine_trigger rows use dot-separator from pre-Fase-2 work —
-- those are a known technical debt tracked outside this plan. Fase 2's
-- CHECK constraint + this scoped audit prevent regression on NEW billing
-- triggers and on billing_dispatch_rule rows.

-- No engine_trigger row owned by Fase 2 billing engine_processes may use
-- dot-separator in event_type.
SELECT is(
  (SELECT count(*)::int FROM public.engine_trigger
   WHERE process_id IN ('invoice_dispatch_delivery', 'integration_sync')
     AND position('.' in event_type) > 0),
  0,
  'engine_trigger (Fase 2 billing processes): no event_type uses dot-separator'
);

-- No billing_dispatch_rule trigger_event may contain '.' (CHECK enforces
-- this on insert; this is a runtime audit that catches pre-existing data).
SELECT is(
  (SELECT count(*)::int FROM public.billing_dispatch_rule
   WHERE position('.' in trigger_event) > 0),
  0,
  'billing_dispatch_rule: no trigger_event contains dot-separator'
);

-- ═══════════════════════════════════════════════════════════════
-- 9. Engine process seeds
-- ═══════════════════════════════════════════════════════════════
SELECT is(
  (SELECT count(*)::int FROM public.engine_process
   WHERE id = 'invoice_dispatch_delivery'),
  1,
  'engine_process invoice_dispatch_delivery blueprint seeded (Migration I)'
);

SELECT is(
  (SELECT count(*)::int FROM public.engine_process
   WHERE id = 'integration_sync'),
  1,
  'engine_process integration_sync blueprint seeded (Migration I)'
);

SELECT is(
  (SELECT count(*)::int FROM public.engine_trigger
   WHERE process_id = 'invoice_dispatch_delivery'
     AND event_type = 'invoice issued'),
  1,
  'engine_trigger for (invoice_dispatch_delivery, invoice issued) seeded'
);

SELECT is(
  (SELECT count(*)::int FROM public.engine_trigger
   WHERE process_id = 'integration_sync'),
  5,
  'engine_trigger for integration_sync has 5 event rows'
);

-- action_type sanity
SELECT is(
  (SELECT action_type FROM public.engine_step
   WHERE process_id = 'invoice_dispatch_delivery' AND step_order = 1),
  'dispatch_invoice',
  'invoice_dispatch_delivery step 1 uses action_type=dispatch_invoice'
);

SELECT is(
  (SELECT action_type FROM public.engine_step
   WHERE process_id = 'integration_sync' AND step_order = 1),
  'sync_integration',
  'integration_sync step 1 uses action_type=sync_integration'
);

-- ADR-0126 guard: billing_integration_sync table MUST NOT exist
SELECT hasnt_table('public', 'billing_integration_sync',
  'billing_integration_sync table does NOT exist (ADR-0126 forbid parallel motor)');

SELECT * FROM finish();
ROLLBACK;
