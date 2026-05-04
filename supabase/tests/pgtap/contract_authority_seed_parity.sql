-- ============================================
-- supabase/tests/pgtap/contract_authority_seed_parity.sql
--
-- Locks in the Fix #1 (ADR-0192) authority-seed CVE remediation:
--   1. capability_default_registry table exists with the required columns
--   2. 'contract' is registered with confirm/admin defaults
--   3. workspace_seed_authority_defaults_trg trigger exists on workspace
--   4. Inserting a fresh workspace auto-seeds engine_authority_config
--      with a 'contract' row at confirm/admin
--   5. The seed is idempotent under replay (no duplicate-key error)
--   6. Backfill UPSERT path is also idempotent (Part A in the migration)
--   7. The 'contract' authority row, when present, denies channel/role
--      mismatches via gate_action — i.e. NOT default-allow anymore.
--
-- Run with:
--   psql "postgresql://postgres:postgres@localhost:54322/postgres" \
--        --set ON_ERROR_STOP=1 \
--        -f supabase/tests/pgtap/contract_authority_seed_parity.sql
-- ============================================

BEGIN;
SELECT plan(12);

-- ─────────────────────────────────────────────
-- Section 1 — Registry table shape (3 assertions)
-- ─────────────────────────────────────────────

SELECT has_table(
  'public', 'capability_default_registry',
  'capability_default_registry table exists'
);

SELECT has_column(
  'public', 'capability_default_registry', 'capability',
  'capability_default_registry.capability column exists'
);

SELECT col_is_pk(
  'public', 'capability_default_registry', 'capability',
  'capability_default_registry.capability is PRIMARY KEY'
);

-- ─────────────────────────────────────────────
-- Section 2 — Registry content (2 assertions)
-- ─────────────────────────────────────────────

SELECT ok(
  EXISTS (
    SELECT 1 FROM public.capability_default_registry
    WHERE capability = 'contract'
  ),
  'contract is registered in capability_default_registry'
);

SELECT is(
  (SELECT level || '/' || min_role
     FROM public.capability_default_registry
    WHERE capability = 'contract'),
  'confirm/admin',
  'contract default is confirm/admin (Council Gate G4, ADR-0192)'
);

-- ─────────────────────────────────────────────
-- Section 3 — Trigger exists on workspace (1 assertion)
-- ─────────────────────────────────────────────

SELECT ok(
  (SELECT count(*)::int
     FROM pg_trigger tg
     JOIN pg_class t ON t.oid = tg.tgrelid
     JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE n.nspname = 'public'
      AND t.relname = 'workspace'
      AND tg.tgname = 'workspace_seed_authority_defaults_trg'
      AND NOT tg.tgisinternal) = 1,
  'AFTER INSERT trigger workspace_seed_authority_defaults_trg exists on workspace'
);

-- ─────────────────────────────────────────────
-- Section 4 — Bootstrap behavior on fresh workspace (3 assertions)
-- ─────────────────────────────────────────────
-- Insert a fresh company + workspace, then verify that authority rows
-- exist for 'contract' with the registry defaults.

DO $bootstrap_setup$
DECLARE
  v_company_id UUID := gen_random_uuid();
  v_ws_id      UUID := gen_random_uuid();
BEGIN
  INSERT INTO public.company (company_id, name)
  VALUES (v_company_id, 'Authority Bootstrap Co ' || substr(v_company_id::text, 1, 6));

  INSERT INTO public.workspace (workspace_id, company_id, name, slug)
  VALUES (
    v_ws_id, v_company_id,
    'Authority Bootstrap WS',
    'auth-bootstrap-' || substr(v_ws_id::text, 1, 8)
  );

  PERFORM set_config('test.bootstrap_ws_id', v_ws_id::text, false);
END $bootstrap_setup$;

SELECT ok(
  EXISTS (
    SELECT 1
    FROM public.engine_authority_config
    WHERE workspace_id = current_setting('test.bootstrap_ws_id')::uuid
      AND capability   = 'contract'
  ),
  'fresh workspace INSERT auto-seeds engine_authority_config row for contract'
);

SELECT is(
  (SELECT level
     FROM public.engine_authority_config
    WHERE workspace_id = current_setting('test.bootstrap_ws_id')::uuid
      AND capability   = 'contract'),
  'confirm',
  'bootstrapped contract row has level=confirm'
);

