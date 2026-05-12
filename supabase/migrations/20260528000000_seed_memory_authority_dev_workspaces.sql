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

-- Conditional dev-only seed: workspaces b0000000-/b1000000-/00000000-...-a1 live
-- in seed.sql (dev only). On production, those workspaces never exist, so this
-- migration is a no-op. The WHERE EXISTS guards make this safe on a fresh
-- `db reset` (where migrations run before seed.sql) AND on production
-- (where dev workspaces never exist).

INSERT INTO engine_authority_config
  (workspace_id, capability, level, min_role, requires_four_eyes)
SELECT
  'b0000000-0000-0000-0000-000000000000'::uuid, 'memory', 'suggest', 'employee', false  -- hq-workspace
WHERE EXISTS (
  SELECT 1 FROM workspace WHERE workspace_id = 'b0000000-0000-0000-0000-000000000000'::uuid
)
ON CONFLICT (workspace_id, capability) DO NOTHING;

INSERT INTO engine_authority_config
  (workspace_id, capability, level, min_role, requires_four_eyes)
SELECT
  'b1000000-0000-0000-0000-000000000001'::uuid, 'memory', 'suggest', 'employee', false  -- may2026-demo
WHERE EXISTS (
  SELECT 1 FROM workspace WHERE workspace_id = 'b1000000-0000-0000-0000-000000000001'::uuid
)
ON CONFLICT (workspace_id, capability) DO NOTHING;

INSERT INTO engine_authority_config
  (workspace_id, capability, level, min_role, requires_four_eyes)
SELECT
  '00000000-0000-0000-0000-0000000000a1'::uuid, 'memory', 'suggest', 'employee', false  -- system
WHERE EXISTS (
  SELECT 1 FROM workspace WHERE workspace_id = '00000000-0000-0000-0000-0000000000a1'::uuid
)
ON CONFLICT (workspace_id, capability) DO NOTHING;

-- Verification (manual run after migration):
--   SELECT workspace_id, capability, level, min_role
--     FROM engine_authority_config
--     WHERE capability = 'memory'
--     ORDER BY workspace_id;
-- Expected: 3 rows.
