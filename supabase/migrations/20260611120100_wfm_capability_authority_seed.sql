-- ============================================================
-- 20260611120100_wfm_capability_authority_seed.sql
-- WFM Foundation — capability authority seeds (ADR-0192 two-part pattern)
--
-- PURPOSE
-- -------
-- Seeds engine_authority_config rows for three new WFM capabilities:
--   - scheduler           (ADR-0307/0309)
--   - shift_marketplace   (ADR-0306)
--   - pos_account_management (ADR-0305)
--
-- TWO-PART SEED PATTERN (ADR-0192)
-- ----------------------------------
-- Part A: INSERT into capability_default_registry (platform-wide defaults).
--         Consumed by workspace_seed_authority_defaults_trg on every new workspace INSERT.
--         Adding rows here is sufficient for future workspaces — no trigger rewrite needed.
--
-- Part B: Backfill INSERT into engine_authority_config for all EXISTING workspaces.
--         The trigger (Part A) only fires on INSERT — existing workspaces need explicit backfill.
--         COALESCE chain: owner/admin → any company member → any user_identity row.
--         Pattern mirrors 20260604000008_onboarding_capability_authority_seed.sql.
--
-- AUTHORITY POLICY RATIONALE
-- ---------------------------
-- scheduler:
--   Capability-level: admin+, confirm. Propose_plan is a Compose verb (web-only, manager+).
--   Accept/reject are Approve verbs (mobile-allowed). All 3 tools chat-only (ADR-0288,
--   irreversible C4 acts). Per-action overrides documented in JSONB comment + ADR-0309.
--
-- shift_marketplace:
--   Capability-level: manager+, autonomous. Post_open = manager scope. Claim = employee scope
--   (auto-approve path when workspace config auto_approve_claim=true, else confirm).
--   Approve = manager scope, autonomous (1-tap). Voice: claim + approve chat-only (ADR-0288).
--
-- pos_account_management:
--   Capability-level: admin+, confirm. OAuth connect flow is high-impact per-workspace
--   action. Credentials stored in Vault. Confirm gate prevents accidental connects.
--
-- GUARD (L-0066 CVE class)
-- ------------------------
-- gate_action() default-allows when no engine_authority_config row exists. Without these
-- seeds, all WFM capability tool calls would pass through ungated — silent authority escape.
-- These seeds must land BEFORE capability tools ship in C1/C2/C3 sorties.
--
-- IDEMPOTENT
-- ----------
-- ON CONFLICT (capability) DO NOTHING → capability_default_registry
-- ON CONFLICT (workspace_id, capability) DO NOTHING → engine_authority_config
-- Safe under `db reset` + replay.
--
-- PARITY SCRIPT (scripts/authority-seed-parity.ts)
-- --------------------------------------------------
-- The parity script scans for gateAction({ capability: "X" }) call sites and
-- verifies matching seeds in migrations. No call sites exist yet (capability tools
-- ship in C1/C2/C3 sorties). Parity CI will enforce matching when tools land.
-- Per L-0129: capability literals inside VALUES tuples are mandatory for scanner.
--
-- References:
--   ADR-0192 (capability_default_registry + bootstrap trigger pattern)
--   ADR-0305 (POS adapter — pos_account_management authority)
--   ADR-0306 (open-shift marketplace — shift_marketplace authority)
--   ADR-0307 amended + ADR-0309 (scheduler bundle — scheduler authority)
--   ADR-0099 (gate_action authority gate)
--   ADR-0288 (voice channel split — chat-only for irreversible C4 acts)
--   ADR-0133 (mobile boundary — Approve verbs mobile-allowed)
--   L-0066 (default-allow CVE class — authority seed mandatory pre-ship)
--   L-0129 (capability literals in VALUES tuples for parity scanner)
-- ============================================================

SET search_path TO public, extensions;

-- ─────────────────────────────────────────────────────────────────────────────
-- Part A — capability_default_registry: platform-wide defaults for 3 WFM caps
-- ─────────────────────────────────────────────────────────────────────────────
-- Consumed by workspace_seed_authority_defaults_trg (ADR-0192) on every new
-- workspace INSERT. Adding these 3 rows is sufficient for all future workspaces.

INSERT INTO public.capability_default_registry
  (capability, level, min_role, requires_four_eyes, observer_escalation_hours, notes)
