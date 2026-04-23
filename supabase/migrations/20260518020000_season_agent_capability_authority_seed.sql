SET search_path TO public, extensions;

-- ============================================
-- 20260518020000_season_agent_capability_authority_seed.sql
-- Year Wheel M3 — C4 authority seed for 5 season.* agent capabilities
--
-- Campaign: year-wheel · Milestone: M3 · Sub-sortie: M3.4
-- Binding ADR: 0201 (season agent capability — five tools, authority seed, intent classifier)
-- Related ADRs: 0099 (gate_action default-allow CVE class),
--               0173 (journey capability model — dotted-key precedent),
--               0176 (journey authority seed pattern),
--               0189 (authority seed parity CI check),
--               0195 (per-tool dotted-key preservation),
--               0200 (season.activate seed — different key, not touched)
-- Binding learnings: L-0066 / L-0097 (authority default-allow CVE class)
-- ============================================
--
-- PURPOSE
-- -------
-- Seed public.engine_authority_config with one row per (workspace × capability)
-- for the five season agent capabilities defined in ADR-0201:
--
--   capability              | level      | min_role
--   ------------------------+------------+----------
--   season.create           | suggest    | admin
--   season.set_revenue      | suggest    | admin
--   season.save_playbook    | suggest    | admin
--   season.get_readiness    | read_only  | admin
--   season.learn_factors    | read_only  | admin
--
-- `season.activate` (ADR-0200, seeded by 20260518010000) is a DISTINCT key
-- reserved for the Server Action path. Not re-seeded here. ON CONFLICT
-- ensures idempotent replay regardless.
--
-- WHY SEED-BEFORE-CAPABILITY
-- --------------------------
-- public.gate_action (20260506120000_gate_action_accept_entity_id.sql:107-109)
-- default-allows any capability whose (workspace_id, capability) row is
-- missing:
--
--   IF v_level IS NULL THEN
--     v_allow := true;
--
-- This is CVE-class (L-0066, L-0097 — 2nd occurrence). If the capability
-- registration commit lands BEFORE this seed lands on preview, ANY workspace
-- could invoke any season.* capability in the gap window. This migration
-- therefore ships as a separate commit BEFORE the capability registration
-- (per ADR-0176 §seed-before-capability, ADR-0189 CI parity).
--
-- COLUMN SCHEMA
-- -------------
-- Mirrors 20260516000400_journey_authority_seed.sql exactly (7-column INSERT,
-- 5-column CROSS JOIN VALUES, updated_by=NULL platform-seed pattern).
-- Final column set:
--   workspace_id              uuid    NOT NULL  → from workspace row
--   capability                text    NOT NULL  → value from CROSS JOIN
--   level                     text    NOT NULL  → value from CROSS JOIN (CHECK: autonomous|confirm|suggest|read_only|disabled)
--   min_role                  text    NOT NULL  → value from CROSS JOIN (CHECK: employee|manager|admin|owner)
--   requires_four_eyes        boolean NOT NULL  → false (no four-eyes for season.* yet)
--   observer_escalation_hours integer NOT NULL  → 72 (column default; no observer workflow bound)
--   updated_by                uuid    NULL      → NULL (platform seed, no human actor — per 20260414225000)
--
-- RISK
-- ----
-- Low. Pure INSERT, idempotent via ON CONFLICT. Reverts cleanly (see
-- rollback). No application code depends on these rows until the capability
-- registration commit lands. ON CONFLICT DO NOTHING means replay/rerun is
-- safe; a future manual admin-UI override will not be clobbered.
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
--    WHERE capability IN (
--      'season.create',
--      'season.set_revenue',
--      'season.save_playbook',
--      'season.get_readiness',
--      'season.learn_factors'
--    );
--   -- Note: does NOT touch 'season.activate' (separate key, ADR-0200).
-- ============================================

INSERT INTO public.engine_authority_config (
  workspace_id,
  capability,
  level,
  min_role,
  requires_four_eyes,
  observer_escalation_hours,
  updated_by
)
SELECT
  w.workspace_id,
  v.capability,
  v.level,
  v.min_role,
  v.requires_four_eyes,
  v.observer_escalation_hours,
  NULL::uuid  -- platform seed, no human actor (per 20260414225000)
FROM public.workspace w
CROSS JOIN (
  VALUES
    ('season.create',        'suggest',   'admin', false, 72),
    ('season.set_revenue',   'suggest',   'admin', false, 72),
    ('season.save_playbook', 'suggest',   'admin', false, 72),
    ('season.get_readiness', 'read_only', 'admin', false, 72),
    ('season.learn_factors', 'read_only', 'admin', false, 72)
) AS v(capability, level, min_role, requires_four_eyes, observer_escalation_hours)
ON CONFLICT (workspace_id, capability) DO NOTHING;

COMMENT ON COLUMN public.engine_authority_config.capability IS
  'Capability name (matches packages/ai/src/capabilities/types.ts CapabilityName union). '
  'Added billing_query 2026-04-17; added session.signoff/session.close/broadcast.send 2026-05-15; '
  'added helpdesk_query 2026-05-15; added journey.run_dev/journey.publish_mission/'
  'journey.publish_guide/journey.run_guided 2026-04-22 (S1.3, ADR-0173 / ADR-0176); '
  'added season.activate 2026-05-18 (M1.3, ADR-0200); '
  'added season.create/season.set_revenue/season.save_playbook/'
  'season.get_readiness/season.learn_factors 2026-04-23 (M3.4, ADR-0201).';
