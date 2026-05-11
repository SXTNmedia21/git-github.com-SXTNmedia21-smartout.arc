-- ============================================================================
-- F-MEM-UNBLOCK-A3 Task 1 — Seed engine_authority_config for `memory`
-- capability across all existing workspaces.
--
-- Context: migration 20260528000000 seeded 3 hardcoded UUIDs that matched
-- a previous DB layout. After the 2026-05-03 Bubble reset, real workspace
-- IDs changed. Only 1 row landed (system workspace). This migration closes
-- the gap by seeding every workspace that lacks a memory authority row.
--
-- Policy: opt-in-dev-wide.
--   level='suggest' — exposes save_memory tool (suggest-tier) to all
--     workspace agents for chat sessions. Voice path is gated at tool
--     execute() level via channel guard (ADR-0078 chat-only).
--   min_role='employee' — every authenticated user can trigger memory saves.
--
-- Production promotion path: review + admin UI opt-in per workspace before
-- production cutover. This seed is safe for dev: all 6 local workspaces
-- plus any future INSERT via workspace trigger will be covered by ON CONFLICT.
--
-- ON CONFLICT DO NOTHING — idempotent. Safe to replay.
--
-- seeded by F-MEM-UNBLOCK-A3 — exposes save_memory tool on chat without
-- further per-workspace config.
--
-- Refs: ADR-0078 (channel guard chat-only), ADR-0099 (gate_action first),
--       memory/index.ts defaultAuthority comment, BOTSSON-SYSTEM-MAP.md §G1.
-- ============================================================================

INSERT INTO engine_authority_config
  (workspace_id, capability, level, min_role, requires_four_eyes)
SELECT
  w.workspace_id,
  'memory',
  'suggest',
  'employee',
  false
FROM workspace w
WHERE NOT EXISTS (
  SELECT 1
    FROM engine_authority_config eac
   WHERE eac.workspace_id = w.workspace_id
     AND eac.capability   = 'memory'
)
ON CONFLICT (workspace_id, capability) DO NOTHING;

COMMENT ON TABLE engine_authority_config IS
  'C4 authority gate. memory capability seeded suggest-level for all workspaces by F-MEM-UNBLOCK-A3 (20260530000000). Production workspaces should review via admin UI before enabling in prod.';

-- Verification (manual):
--   SELECT w.name, eac.level, eac.min_role
--     FROM workspace w
--     JOIN engine_authority_config eac
--       ON eac.workspace_id = w.workspace_id
--    WHERE eac.capability = 'memory'
--    ORDER BY w.name;
-- Expected: one row per workspace with level='suggest'.