VALUES
  (
    'scheduler',
    'confirm',
    'admin',
    false,
    24,
    'ADR-0307/0309. Greedy constraint-solver scheduler. '
    'propose_plan (Compose verb, web-only, manager+): confirm level. '
    'accept_proposal (Approve verb, mobile-allowed): confirm level. '
    'reject_proposal (Approve verb, mobile-allowed): confirm level. '
    'All 3 tools chat-only per ADR-0288 (irreversible C4 act). '
    'admin min_role — scheduling authority is admin-scope in V1. '
    'Per ADR-0309: single-row bundle, atomic all-or-nothing accept. '
    '24h observer escalation: bulk shift creation is high-impact. 2026-05-14.'
  ),
  (
    'shift_marketplace',
    'autonomous',
    'manager',
    false,
    12,
    'ADR-0306. Open-shift marketplace. '
    'post_open (manager+, autonomous): manager posts open shift. '
    'claim (employee+, autonomous when auto_approve_claim config set, else confirm): '
    '  employee claims open shift. Auto-approve path per workspace config flag. '
    'approve_claim (manager+, autonomous): 1-tap manager approval. '
    'cancel_offer (poster, autonomous): poster cancels offer. '
    'Voice: claim + approve_claim chat-only per ADR-0288. '
    'manager min_role for capability level. Employee tools accessible via tool-selector '
    'readOnlyTools/suggestTools per authority level. '
    '12h observer escalation (shift assignment affects production staffing). 2026-05-14.'
  ),
  (
    'pos_account_management',
    'confirm',
    'admin',
    false,
    24,
    'ADR-0305. POS integration account management. '
    'connect_lightspeed (admin+, confirm): OAuth connect flow + vault credential upsert. '
    'disconnect_lightspeed (admin+, confirm): remove POS integration + revoke vault secret. '
    'view_pos_status (admin+, read_only): read pos_account sync state + last_synced_at. '
    'admin min_role — POS credentials management is admin-scope only. '
    'confirm level: OAuth credential changes are high-impact (billing + data pipeline). '
    '24h observer escalation: credential changes warrant supervisor review. 2026-05-14.'
  )
ON CONFLICT (capability) DO NOTHING;


-- ─────────────────────────────────────────────────────────────────────────────
-- Part B — engine_authority_config: backfill for all existing workspaces
-- ─────────────────────────────────────────────────────────────────────────────
-- The trigger (Part A) covers only FUTURE workspace INSERTs. This CROSS JOIN fills
-- the gap for all workspaces that existed before this migration lands.
-- COALESCE chain mirrors 20260604000008_onboarding_capability_authority_seed.sql.
-- Per L-0129: capability literals must appear explicitly in VALUES tuples for the
-- parity scanner (scripts/authority-seed-parity.ts) to detect seeds correctly.

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
  caps.capability,
  caps.level,
  caps.min_role,
  caps.requires_four_eyes,
  caps.observer_escalation_hours,
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
  ) AS updated_by
FROM public.workspace w
-- L-0129: capability literals in VALUES tuples for parity scanner detection
CROSS JOIN (VALUES
  ('scheduler',            'confirm',    'admin',   false, 24),
  ('shift_marketplace',    'autonomous', 'manager', false, 12),
  ('pos_account_management', 'confirm',  'admin',   false, 24)
) AS caps(capability, level, min_role, requires_four_eyes, observer_escalation_hours)
ON CONFLICT (workspace_id, capability) DO NOTHING;


-- ─────────────────────────────────────────────────────────────────────────────
-- Update capability_default_registry COMMENT — add 3 new capabilities to list
-- ─────────────────────────────────────────────────────────────────────────────
-- Extends the COMMENT set by 20260604000008_onboarding_capability_authority_seed.sql.
-- The COMMENT is the canonical documentation for what capabilities auto-seed
-- on workspace creation.

COMMENT ON TABLE public.capability_default_registry IS
  'Canonical list of capabilities that auto-seed engine_authority_config rows '
  'when a new workspace is created. See trigger workspace_seed_authority_defaults. '
  'Adding a capability here is sufficient — no function rewrite needed. '
  'Existing-workspace backfill is the responsibility of each capability''s own '
  'seed migration. '
  'Capabilities registered (in migration order): '
  '  onboarding (ADR-0275 Phase E, 2026-05-04), '
  '  scheduler (ADR-0307/0309, 2026-05-14), '
  '  shift_marketplace (ADR-0306, 2026-05-14), '
  '  pos_account_management (ADR-0305, 2026-05-14). '
  'For the full list query: SELECT capability FROM capability_default_registry ORDER BY 1.';
