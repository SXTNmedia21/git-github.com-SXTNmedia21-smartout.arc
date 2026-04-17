-- Billing Engine Fase 1 — RLS structural tests (Task 1.11)
-- Run with: npx supabase db test
--
-- Focus: policy existence + RLS enablement + helper function signature.
-- Runtime cross-tenant enforcement (JWT → RLS block) is covered by the
-- integration tests in apps/e2e (not pgTAP), because proper RLS testing
-- requires an authenticated Supabase client, not a psql superuser.

BEGIN;
SELECT plan(13);

-- ── is_admin_in_company helper (Task 1.1) ──────────────────────
SELECT has_function(
  'public', 'is_admin_in_company', ARRAY['uuid','uuid'],
  'is_admin_in_company(uuid, uuid) must exist'
);

SELECT is(
  pg_catalog.pg_get_function_result(
    (SELECT oid FROM pg_proc WHERE proname = 'is_admin_in_company' LIMIT 1)
  ),
  'boolean',
  'is_admin_in_company returns boolean'
);

-- prosecdef = true (SECURITY DEFINER)
SELECT ok(
  (SELECT prosecdef FROM pg_proc WHERE proname = 'is_admin_in_company' LIMIT 1),
  'is_admin_in_company is SECURITY DEFINER'
);

-- ── RLS enablement ────────────────────────────────────────────
SELECT ok(
  (SELECT relrowsecurity FROM pg_class WHERE relname = 'invoice' AND relnamespace = 'public'::regnamespace),
  'RLS enabled on invoice'
);
SELECT ok(
  (SELECT relrowsecurity FROM pg_class WHERE relname = 'invoice_line_item' AND relnamespace = 'public'::regnamespace),
  'RLS enabled on invoice_line_item'
);
SELECT ok(
  (SELECT relrowsecurity FROM pg_class WHERE relname = 'usage_snapshot' AND relnamespace = 'public'::regnamespace),
  'RLS enabled on usage_snapshot'
);
SELECT ok(
  (SELECT relrowsecurity FROM pg_class WHERE relname = 'basis_drift_event' AND relnamespace = 'public'::regnamespace),
  'RLS enabled on basis_drift_event'
);
SELECT ok(
  (SELECT relrowsecurity FROM pg_class WHERE relname = 'billing_activity_log' AND relnamespace = 'public'::regnamespace),
  'RLS enabled on billing_activity_log'
);

-- ── Policy presence (Task 1.9 + 1.7.5) ─────────────────────────
SELECT policies_are('public', 'invoice', ARRAY['invoice_company_admin_read'],
  'invoice has exactly one named policy');

SELECT policies_are('public', 'invoice_line_item', ARRAY['invoice_line_item_company_admin_read'],
  'invoice_line_item has exactly one named policy');

SELECT policies_are('public', 'usage_snapshot', ARRAY['usage_snapshot_company_admin_read'],
  'usage_snapshot has exactly one named policy');

-- basis_drift_event has NO policies (RLS enabled, platform-admin only)
SELECT policies_are('public', 'basis_drift_event', ARRAY[]::text[],
  'basis_drift_event has RLS enabled with NO policies (platform-admin only)');

SELECT policies_are('public', 'billing_activity_log', ARRAY['billing_log_company_admin_read'],
  'billing_activity_log has exactly one named policy (ADR-0125)');

SELECT * FROM finish();
ROLLBACK;
