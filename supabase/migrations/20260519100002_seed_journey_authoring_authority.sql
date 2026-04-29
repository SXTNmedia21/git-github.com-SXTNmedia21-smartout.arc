-- ============================================
-- 20260429000000_seed_journey_authoring_authority.sql
-- Journey-Authoring Capability — C4 authority seed
--
-- Campaign: journey-engine
-- Binding ADRs: 0226 (journey_authoring capability via stage-engine),
--               0173 (journey capability frozen at 4 tools),
--               0099 (gate_action on every mutation),
--               0176 (authority config is migration-only)
-- Binding learnings: L-0066 / L-0097 (gate_action default-allow CVE-class)
-- ============================================
--
-- PURPOSE
-- -------
-- Seed public.engine_authority_config with one row per (workspace × role bucket)
-- for the new journey_authoring capability defined in ADR-0239.
--
-- Authority policy:
--   role bucket   | level       | rationale
--   --------------|-------------|--------------------------------------------
--   owner         | autonomous  | Platform-level journey authoring; full trust
--   admin         | autonomous  | Same — workspace admin authors first-party journeys
--   manager       | disabled    | No authoring rights; execution-only surface
--   employee      | disabled    | No authoring rights; execution-only surface
--
-- WHY TWO INSERTS (not CROSS JOIN with VALUES)
-- --------------------------------------------
-- The engine_authority_config table has one row per (workspace_id, capability)
-- with min_role expressing the floor. However, the default-allow trap (L-0066)
-- fires when ANY row for the capability is missing. To express different levels
-- per role group we insert two rows using capability name suffixes:
--   journey_authoring           → autonomous, min_role='admin'   (owner+admin pass)
--   journey_authoring.employee  → disabled,   min_role='employee' (manager+employee blocked)
--
-- Stage-engine authority loader resolves the most-specific dotted key for the
-- calling profile's role, falling back to the base key. This matches the
-- established pattern used by journey.run_dev / journey.run_guided (ADR-0195).
--
-- IDEMPOTENCY
-- -----------
-- ON CONFLICT (workspace_id, capability) DO NOTHING — safe to re-run.
-- A future admin UI override will not be clobbered.
--
-- COLUMN SCHEMA (verified against migrations up to 20260516140000)
-- ----------------------------------------------------------------
-- Base table:   20260302000100_engine_authority_config.sql
-- ALTERs used:
--   20260410000001 → adds min_role TEXT NOT NULL DEFAULT 'employee' (CHECK constraint)
--   20260414225000 → drops NOT NULL on updated_by (platform seeds = NULL)
--   20260415120400 → adds requires_four_eyes BOOLEAN NOT NULL DEFAULT false
--                  → adds observer_escalation_hours INTEGER NOT NULL DEFAULT 72
--
-- level CHECK: autonomous | confirm | suggest | read_only | disabled (TEXT, not enum)
-- min_role CHECK: employee | manager | admin | owner      (TEXT, not enum)
--
-- ROLLBACK (manual, for reference)
-- --------------------------------
--   DELETE FROM public.engine_authority_config
--    WHERE capability IN ('journey_authoring', 'journey_authoring.employee');
-- ============================================

SET search_path TO public, extensions;

-- Row 1: owner + admin → autonomous
-- Resolved when calling profile role is 'owner' or 'admin' (min_role='admin' passes both).
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
  'journey_authoring',
  'autonomous',
  'admin',
  false,
  72,
  NULL::uuid  -- platform seed, no human actor (per 20260414225000)
FROM public.workspace w
WHERE NOT EXISTS (
  SELECT 1
  FROM public.engine_authority_config ac
  WHERE ac.workspace_id = w.workspace_id
    AND ac.capability = 'journey_authoring'
);

-- Row 2: manager + employee → disabled
-- Resolved when calling profile role is 'manager' or 'employee' (more specific dotted key).
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
  'journey_authoring.employee',
  'disabled',
  'employee',
  false,
  72,
  NULL::uuid  -- platform seed, no human actor
FROM public.workspace w
WHERE NOT EXISTS (
  SELECT 1
  FROM public.engine_authority_config ac
  WHERE ac.workspace_id = w.workspace_id
    AND ac.capability = 'journey_authoring.employee'
);

COMMENT ON COLUMN public.engine_authority_config.capability IS
  'Capability name (matches packages/ai/src/capabilities/types.ts CapabilityName union). '
  'Added billing_query 2026-04-17; added session.signoff/session.close/broadcast.send 2026-05-15; '
  'added helpdesk_query 2026-05-15; added journey.run_dev/journey.publish_mission/'
  'journey.publish_guide/journey.run_guided 2026-04-22 (S1.3, ADR-0173/ADR-0176); '
  'added journey_authoring/journey_authoring.employee 2026-04-29 (ADR-0239).';
