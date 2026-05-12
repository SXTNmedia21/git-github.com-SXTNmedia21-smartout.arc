-- ============================================================================
-- engine_world_observe_platform permission regression test (ADR-0290).
-- Run with: psql "postgresql://postgres:postgres@localhost:54322/postgres" \
--             -f supabase/tests/engine-world-observe-platform-permissions.sql
--
-- Covers (audit 2026-05-10 F-DB-01 / G2 closure regression net):
--   1. service_role HAS EXECUTE — legitimate platform callers (heartbeat,
--      ci-incident-conductor, stage-engine async writer) keep working.
--   2. authenticated does NOT have EXECUTE — closes cross-tenant pollution
--      vector. Regression target: any future migration that re-grants
--      EXECUTE TO authenticated will fail this test.
--   3. anon does NOT have EXECUTE — closes anonymous-client vector.
--      Regression target: any PUBLIC-default ACL drift will fail this test.
--   4. PUBLIC role does NOT have EXECUTE — defense in depth against future
--      `GRANT EXECUTE ... TO PUBLIC` slips.
--
-- Refs: ADR-0290 (platform-RPC bypass), migration 20260526000000 (Phase 1 +
-- the original mistaken authenticated GRANT), migration 20260528010000
-- (F-DB01-FIX REVOKE).
-- ============================================================================

BEGIN;

-- ── 1. service_role HAS EXECUTE ────────────────────────────────────────────
DO $$
BEGIN
  IF NOT has_function_privilege(
    'service_role',
    'public.engine_world_observe_platform(text, engine_world_surface_type, engine_world_status, jsonb, integer, text)',
    'EXECUTE'
  ) THEN
    RAISE EXCEPTION
      'service_role MUST have EXECUTE on engine_world_observe_platform — '
      'legitimate platform callers (heartbeat, ci-conductor, stage-engine) '
      'depend on it (ADR-0290 path b)';
  END IF;
  RAISE NOTICE 'PASS 1/4: service_role has EXECUTE';
END $$;

-- ── 2. authenticated does NOT have EXECUTE ─────────────────────────────────
DO $$
BEGIN
  IF has_function_privilege(
    'authenticated',
    'public.engine_world_observe_platform(text, engine_world_surface_type, engine_world_status, jsonb, integer, text)',
    'EXECUTE'
  ) THEN
    RAISE EXCEPTION
      'authenticated MUST NOT have EXECUTE on engine_world_observe_platform — '
      're-opens cross-tenant pollution vector (audit 2026-05-10 F-DB-01). '
      'User-facing writes go through gated report_observation tool, '
      'not this RPC (ADR-0290 path a vs b distinction)';
  END IF;
  RAISE NOTICE 'PASS 2/4: authenticated does NOT have EXECUTE';
END $$;

-- ── 3. anon does NOT have EXECUTE ──────────────────────────────────────────
DO $$
BEGIN
  IF has_function_privilege(
    'anon',
    'public.engine_world_observe_platform(text, engine_world_surface_type, engine_world_status, jsonb, integer, text)',
    'EXECUTE'
  ) THEN
    RAISE EXCEPTION
      'anon MUST NOT have EXECUTE on engine_world_observe_platform — '
      'anonymous clients have no business writing platform-shared engine_world surfaces';
  END IF;
  RAISE NOTICE 'PASS 3/4: anon does NOT have EXECUTE';
END $$;

-- ── 4. PUBLIC does NOT have EXECUTE ────────────────────────────────────────
DO $$
BEGIN
  IF has_function_privilege(
    'public',
    'public.engine_world_observe_platform(text, engine_world_surface_type, engine_world_status, jsonb, integer, text)',
    'EXECUTE'
  ) THEN
    RAISE EXCEPTION
      'PUBLIC role MUST NOT have EXECUTE on engine_world_observe_platform — '
      'defense-in-depth against ACL drift';
  END IF;
  RAISE NOTICE 'PASS 4/4: PUBLIC does NOT have EXECUTE';
END $$;

-- ── Verdict ────────────────────────────────────────────────────────────────
DO $$
BEGIN
  RAISE NOTICE 'engine_world_observe_platform permissions: PASS — service_role only';
END $$;

ROLLBACK;
