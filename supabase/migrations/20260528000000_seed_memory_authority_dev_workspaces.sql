-- ============================================================================
-- F-MEM-UNBLOCK: Seed memory capability authority for dev workspaces
--
-- Closes G1 (memory writer ungated). Phase A3 Item 5 — Phase A3 plan committed
-- this seed but the migration was never written. Result: engine_authority_config
-- has no row for `memory` capability on any workspace; default `read_only` hides
-- save_memory tool (suggest-tier) from agent toolset.
--
-- Policy: opt-in-dev-only.
--   - 3 dev workspaces seeded with level='suggest', min_role='employee'.
--   - Production workspaces (strom-mat-bar, bardshaug-vegkro, yogurt-heaven,
--     villa-mat, bardshaug-grill, fjelds-mat, yogurt-heaven-seed) NOT seeded
--     here — they stay default read_only, opt in via separate UI flow per
--     ADR-0078 PII opt-in spec.
--
-- ON CONFLICT DO NOTHING — safe replay; (workspace_id, capability) is UNIQUE.
--
-- Refs: ADR-0078 (channel guard chat-only), ADR-0099 (gate_action),
--       ADR-0204 (gatedMutation orchestrator), memory/index.ts spec line 32.
-- ============================================================================

-- SELECT/WHERE pattern so the migration is FK-safe on fresh CI DBs where
-- the target workspace rows are seeded LATER by supabase/seed.sql. If the
-- workspace doesn't exist yet, no row is inserted (no FK violation); the
-- seed runs again on dev workspaces as a no-op via ON CONFLICT.
INSERT INTO engine_authority_config
  (workspace_id, capability, level, min_role, requires_four_eyes)
SELECT w.workspace_id, 'memory', 'suggest', 'employee', false
FROM workspace w
WHERE w.workspace_id IN (
  'b0000000-0000-0000-0000-000000000000'::uuid,  -- hq-workspace
  'b1000000-0000-0000-0000-000000000001'::uuid,  -- may2026-demo
  '00000000-0000-0000-0000-0000000000a1'::uuid   -- system
)
ON CONFLICT (workspace_id, capability) DO NOTHING;

-- Verification (manual run after migration):
--   SELECT workspace_id, capability, level, min_role
--     FROM engine_authority_config
--     WHERE capability = 'memory'
--     ORDER BY workspace_id;
-- Expected: 3 rows.
