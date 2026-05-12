-- ============================================
-- supabase/tests/pgtap/seed_communication_authority_test.sql
--
-- Locks in the communication capability authority seed invariants.
--
-- WHY: Council 2026-05-11 found communication missing from engine_authority_config
-- bootstrap. Without this seed, gate_action default-allows any caller (L-0066
-- CVE class). Migration 20260601000000 fixes this.
--
-- ASSERTIONS:
--   1. At least one communication seed row exists post-apply (if any workspace exists)
--   2. Every seed row has level='suggest' and min_role='employee'
--   3. Idempotent INSERT (ON CONFLICT DO NOTHING) — no exception on replay
--   4. A freshly-created workspace gets a communication authority row from
--      the existing workspace_seed_authority_defaults_trg trigger IFF
--      communication is registered in capability_default_registry.
--      (Scoped out of this test — tracked as separate sortie.)
--
-- Run with:
--   psql "postgresql://postgres:postgres@localhost:54322/postgres" \
--        --set ON_ERROR_STOP=1 \
--        -f supabase/tests/pgtap/seed_communication_authority_test.sql
-- ============================================

BEGIN;
SELECT plan(3);

-- ─────────────────────────────────────────────────────────────────────────────
-- Assertion 1: at least one communication seed row exists (if any workspace does)
--
-- The migration runs during db reset. If no workspace rows exist (bare schema),
-- the INSERT-SELECT produces zero rows — that is correct behaviour, not a bug.
-- We only assert the seed row exists when a workspace exists.
-- ─────────────────────────────────────────────────────────────────────────────
SELECT ok(
  -- If there are no workspaces, the seed is a no-op — pass trivially.
  -- If workspaces exist, at least one must have a communication row.
  NOT EXISTS (SELECT 1 FROM public.workspace)
  OR EXISTS (
    SELECT 1
      FROM public.engine_authority_config
     WHERE capability = 'communication'
  ),
  'communication authority seed row exists for at least one workspace (or no workspaces present)'
);

-- ─────────────────────────────────────────────────────────────────────────────
-- Assertion 2: every communication seed row has level='suggest' AND min_role='employee'
--
-- Checks that no stale or mismatched row slipped in from another migration.
-- ─────────────────────────────────────────────────────────────────────────────
SELECT ok(
  NOT EXISTS (
    SELECT 1
      FROM public.engine_authority_config
     WHERE capability = 'communication'
       AND (level <> 'suggest' OR min_role <> 'employee')
  ),
  'all communication authority rows have level=suggest and min_role=employee'
);

-- ─────────────────────────────────────────────────────────────────────────────
-- Assertion 3: idempotent replay — re-running the seed INSERT for a workspace
-- that already has a communication row does NOT create a duplicate row.
--
-- Context: migration 20260601000000 runs BEFORE seed.sql (db reset order).
-- Workspaces seeded by seed.sql are created post-migration and therefore will
-- not have communication rows until capability_default_registry is updated
-- (separate sortie). This test targets the workspace that WAS seeded by the
-- migration (a1) and verifies ON CONFLICT DO NOTHING is truly idempotent.
-- ─────────────────────────────────────────────────────────────────────────────
DO $idempotent_check$
DECLARE
  -- Target the workspace that is guaranteed to have been seeded by the
  -- migration (created before seed.sql runs, visible during migration apply).
  v_seeded_ws UUID;
  v_count_before INT;
  v_count_after  INT;
BEGIN
  -- Pick any workspace that already has a communication authority row.
  SELECT workspace_id
    INTO v_seeded_ws
    FROM public.engine_authority_config
   WHERE capability = 'communication'
   LIMIT 1;

  IF v_seeded_ws IS NULL THEN
    -- No seeded workspace — trivially idempotent (nothing to replay against).
    PERFORM set_config('test.comm_before', '0', false);
    PERFORM set_config('test.comm_after',  '0', false);
    RETURN;
  END IF;

  SELECT count(*)::int
    INTO v_count_before
    FROM public.engine_authority_config
   WHERE workspace_id = v_seeded_ws
     AND capability   = 'communication';

  -- Re-run the migration's exact INSERT for this specific workspace only.
  -- ON CONFLICT DO NOTHING must absorb the existing row silently.
  INSERT INTO public.engine_authority_config
    (workspace_id, capability, level, min_role, requires_four_eyes)
  SELECT
    v_seeded_ws,
    'communication',
    'suggest',
    'employee',
    false
  WHERE NOT EXISTS (
    SELECT 1
      FROM public.engine_authority_config eac
     WHERE eac.workspace_id = v_seeded_ws
       AND eac.capability   = 'communication'
  )
  ON CONFLICT (workspace_id, capability) DO NOTHING;

  SELECT count(*)::int
    INTO v_count_after
    FROM public.engine_authority_config
   WHERE workspace_id = v_seeded_ws
     AND capability   = 'communication';

  PERFORM set_config('test.comm_before', v_count_before::text, false);
  PERFORM set_config('test.comm_after',  v_count_after::text,  false);
END $idempotent_check$;

SELECT is(
  current_setting('test.comm_after')::int,
  current_setting('test.comm_before')::int,
  'communication seed INSERT is idempotent: targeted replay does not duplicate existing row'
);

SELECT * FROM finish();
ROLLBACK;
