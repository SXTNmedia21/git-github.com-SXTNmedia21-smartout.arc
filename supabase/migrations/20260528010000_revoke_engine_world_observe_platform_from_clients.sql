-- ============================================================================
-- F-DB01-FIX: Revoke engine_world_observe_platform from anon + authenticated
--
-- Closes G2 (audit 2026-05-10 F-DB-01 promotion-blocker). The Phase 1 migration
-- (20260526000000_engine_world_phase_1.sql) shipped GRANT EXECUTE TO authenticated
-- by mistake — ADR-0290 never authorized it. anon also retained EXECUTE due to
-- ACL drift on initial creation.
--
-- ADR-0290 intended callers are platform-level only:
--   - heartbeat jobs (engine-world-refresh) — service_role
--   - ci-incident-conductor — service_role
--   - stage-engine post-dispatch async writer — service_role
--
-- All three use service_role context. No user-facing JWT path is authorized
-- to write platform-shared engine_world surfaces. Authenticated user-facing
-- writes go through the gated `report_observation` capability tool, NOT this RPC
-- (per ADR-0290 §"User-facing writes" path a vs platform-level path b).
--
-- This migration:
--   1. REVOKES EXECUTE from authenticated + anon (closes the cross-tenant
--      pollution vector — authenticated client can no longer poison platform-
--      shared state)
--   2. Preserves service_role EXECUTE (legitimate platform callers unaffected)
--   3. Re-asserts REVOKE FROM PUBLIC for safety (in case PUBLIC ACL re-creep)
--
-- Verification:
--   SELECT proname, proacl FROM pg_proc WHERE proname = 'engine_world_observe_platform';
--   Expected: only postgres + service_role with X.
--
-- Rollback (DO NOT use in production — re-opens the vector):
--   GRANT EXECUTE ON FUNCTION public.engine_world_observe_platform TO authenticated;
--
-- Refs: ADR-0290 (platform-RPC bypass), audit 2026-05-10 F-DB-01.
-- ============================================================================

REVOKE EXECUTE ON FUNCTION public.engine_world_observe_platform FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.engine_world_observe_platform FROM anon;
REVOKE ALL ON FUNCTION public.engine_world_observe_platform FROM PUBLIC;

-- Re-assert legitimate caller (idempotent — already granted in Phase 1).
GRANT EXECUTE ON FUNCTION public.engine_world_observe_platform TO service_role;
