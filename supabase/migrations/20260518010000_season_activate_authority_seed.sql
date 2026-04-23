SET search_path TO public, extensions;

-- ============================================
-- 20260518010000_season_activate_authority_seed.sql
-- Year Wheel M1.3 — C4 authority seed for season.activate capability
--
-- Campaign: year-wheel · Milestone: M1 · Sub-sortie: M1.3
-- Binding ADR: 0200 (atomic season activation RPC + D1 cascade)
-- Binding learnings: L-0066 / L-0097 (authority default-allow CVE class)
-- Related ADRs: 0099 (gate_action unified authority gate),
--               0173 (capability model), 0176 (journey authority seed pattern),
--               0189 (authority seed parity CI check),
--               0091 (pathway B — RPC + gate_action stacking)
-- ============================================
--
-- PURPOSE
-- -------
-- Seed public.engine_authority_config with one row per workspace for the
-- `season.activate` capability defined in ADR-0200. Paired with the
-- Server Action that invokes `gateAction({capability: 'season.activate', ...})`
-- before calling the `activate_season` RPC.
--
-- The Server Action lives at `apps/web/src/app/dashboard/_actions/_shared.ts`
-- (M1.6 — same campaign/PR). This migration MUST land before or in the
-- same commit as the file that references the literal `'season.activate'`,
-- per ADR-0189 parity CI check and ADR-0200 §Invariant 4.
--
-- WHY SEED-BEFORE-CAPABILITY
-- --------------------------
-- public.gate_action (20260506120000_gate_action_accept_entity_id.sql:107-109)
-- default-allows any capability whose (workspace_id, capability) row is missing:
--
--   IF v_level IS NULL THEN
--     v_allow := true;
--
-- This is CVE-class (L-0066, L-0097). Until this row exists, any authenticated
-- user would pass the authority gate — the `min_role='manager'` enforcement
-- depends entirely on this seed row.
--
-- COLUMN SCHEMA (verified via 20260302000100 + ALTERs through 20260415120400)
-- --------------------------------------------------------------------------
--   workspace_id              uuid    NOT NULL  → from workspace row
--   capability                text    NOT NULL  → 'season.activate'
--   min_role                  text    NOT NULL  → 'manager' (CHECK: employee|manager|admin|owner)
--   level                     text    NOT NULL  → 'suggest' (CHECK: autonomous|confirm|suggest|read_only|disabled)
--   requires_four_eyes        boolean NOT NULL  → false (no four-eyes for season activation)
--   observer_escalation_hours integer NOT NULL  → 72 (default; no observer workflow bound)
--   updated_by                uuid    NULL      → NULL (platform seed; 20260414225000 made nullable)
--
-- COLUMN ORDER
-- ------------
-- Follows ADR-0200 §Authority seed exactly:
--   (workspace_id, capability, min_role, level, requires_four_eyes, observer_escalation_hours)
-- This differs from 20260516000400_journey_authority_seed.sql column order
-- but uses the same CROSS JOIN idempotent pattern. Explicit 5-column VALUES
-- matching 5-column SELECT (no column-default tricks — ADR-0200 council fix).
--
-- CAPABILITY KEY CONVENTION
-- -------------------------
-- Dot-notation (`season.activate`), consistent with `journey.run_dev`.
-- This establishes `season.*` as the namespace for gate_action-pathway
-- season capabilities. Colon-delimited `season:create` / `season:update`
-- capabilities (cascade_gate_write pathway A, ADR-0091) are distinct and
-- do NOT belong in engine_authority_config.
--
-- RISK
-- ----
-- Low. Pure INSERT, idempotent via ON CONFLICT. Reverts cleanly (see rollback).
-- The Server Action (M1.6) will reference this capability once it lands.
-- Until then, this row is future-use — ADR-0189 parity will report the literal
-- does not yet exist in code (expected, resolves when M1.6 ships).
--
-- DEPENDENCIES
-- ------------
--   - public.workspace exists (ancient, pre-2026).
--   - public.engine_authority_config exists (20260302000100) with the
--     columns listed above.
--   - uq_workspace_capability UNIQUE (workspace_id, capability) exists
--     (from 20260302000100) — required for ON CONFLICT.
--
-- ROLLBACK (manual, for reference)
-- --------------------------------
--   DELETE FROM public.engine_authority_config
--    WHERE capability = 'season.activate';
-- ============================================

INSERT INTO public.engine_authority_config
  (workspace_id, capability, min_role, level, requires_four_eyes, observer_escalation_hours)
SELECT
  w.workspace_id,
  v.capability,
  v.min_role,
  v.level,
  v.requires_four_eyes,
  v.observer_escalation_hours
FROM public.workspace w
CROSS JOIN (
  VALUES
    ('season.activate', 'manager', 'suggest', false, 72)
) AS v(capability, min_role, level, requires_four_eyes, observer_escalation_hours)
ON CONFLICT (workspace_id, capability) DO NOTHING;

COMMENT ON COLUMN public.engine_authority_config.capability IS
  'Capability name (matches packages/ai/src/capabilities/types.ts CapabilityName union). '
  'Added billing_query 2026-04-17; added session.signoff/session.close/broadcast.send 2026-05-15; '
  'added helpdesk_query 2026-05-15; added journey.run_dev/journey.publish_mission/'
  'journey.publish_guide/journey.run_guided 2026-04-22 (S1.3, ADR-0173 / ADR-0176); '
  'added season.activate 2026-05-18 (M1.3, ADR-0200).';
