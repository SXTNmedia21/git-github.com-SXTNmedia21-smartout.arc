-- ============================================
-- 20260524000001_onboarding_capability_authority_seed.sql
-- `onboarding` capability authority seed — ADR-0275 Phase E (T1.5)
--
-- PURPOSE
-- -------
-- Ships the authority config rows for the new `onboarding` capability
-- (ADR-0275, Phase E, T1.1-T1.5 skeleton).
--
-- Without this seed: no engine_authority_config row for 'onboarding' →
-- gate_action() default-allows ALL invocations regardless of role/channel
-- (L-0066 CVE class). Phase E tools are skeletons today, but the gate must
-- be pre-positioned correctly before T1.6 bodies land.
--
-- AUTHORITY POLICY (per ADR-0275 R4 corrected table + T1.5 spec)
-- ---------------------------------------------------------------
-- The onboarding capability uses a tiered authority model:
--
--   Tool                    | Authority     | Notes
--   ----------------------- | ------------- | -----------------------------------
--   update_business         | confirm       | Workspace metadata — admin scope
--   update_season           | confirm       | Planning cycle bootstrap — admin
--   add_departments         | confirm       | D1 cascade — high-impact
--   add_locations           | confirm       | D1 cascade — high-impact
--   add_zones               | confirm       | D1 cascade — high-impact
--   add_procedures          | suggest       | Governance content — review-required
--   scrape_website          | read_only     | External scraping — no DB write
--   search_company          | read_only     | BRREG search bridge — no DB write
--   identify_company        | read_only     | BRREG lookup bridge — no DB write
--
-- The engine_authority_config row uses 'confirm' as the capability-level
-- authority (the most restrictive mutation tier present). The per-tool
-- authority enforcement is handled by tool-selector.ts mapping the
-- authority level to tool subsets (readOnlyTools, suggestTools, all tools).
--
--   level = 'confirm'      — confirm-gate for D1 mutations. Matches the
--                            highest write-tier present (update_business,
--                            update_season, add_departments, add_locations,
--                            add_zones). tool-selector.ts maps:
--                              read_only → readOnlyTools (scrape+search bridges)
--                              suggest   → + add_procedures
--                              confirm   → all 9 tools
--   min_role = 'admin'     — Onboarding workspace setup is admin-scope.
--                            Standard onboarding wizard flows are admin-only.
--                            Employees do not set up workspaces.
--   requires_four_eyes = false
--                          — T1.6 skeleton — no four-eyes requirement in Phase E.
--                            May tighten for add_departments (D1) in a future
--                            migration when production data is at risk.
--   observer_escalation_hours = 24
--                          — Same as contract capability (high-impact workspace-
--                            structural changes warrant 24h supervisor review).
--
-- TWO-PART SEED (ADR-0192 pattern, mirrors 20260520130000_legal_capability_authority_seed.sql)
-- --------------------------------------------------------------------------------------------
-- Part A: INSERT into capability_default_registry — one platform-wide row
--         consumed by workspace_seed_authority_defaults_trg on every new
--         workspace INSERT.
-- Part B: Backfill INSERT into engine_authority_config for every existing
--         workspace (COALESCE chain: owner/admin → any company member →
--         any user_identity row).
--
-- IDEMPOTENT
-- ----------
-- ON CONFLICT (capability) DO NOTHING           → capability_default_registry
-- ON CONFLICT (workspace_id, capability) DO NOTHING → engine_authority_config
-- Safe under `db reset` + replay.
--
-- References:
--   ADR-0275 (voice-plane-consolidation, onboarding capability Phase E R4)
--   ADR-0192 (capability_default_registry + bootstrap trigger pattern)
--   ADR-0099 (gate_action authority gate)
--   ADR-0078 (channel restriction — per-tool Layer 3 guards in T1.6 bodies)
--   L-0066   (default-allow CVE class — authority seed mandatory same PR)
--   packages/ai/src/capabilities/onboarding/index.ts (capability definition)
-- ============================================

SET search_path TO public, extensions;

-- ─────────────────────────────────────────────────────────────────────
-- Part A — capability_default_registry: platform-wide default for onboarding
-- ─────────────────────────────────────────────────────────────────────
-- Consumed by workspace_seed_authority_defaults_trg (ADR-0192) on every
-- new workspace INSERT. Adding this row is sufficient to auto-seed new
-- workspaces — no trigger function rewrite needed.

INSERT INTO public.capability_default_registry
  (capability, level, min_role, requires_four_eyes, observer_escalation_hours, notes)
VALUES
  (
    'onboarding',
    'confirm',
    'admin',
    false,
    24,
    'ADR-0275 Phase E. Workspace setup wizard: update_business/season (confirm), '
    'add_departments/locations/zones (confirm, D1 cascade), add_procedures (suggest), '
    'scrape_website/search_company/identify_company (read_only bridges). '
    'admin min_role — onboarding is admin-scope only. 2026-05-04.'
  )
ON CONFLICT (capability) DO NOTHING;

-- ─────────────────────────────────────────────────────────────────────
-- Part B — engine_authority_config: backfill for all existing workspaces
-- ─────────────────────────────────────────────────────────────────────
-- The trigger (Part A) covers only future workspaces. This SELECT × JOIN
-- fills the gap for workspaces created before this migration lands.
-- COALESCE chain mirrors the legal + helpdesk_query backfill pattern.

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
  'onboarding',
  'confirm',
  'admin',
  false,
  24,
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
      -- Fallback to any member of the company.
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
  'seed migration. `onboarding` added 2026-05-04 (ADR-0275 Phase E T1.5).';
