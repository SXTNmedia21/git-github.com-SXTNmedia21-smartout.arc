-- ============================================
-- 20260515170500_contract_capability_authority_seed.sql
-- Contract Hub Redesign Phase 1 — Gate G4 (Council 2026-04-22)
--
-- Purpose
--   Seed `engine_authority_config` rows for the `contract` capability so
--   the new chat-only Gate G4 tools (fork_template,
--   publish_workspace_template, deprecate_workspace_template) go through a
--   deterministic authority check instead of falling through to the
--   default-allow CVE surfaced in L-0066 (2026-04-19 helpdesk council).
--
-- Why not per-tool rows
--   `engine_authority_config` is keyed `(workspace_id, capability)` — one
--   row governs every tool inside a capability. The council brief said
--   "seed 3 rows for 3 tools", but the schema enforces one row per
--   capability per workspace. This migration therefore seeds ONE row per
--   workspace for the `contract` capability; all 5 existing tools
--   (list/check/explain/create/send) and the 3 new Gate G4 tools are
--   governed by this single row.
--
-- Policy choices
--   level = 'confirm'          — chat-only authoring surfaces must ask an
--                                admin to confirm before mutating. Fork,
--                                publish, deprecate, create, and send are
--                                all user-visible state changes; confirm
--                                is the right default. Read-only tools
--                                (list_employee_templates, etc.) unlock at
--                                this level too.
--   min_role = 'admin'         — admin/owner may invoke; manager and
--                                employee are downgraded to `suggest`
--                                (effectively read-only in the router).
--   requires_four_eyes = false — Phase 1 ships with single-approver. A
--                                future migration may tighten for
--                                high-risk flows (e.g. deprecate with
--                                active bindings), but Gate G4 does not
--                                require it yet.
--   observer_escalation_hours = 72 — matches helpdesk_query (L-0066).
--   gate_action                — explicit deny on missing row is the
--                                router's default, but the seed is still
--                                required because gate_action currently
--                                treats unseeded capabilities as
--                                default-allow (CVE, ADR-0162). This row
--                                closes the fallthrough.
--
-- ON CONFLICT DO NOTHING — idempotent against replays and against any
-- forward-migration that pre-seeded the capability. The
-- (workspace_id, capability) unique constraint is preserved.
--
-- Ref: Council 2026-04-22, Gate G4; ADR-0162 (default-allow trap);
--      L-0066 (CVE class); contract-hub-redesign Phase 1.
-- ============================================

SET search_path TO public, extensions;

DO $$
DECLARE
  v_updated_by uuid;
BEGIN
  -- Prefer a platform godmode user as the authoring identity for this
  -- platform-level seed. On fresh local databases this may be NULL; in
  -- that case the migration no-ops and the seed is re-attempted after the
  -- first admin is created (same pattern as billing_query seed).
  SELECT user_id INTO v_updated_by
  FROM public.user_identity
  WHERE is_godmode = true
  ORDER BY created_at ASC
  LIMIT 1;

  IF v_updated_by IS NULL THEN
    RAISE NOTICE 'No godmode user found — skipping contract authority seed. Re-run after first admin is created.';
    RETURN;
  END IF;

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
    'contract',
    'confirm',
    'admin',
    false,
    72,
    v_updated_by
  FROM public.workspace w
  ON CONFLICT (workspace_id, capability) DO NOTHING;
END $$;

COMMENT ON COLUMN public.engine_authority_config.capability IS
  'Capability name (matches packages/ai/src/capabilities/types.ts CapabilityName union). Added contract 2026-04-22 (Council Gate G4).';
