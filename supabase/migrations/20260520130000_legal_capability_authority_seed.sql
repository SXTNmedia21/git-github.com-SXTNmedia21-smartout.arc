-- ============================================
-- 20260520130000_legal_capability_authority_seed.sql
-- `legal` capability authority seed — ADR-0249 Phase 0c follow-up #1
--
-- PURPOSE
-- -------
-- Ships the authority config rows that make the `legal` capability
-- (ADR-0249, commit 993585a84) a closed gate rather than a default-allow
-- surface (L-0066 CVE class).
--
-- Without this seed: any workspace has no row for capability='legal' in
-- engine_authority_config → gate_action() default-allows all legal tool
-- invocations regardless of role or channel. Phase 0c stubs are pass-
-- through today, but Phase 0c+ real validators must land on a gated
-- surface — this migration pre-positions the gate correctly.
--
-- TWO-PART SEED (mirrors ADR-0192 pattern, 20260518000000)
-- --------------------------------------------------------
-- Part A: INSERT into capability_default_registry — one platform-wide row
--         consumed by workspace_seed_authority_defaults_trg on every new
--         workspace INSERT.
-- Part B: Backfill INSERT into engine_authority_config for every existing
--         workspace — same COALESCE chain (owner → any member → any
--         user_identity) used by helpdesk_query and contract seeds.
--
-- AUTHORITY POLICY (capability/tools spec in packages/ai/src/capabilities/legal/index.ts)
-- ----------------------------------------------------------------------------------------
--   level = 'read_only'    — validate_aml_14_6 + cite_law are advisory.
--                            classify_amendment is server-only (channel: system)
--                            and carries gate_action=enforce in the JS layer;
--                            the DB-level authority row does not over-restrict it
--                            independently. read_only is the workspace-visible
--                            posture: Botsson can surface legal tools to users
--                            but cannot auto-execute mutations.
--   min_role = 'manager'   — validate_aml_14_6 (oppsigelse/sykefravær) is high-
--                            sensitivity. Employee-facing cite_law degrades to
--                            suggest within the JS capability layer; the DB row
--                            uses manager as the floor. ADR-0249 + capability
--                            spec lines 21-23.
--   requires_four_eyes = false
--                          — Phase 0c: stubs pass unconditionally. Phase 0c+ may
--                            tighten for classify_amendment (admin + four_eyes)
--                            via a separate migration when real enforcement lands.
--   observer_escalation_hours = 72
--                          — Norsk arbeidsrett — high-sensitivity legal actions
--                            warrant 72-hour supervisor review window (same as
--                            contract/helpdesk_query).
--
-- IDEMPOTENT
-- ----------
-- ON CONFLICT (capability) DO NOTHING     → capability_default_registry
-- ON CONFLICT (workspace_id, capability) DO NOTHING → engine_authority_config
-- Safe under `db reset` + replay.
--
-- References:
--   ADR-0249 (legal capability, Phase 0c + authority seed spec)
--   ADR-0192 (capability_default_registry + bootstrap trigger pattern)
--   ADR-0078 (channel restriction — per-tool Layer 3 guards enforce this)
--   ADR-0099 (gate_action authority gate)
--   L-0066   (default-allow CVE class — authority seed is mandatory same PR)
--   packages/ai/src/capabilities/legal/index.ts (capability definition)
-- ============================================

SET search_path TO public, extensions;

-- ─────────────────────────────────────────────────────────────────────
-- Part A — capability_default_registry: platform-wide default for legal
-- ─────────────────────────────────────────────────────────────────────
-- Consumed by workspace_seed_authority_defaults_trg (ADR-0192) on every
-- new workspace INSERT. Adding this row is sufficient to auto-seed new
-- workspaces — no trigger function rewrite needed.

INSERT INTO public.capability_default_registry
  (capability, level, min_role, requires_four_eyes, observer_escalation_hours, notes)
VALUES
  (
    'legal',
    'read_only',
    'manager',
    false,
    72,
    'Norsk arbeidsrett — Lovsen. validate_aml_14_6: manager, chat; '
    'cite_law: employee, chat+voice; classify_amendment: admin, system, enforce. '
    'ADR-0249 Phase 0c. 2026-04-30.'
  )
ON CONFLICT (capability) DO NOTHING;

-- ─────────────────────────────────────────────────────────────────────
-- Part B — engine_authority_config: backfill for all existing workspaces
-- ─────────────────────────────────────────────────────────────────────
-- The trigger (Part A) covers only future workspaces. This SELECT × JOIN
-- fills the gap for all workspaces created before this migration lands.
-- COALESCE chain mirrors contract + helpdesk_query backfill pattern.

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
  'legal',
  'read_only',
  'manager',
  false,
  72,
  COALESCE(
    (
      -- Prefer workspace owner/admin via company_member (ADR-0099 audit trail).
      SELECT cm.user_id
      FROM public.company_member cm
      WHERE cm.company_id = w.company_id
        AND cm.role IN ('owner', 'admin')
      ORDER BY cm.created_at
      LIMIT 1
    ),
    (
      -- Fallback to any member of the company (seed-time data may not
      -- have owner/admin distinction).
      SELECT cm.user_id
      FROM public.company_member cm
      WHERE cm.company_id = w.company_id
      ORDER BY cm.created_at
      LIMIT 1
    ),
    (
      -- Last resort: any user_identity row (Supabase local seed data).
      SELECT ui.user_id FROM public.user_identity ui ORDER BY ui.created_at LIMIT 1
    )
  )
FROM public.workspace w
ON CONFLICT (workspace_id, capability) DO NOTHING;

COMMENT ON TABLE public.capability_default_registry IS
  'Canonical list of capabilities that auto-seed engine_authority_config rows '
  'when a new workspace is created. See trigger workspace_seed_authority_defaults. '
  'Adding a capability here is sufficient — no function rewrite needed. '
  'Existing-workspace backfill is the responsibility of each capability''s own '
  'seed migration. `legal` added 2026-04-30 (ADR-0249).';
