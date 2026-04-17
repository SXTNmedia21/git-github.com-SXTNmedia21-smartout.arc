-- Billing Engine Fase 2 — B4 integration handler structural tests.
-- Run with: npx supabase db test
--
-- Scope: complements 20260511200000_billing_fase2_schema.spec.sql with
-- the focused assertions the B4 integration handler + UI rely on.
--
--   1. billing_integration.is_placeholder: column + default + behaviour
--      on INSERT/UPDATE (ADR-0129)
--   2. billing_integration_type enum values (placeholder + fiken +
--      tripletex + stripe)
--   3. RLS gate: platform-admin-only policy (no workspace-admin
--      access), matches Fase 2 spec §7 matrix for billing_integration.
--   4. last_sync_status CHECK constraint values
--
-- Parent test file (20260511200000_billing_fase2_schema.spec.sql)
-- already covers schema existence + the primary policy_name list. This
-- file drills into the ADR-0129 is_placeholder contract the B4 layer
-- depends on at runtime.

BEGIN;
SELECT plan(16);

-- ═══════════════════════════════════════════════════════════════
-- 1. is_placeholder column — default, nullability, ADR-0129
-- ═══════════════════════════════════════════════════════════════
SELECT has_column('public', 'billing_integration', 'is_placeholder',
  'billing_integration.is_placeholder exists (ADR-0129)');

SELECT col_not_null('public', 'billing_integration', 'is_placeholder',
  'billing_integration.is_placeholder is NOT NULL');

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
-- 2. enum values present (both real types + placeholder)
-- ═══════════════════════════════════════════════════════════════
SELECT ok(
  'placeholder'::text = ANY (
    SELECT enumlabel::text FROM pg_enum
     WHERE enumtypid = 'public.billing_integration_type'::regtype
  ),
  'billing_integration_type enum includes placeholder'
);

SELECT ok(
  array['fiken', 'tripletex', 'stripe']::text[] <@ (
    SELECT array_agg(enumlabel::text) FROM pg_enum
     WHERE enumtypid = 'public.billing_integration_type'::regtype
  ),
  'billing_integration_type enum includes fiken + tripletex + stripe'
);

-- ═══════════════════════════════════════════════════════════════
-- 3. INSERT / UPDATE behaviour — is_placeholder toggles independently
--    of is_enabled (ADR-0129 — both flags are orthogonal: ops may
--    enable a placeholder row, or disable a real one).
-- ═══════════════════════════════════════════════════════════════
SET session_replication_role = 'replica';

DO $$
DECLARE
  v_real    uuid := gen_random_uuid();
  v_mocked  uuid := gen_random_uuid();
BEGIN
  PERFORM set_config('test.int_real',   v_real::text,   false);
  PERFORM set_config('test.int_mocked', v_mocked::text, false);

  -- Non-placeholder: default is_placeholder=false, explicit is_enabled
  INSERT INTO public.billing_integration
    (integration_id, integration_type, display_name, is_enabled)
  VALUES
    (v_real, 'fiken', 'Fiken prod', true);

  -- Placeholder: is_placeholder=true, is_enabled=true (enabled mock
  -- for rehearsal).
  INSERT INTO public.billing_integration
    (integration_id, integration_type, display_name, is_enabled, is_placeholder)
  VALUES
    (v_mocked, 'placeholder', 'Fiken rehearsal', true, true);
END $$;

SET session_replication_role = 'origin';

SELECT is(
  (SELECT is_placeholder FROM public.billing_integration
    WHERE integration_id = current_setting('test.int_real')::uuid),
  false,
  'Non-placeholder insert with integration_type=fiken keeps is_placeholder=false'
);

SELECT is(
  (SELECT is_placeholder FROM public.billing_integration
    WHERE integration_id = current_setting('test.int_mocked')::uuid),
  true,
  'Placeholder insert preserves is_placeholder=true'
);

SELECT is(
  (SELECT is_enabled FROM public.billing_integration
    WHERE integration_id = current_setting('test.int_mocked')::uuid),
  true,
  'Placeholder row can still be is_enabled=true (rehearsal mode)'
);

-- UPDATE is_placeholder independently of is_enabled
UPDATE public.billing_integration
   SET is_placeholder = true
 WHERE integration_id = current_setting('test.int_real')::uuid;

SELECT is(
  (SELECT is_placeholder FROM public.billing_integration
    WHERE integration_id = current_setting('test.int_real')::uuid),
  true,
  'is_placeholder may be flipped to true on an existing non-placeholder row'
);

SELECT is(
  (SELECT is_enabled FROM public.billing_integration
    WHERE integration_id = current_setting('test.int_real')::uuid),
  true,
  'Flipping is_placeholder does not clobber is_enabled'
);

-- ═══════════════════════════════════════════════════════════════
-- 4. last_sync_status CHECK constraint
-- ═══════════════════════════════════════════════════════════════
-- Accepted values: NULL | 'ok' | 'error' | 'partial'
SET session_replication_role = 'replica';

DO $$
DECLARE
  v_ok uuid := gen_random_uuid();
BEGIN
  PERFORM set_config('test.int_status', v_ok::text, false);
  INSERT INTO public.billing_integration
    (integration_id, integration_type, display_name, last_sync_status)
  VALUES (v_ok, 'placeholder', 'Status check ok', 'ok');
END $$;

SET session_replication_role = 'origin';

SELECT is(
  (SELECT last_sync_status FROM public.billing_integration
    WHERE integration_id = current_setting('test.int_status')::uuid),
  'ok'::text,
  'last_sync_status accepts ok value'
);

-- Reject invalid value — target the seeded row via current_setting.
-- Static UUID in earlier revision affected zero rows and never fired CHECK.
SELECT throws_ok(
  format(
    $fmt$UPDATE public.billing_integration
           SET last_sync_status = 'bogus'
         WHERE integration_id = %L$fmt$,
    current_setting('test.int_status')
  ),
  '23514',
  NULL,
  'last_sync_status rejects values outside ok/error/partial/NULL (CHECK)'
);

-- ═══════════════════════════════════════════════════════════════
-- 5. RLS — Fase 2 spec §7: platform-admin-only on billing_integration
-- ═══════════════════════════════════════════════════════════════
-- RLS must be enabled.
SELECT ok(
  (SELECT relrowsecurity FROM pg_class
    WHERE relname = 'billing_integration'
      AND relnamespace = 'public'::regnamespace),
  'RLS enabled on billing_integration'
);

-- Exactly ONE policy — the platform-admin all-access one. Workspace-
-- admin access is Fase 3; if a workspace-admin policy appears here
-- before Fase 3 lands, the matrix was violated.
SELECT policies_are('public', 'billing_integration',
  ARRAY['billing_integration_platform_admin_all'],
  'billing_integration has only the platform-admin-all policy (Fase 2 §7)'
);

-- The policy must cover ALL commands, not just SELECT.
SELECT is(
  (SELECT cmd FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename  = 'billing_integration'
      AND policyname = 'billing_integration_platform_admin_all'),
  'ALL'::text,
  'billing_integration_platform_admin_all covers FOR ALL commands'
);

-- The policy USING expression must reference is_godmode on
-- user_identity (guards platform-admin-only access).
SELECT ok(
  (SELECT pg_get_expr(polqual, polrelid)
     FROM pg_policy
    WHERE polname = 'billing_integration_platform_admin_all'
      AND polrelid = 'public.billing_integration'::regclass) ILIKE '%is_godmode%',
  'billing_integration_platform_admin_all USING checks is_godmode (Fase 2 §7)'
);

SELECT * FROM finish();
ROLLBACK;