SELECT is(
  (SELECT min_role
     FROM public.engine_authority_config
    WHERE workspace_id = current_setting('test.bootstrap_ws_id')::uuid
      AND capability   = 'contract'),
  'admin',
  'bootstrapped contract row has min_role=admin'
);

-- ─────────────────────────────────────────────
-- Section 5 — Idempotency (2 assertions)
-- ─────────────────────────────────────────────
-- Re-run the trigger logic by manually calling the bootstrap UPSERT
-- against the same workspace. Must not throw and must not duplicate.

DO $idempotent_test$
DECLARE
  v_ws_id      UUID := current_setting('test.bootstrap_ws_id')::uuid;
  v_count_before INT;
  v_count_after  INT;
BEGIN
  SELECT count(*) INTO v_count_before
    FROM public.engine_authority_config
   WHERE workspace_id = v_ws_id;

  INSERT INTO public.engine_authority_config (
    workspace_id, capability, level, min_role,
    requires_four_eyes, observer_escalation_hours, updated_by
  )
  SELECT v_ws_id, r.capability, r.level, r.min_role,
         r.requires_four_eyes, r.observer_escalation_hours, NULL::uuid
  FROM public.capability_default_registry r
  ON CONFLICT (workspace_id, capability) DO NOTHING;

  SELECT count(*) INTO v_count_after
    FROM public.engine_authority_config
   WHERE workspace_id = v_ws_id;

  PERFORM set_config('test.idemp_before', v_count_before::text, false);
  PERFORM set_config('test.idemp_after',  v_count_after::text,  false);
END $idempotent_test$;

SELECT is(
  current_setting('test.idemp_after')::int,
  current_setting('test.idemp_before')::int,
  'idempotent UPSERT: row count unchanged after replay'
);

SELECT cmp_ok(
  current_setting('test.idemp_before')::int,
  '>=',
  1,
  'idempotency baseline: at least one authority row was bootstrapped'
);

-- ─────────────────────────────────────────────
-- Section 6 — Authority enforcement (1 assertion)
-- ─────────────────────────────────────────────
-- With the contract authority row present at level='confirm' min_role='admin',
-- gate_action() must downgrade an 'employee'-role caller (no longer
-- default-allow). Asserts the CVE class is closed end-to-end.

DO $gate_test$
DECLARE
  v_ws_id      UUID := current_setting('test.bootstrap_ws_id')::uuid;
  v_user_id    UUID := gen_random_uuid();
  v_profile_id UUID := gen_random_uuid();
  v_result     JSONB;
BEGIN
  -- Minimal user_identity + profile (employee role) for gate_action lookup.
  INSERT INTO auth.users (id, email, aud, role, instance_id) VALUES
    (v_user_id, 'gate+' || v_user_id || '@t.test', 'authenticated', 'authenticated',
     '00000000-0000-0000-0000-000000000000');

  INSERT INTO public.user_identity (user_id, email, first_name, last_name, is_godmode)
    VALUES (v_user_id, 'gate+' || v_user_id || '@t.test', 'Gate', 'Test', false)
    ON CONFLICT (user_id) DO NOTHING;

  INSERT INTO public.profile (
    profile_id, profile_code, user_id, workspace_id, company_id,
    role, is_active, display_name
  )
  SELECT
    v_profile_id, 'gate-' || substr(v_profile_id::text, 1, 6),
    v_user_id, v_ws_id, w.company_id,
    'employee', true, 'Gate Test'
  FROM public.workspace w
  WHERE w.workspace_id = v_ws_id;

  v_result := public.gate_action(
    p_workspace_id      => v_ws_id,
    p_capability        => 'contract',
    p_channel           => 'chat',
    p_actor_profile_id  => v_profile_id,
    p_action_type       => 'fork_template'
  );

  PERFORM set_config('test.gate_downgrade', COALESCE(v_result->>'downgrade_to', ''), false);
END $gate_test$;

SELECT is(
  current_setting('test.gate_downgrade'),
  'suggest',
  'gate_action downgrades employee-role caller to suggest (no longer default-allow)'
);

SELECT * FROM finish();
ROLLBACK;
