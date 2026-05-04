SET search_path TO public, extensions;

-- ============================================
-- 20260516000400_journey_authority_seed.sql
-- Journey Engine S1.3 — C4 authority seed for 4 journey capabilities
--
-- Campaign: journey-engine · Milestone: M1 Foundations · Sub-sortie: S1.3
-- Binding ADRs: 0173 (capability model), 0176 (authority seed)
-- Binding learnings: L-0066 / L-0097 (authority default-allow CVE class)
-- Trust-Gate Unblock: #3 (C4 authority seed migration)
-- ============================================
--
-- PURPOSE
-- -------
-- Seed public.engine_authority_config with one row per (workspace × capability)
-- for the four journey capabilities defined in ADR-0173:
--
--   capability                 | level       | min_role
--   ---------------------------+-------------+----------
--   journey.run_dev            | suggest     | admin
--   journey.publish_mission    | suggest     | admin
--   journey.publish_guide      | suggest     | admin
--   journey.run_guided         | autonomous  | employee
--
-- WHY SEED-BEFORE-CAPABILITY
-- --------------------------
-- public.gate_action (supabase/migrations/20260506120000_gate_action_accept_entity_id.sql
-- lines 107-109) default-allows any capability whose (workspace_id, capability)
-- row is missing from engine_authority_config:
--
--   IF v_level IS NULL THEN
--     v_allow := true;
--
-- This is CVE-class (L-0066, L-0097 — 2nd occurrence). If S1.4 registers the
-- four capabilities in CapabilityName union and wires them into the tool
-- selector BEFORE this seed lands, ANY workspace can execute any journey
-- capability in the gap window. S1.3 therefore MUST land on campaign and
-- deploy to preview BEFORE S1.4 opens its PR. Gate A Steward condition C-1
-- and Supervisor conditions #2/#3 enforce this ordering.
--
-- COLUMN SCHEMA (verified via `\d public.engine_authority_config`)
-- ----------------------------------------------------------------
-- Base table: 20260302000100_engine_authority_config.sql
-- ALTERs consulted:
--   20260410000001_add_min_role_to_authority_config.sql
--       → adds `min_role text NOT NULL DEFAULT 'employee'` with CHECK
--   20260414225000_engine_authority_config_updated_by_nullable.sql
--       → drops NOT NULL on `updated_by` (platform-seed rows = NULL)
--   20260415120400_authority_config_four_eyes.sql
--       → adds `requires_four_eyes boolean NOT NULL DEFAULT false`
--       → adds `observer_escalation_hours integer NOT NULL DEFAULT 72`
--
-- Final column set relevant to INSERT:
--   workspace_id              uuid    NOT NULL  → from workspace row
--   capability                text    NOT NULL  → value from CROSS JOIN
--   level                     text    NOT NULL  → value from CROSS JOIN (CHECK: autonomous|confirm|suggest|read_only|disabled)
--   min_role                  text    NOT NULL  → value from CROSS JOIN (CHECK: employee|manager|admin|owner)
--   requires_four_eyes        boolean NOT NULL  → false (single-approver; no four-eyes for journey yet)
--   observer_escalation_hours integer NOT NULL  → 72 (column default; no observer workflow bound)
--   updated_by                uuid    NULL      → NULL (platform seed, no human actor — per 20260414225000)
--
-- DEVIATION FROM BRIEF (s1-3 plan §Migration content)
-- ---------------------------------------------------
-- The brief's VALUES clause listed `NULL::int` for observer_escalation_hours
-- and `::authority_level` / `::workspace_role` casts on level and min_role.
-- Live schema says:
--   - `level` and `min_role` are TEXT with CHECK constraints, NOT enums
--     (no `authority_level` / `workspace_role` Postgres enum exists).
--   - `observer_escalation_hours` is `NOT NULL DEFAULT 72` — NULL violates
--     the NOT NULL constraint.
-- Brief §Column completeness explicitly instructs: "If column names or
-- types differ from what's listed here, STOP and flag — do not invent.
-- The plan assumes the schema per commit `20260415120400`; if newer
-- ALTERs have landed, update the INSERT accordingly and note in the handoff."
-- This migration follows that instruction: drops the enum casts, uses
-- the column default value (72) for observer_escalation_hours — mirroring
-- existing precedents (billing_query=24, day_control=24, helpdesk_query=72).
-- Rationale for 72: matches the table default and helpdesk_query seed
-- (most conservative; no observer workflow bound to journey capabilities).
--
-- RISK
-- ----
-- Low. Pure INSERT, idempotent via ON CONFLICT. Reverts cleanly (see rollback).
-- No application code depends on these rows until S1.4 registers the
-- capabilities. ON CONFLICT DO NOTHING means replay/rerun is safe; a
-- future manual override via admin UI will not be clobbered.
--
-- DEPENDENCIES
-- ------------
--   - public.workspace exists (ancient, pre-2026).
--   - public.engine_authority_config exists (20260302000100) and carries the
--     columns listed above.
--   - uq_workspace_capability UNIQUE (workspace_id, capability) exists
--     (from 20260302000100) — required for ON CONFLICT.
--
-- ROLLBACK (manual, for reference)
-- --------------------------------
--   DELETE FROM public.engine_authority_config
--    WHERE capability IN (
--      'journey.run_dev',
--      'journey.publish_mission',
--      'journey.publish_guide',
--      'journey.run_guided'
--    );
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
    ('journey.run_dev',         'suggest',    'admin',    false, 72),
    ('journey.publish_mission', 'suggest',    'admin',    false, 72),
    ('journey.publish_guide',   'suggest',    'admin',    false, 72),
    ('journey.run_guided',      'autonomous', 'employee', false, 72)
) AS v(capability, level, min_role, requires_four_eyes, observer_escalation_hours)
ON CONFLICT (workspace_id, capability) DO NOTHING;

COMMENT ON COLUMN public.engine_authority_config.capability IS
  'Capability name (matches packages/ai/src/capabilities/types.ts CapabilityName union). '
  'Added billing_query 2026-04-17; added session.signoff/session.close/broadcast.send 2026-05-15; '
  'added helpdesk_query 2026-05-15; added journey.run_dev/journey.publish_mission/'
  'journey.publish_guide/journey.run_guided 2026-04-22 (S1.3, ADR-0173 / ADR-0176).';
