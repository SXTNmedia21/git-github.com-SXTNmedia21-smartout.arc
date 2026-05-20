-- ============================================================
-- 20260621100200_engine_authority_config_employee_activation.sql
-- feat/contract-signed-active-cascade (ADR-0379)
--
-- Purpose
-- -------
-- Seeds engine_authority_config for capability='employee_activation' across
-- all workspaces. Without this seed, gate_action() defaults-allow (no config
-- row → v_level IS NULL → allow=true) but emits an activity_trail warning
-- (gate.unseeded_capability_invoked, per 20260516130000). Explicit seed
-- eliminates that warning and documents the intentional policy.
--
-- Authority policy (ADR-0379)
-- ---------------------------
-- The employment contract, legally signed by both parties, IS the C4
-- authorization. NO additional admin confirmation step or change_proposal is
-- required. The process runs as system (actor_profile_id=NULL); role-based
-- min_role check is moot for system-initiated processes.
--
--   level                    = 'autonomous'
--     → gate_action() returns allow=true without any role check.
--     → Correct for system-only processes (signature = authorization).
--   min_role                 = 'owner'
--     → Functionally moot: level='autonomous' makes gate_action() skip the
--       role check entirely, and actor is always NULL for this system process.
--       Value must satisfy capability_default_registry's CHECK constraint, which
--       allows ONLY (employee|manager|admin|owner) — NOT 'system'. (engine_
--       authority_config's CHECK was relaxed to include 'system' in 20260516110000,
--       but capability_default_registry's was not — 20260518000000.) Use 'owner'
--       (highest) in both tables for a constraint-valid, uniform default.
--   requires_four_eyes       = false
--     → Single-actor authorization is sufficient. The legal signature serves
--       as the two-party confirmation (employer + employee both sign via DocuSeal).
--   observer_escalation_hours = 0
--     → No escalation — system-only, no human observer required.
--
-- Schema reality (verified against packages/supabase/src/database.types.ts)
-- -------------------------------------------------------------------------
-- engine_authority_config columns:
--   id, workspace_id (NOT NULL FK), capability, level (string), min_role (string),
--   requires_four_eyes, observer_escalation_hours, updated_by (nullable),
--   created_at, updated_at.
-- NULL workspace_id is NOT supported (NOT NULL constraint — confirmed from schema).
-- UNIQUE constraint: (workspace_id, capability) — ON CONFLICT guard below.
--
-- Two-part seed (ADR-0192 pattern)
-- ---------------------------------
-- Part A: capability_default_registry — auto-seeds new workspaces via
--   workspace_seed_authority_defaults_trg on workspace INSERT.
-- Part B: engine_authority_config backfill — fills existing workspaces.
--   COALESCE chain: owner/admin → any company member → any user_identity.
--
-- References
-- ----------
-- ADR-0379 (signature-as-C4-authorization)
-- ADR-0192 (capability_default_registry + bootstrap trigger pattern)
-- ADR-0099 (gate_action authority gate)
-- ADR-0189 (unseeded capability warning — this seed eliminates it)
-- 20260516130000 (gate_action_unseeded_warning — default-allow + trail warning)
-- 20260604000008 (onboarding_capability_authority_seed — canonical pattern)
-- ============================================================

SET search_path TO public, extensions;

-- ─── Part A: capability_default_registry ─────────────────────────────────────
-- Platform-wide default consumed by workspace_seed_authority_defaults_trg on
-- every new workspace INSERT. ON CONFLICT (capability) DO NOTHING — idempotent.

INSERT INTO public.capability_default_registry (
  capability,
  level,
  min_role,
  requires_four_eyes,
  observer_escalation_hours,
  notes
)
VALUES (
  'employee_activation',
  'autonomous',
  'owner',
  false,
  0,
  'ADR-0379. System-only process: contract.signed → profile.status trainee→active. '
  'Signature is C4 authorization — no admin confirm, no change_proposal. '
  'actor_profile_id=NULL (originating_channel=system). 2026-06-21.'
)
ON CONFLICT (capability) DO NOTHING;

-- ─── Part B: engine_authority_config backfill ────────────────────────────────
-- Fills existing workspaces. COALESCE chain mirrors 20260604000008 (onboarding).
-- ON CONFLICT (workspace_id, capability) DO NOTHING — idempotent on replay.

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
  'employee_activation',
  'autonomous',
  'owner',
  false,
  0,
  COALESCE(
    (
      SELECT cm.user_id
      FROM public.company_member cm
      WHERE cm.company_id = w.company_id
        AND cm.role IN ('owner', 'admin')
      ORDER BY cm.created_at
      LIMIT 1
    ),
    (
      SELECT cm.user_id
      FROM public.company_member cm
      WHERE cm.company_id = w.company_id
      ORDER BY cm.created_at
      LIMIT 1
    ),
    (
      SELECT ui.user_id FROM public.user_identity ui ORDER BY ui.created_at LIMIT 1
    )
  )
FROM public.workspace w
ON CONFLICT (workspace_id, capability) DO NOTHING;
