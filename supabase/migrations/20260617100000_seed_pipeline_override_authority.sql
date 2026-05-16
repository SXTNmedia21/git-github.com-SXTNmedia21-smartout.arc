-- ============================================================
-- 20260617100000_seed_pipeline_override_authority.sql
-- T0.5: Pipeline override authority seed for shift_swap + shift_marketplace
--
-- PURPOSE
-- -------
-- Seeds engine_authority_config rows for two pipeline-override capabilities:
--   - shift_swap.override          (ADR-0340 T0.5)
--   - shift_marketplace.override   (ADR-0340 T0.5)
--
-- WHY THIS MIGRATION EXISTS
-- -------------------------
-- ADR-0340 (Shift Lifecycle Pipeline V2) introduces an `override_pipeline`
-- admin tool (T5) that allows an admin to bypass a manager-declined pipeline
-- stage. The tool calls gate_action with capability='<cap>.override'.
--
-- Without explicit seed rows, gate_action() hits the default-allow path
-- (L-0189 documented behavior: no engine_authority_config row →
-- allow=true, reason=NULL) — silently authorising ANY caller regardless
-- of role. This is the same CVE class as L-0281 / L-0066.
--
-- These rows BLOCK the default-allow path: the .override capability row
-- sets min_role='admin', so any actor below 'admin' receives
-- downgrade_to='suggest' (not allow=false, per gate_action §role-below-floor
-- semantics), and the tool caller is responsible for rejecting non-autonomous
-- results. level='autonomous' means an admin can execute the override
-- without a confirmation step.
--
-- AUTHORITY POLICY (ADR-0340)
-- ---------------------------
--   level                  = 'autonomous'  — admin override is a single-tap
--                                            action; no confirmation loop.
--   min_role               = 'admin'       — role below admin → downgrade to
--                                            suggest (caller rejects non-
--                                            autonomous result → effective deny).
--   requires_four_eyes     = false         — override is single-admin action;
--                                            four-eyes adds latency without
--                                            security gain (admin already
--                                            escalated from manager-declined).
--   observer_escalation_hours = 24         — standard for pipeline-altering
--                                            admin acts. 24h window.
--
-- TWO-PART SEED PATTERN (ADR-0192)
-- ----------------------------------
-- Part A: INSERT into capability_default_registry (platform-wide default).
--         Consumed by workspace_seed_authority_defaults_trg on every new
--         workspace INSERT. Future workspaces automatically inherit these rows.
--
-- Part B: Backfill INSERT into engine_authority_config for all EXISTING
--         workspaces. The trigger only fires on new workspace INSERT —
--         existing workspaces need an explicit backfill (this section).
--         COALESCE chain: owner/admin → any company member → any user_identity
--         (mirrors 20260611120100_wfm_capability_authority_seed.sql pattern).
--
-- IDEMPOTENCY
-- -----------
-- Part A: ON CONFLICT (capability) DO NOTHING
-- Part B: ON CONFLICT (workspace_id, capability) DO NOTHING
-- Safe under `npx supabase db reset` + replay and repeated migration runs.
--
-- CI PARITY (ADR-0340 T0.5 / L-0281)
-- ------------------------------------
-- scripts/check-pipeline-override-parity.ts scans for pipeline-defining
-- capabilities (by allowlist: shift_swap, shift_marketplace) and verifies
-- a sibling '<cap>.override' row exists in seed migrations. The literal
-- values 'shift_swap.override' and 'shift_marketplace.override' in the
-- VALUES tuples below satisfy that scanner (per L-0129 pattern).
--
-- scripts/authority-seed-parity.ts will additionally scan for any
-- gate_action() call site using 'shift_swap.override' or
-- 'shift_marketplace.override' as the capability literal (when T5 ships)
-- and verify these seed rows exist (ADR-0189 parity gate).
--
-- ORDERING NOTE
-- -------------
-- This migration (T0.5) must apply AFTER the T0 migration that creates
-- engine_authority_pipeline and engine_process blueprints. Timestamp
-- 20260617100000 is strictly greater than the T0 migration which uses
-- a 20260616 timestamp. If T0 migration is assigned a 20260617+ timestamp
-- by its author, it must use a sub-second (100-series) slot below 100000
-- or coordinate with this file.
--
-- REFERENCES
-- ----------
-- ADR-0340: Shift Lifecycle Pipeline V2 (T0.5 requirement)
-- ADR-0192: capability_default_registry + bootstrap trigger pattern
-- ADR-0099: unified authority gate (gate_action RPC)
-- ADR-0189: authority-seed-parity CI gate
-- L-0066:   default-allow CVE class (missing seed = silent authority escape)
-- L-0129:   capability literals in VALUES tuples for parity scanner
-- L-0281:   pipeline override default-allow CVE recurrence pattern
-- ============================================================

SET search_path TO public, extensions;

-- ─── Part A — capability_default_registry: platform-wide defaults ────────────
-- Consumed by workspace_seed_authority_defaults_trg (ADR-0192) on every new
-- workspace INSERT. Adding these 2 rows is sufficient for all future workspaces.

INSERT INTO public.capability_default_registry
  (capability, level, min_role, requires_four_eyes, observer_escalation_hours, notes)
VALUES
  (
    'shift_swap.override',
    'autonomous',
    'admin',
    false,
    24,
    'ADR-0340 T0.5. Admin override for shift_swap pipeline stages. '
    'shift_swap.override (admin+, autonomous): admin bypasses a manager-declined '
    'shift_swap pipeline stage. Called by override_pipeline tool (T5). '
    'min_role=admin — only workspace admins may issue pipeline overrides. '
    'level=autonomous — no confirmation loop; admin decision is final. '
    'requires_four_eyes=false — single-admin act; four-eyes unnecessary given '
    'pre-existing manager-decline context. '
    '24h observer_escalation: pipeline-altering admin acts warrant visibility. '
    'Absent this row gate_action default-allows (L-0066/L-0281 CVE class). 2026-05-16.'
  ),
  (
    'shift_marketplace.override',
    'autonomous',
    'admin',
    false,
    24,
    'ADR-0340 T0.5. Admin override for shift_marketplace pipeline stages. '
    'shift_marketplace.override (admin+, autonomous): admin bypasses a manager-declined '
    'shift_marketplace pipeline stage. Called by override_pipeline tool (T5). '
    'min_role=admin — only workspace admins may issue pipeline overrides. '
    'level=autonomous — no confirmation loop; admin decision is final. '
    'requires_four_eyes=false — single-admin act; four-eyes unnecessary given '
    'pre-existing manager-decline context. '
    '24h observer_escalation: pipeline-altering admin acts warrant visibility. '
    'Absent this row gate_action default-allows (L-0066/L-0281 CVE class). 2026-05-16.'
  )
ON CONFLICT (capability) DO NOTHING;


-- ─── Part B — engine_authority_config: backfill for all existing workspaces ───
-- The trigger (Part A) covers only FUTURE workspace INSERTs. This CROSS JOIN fills
-- the gap for all workspaces that existed before this migration lands.
-- COALESCE chain mirrors 20260611120100_wfm_capability_authority_seed.sql.
-- Per L-0129: capability literals must appear explicitly in VALUES tuples for the
-- parity scanner (scripts/authority-seed-parity.ts) to detect seeds correctly.
-- Per ADR-0340 T0.5: these literals also satisfy the pipeline-override-parity
-- scanner (scripts/check-pipeline-override-parity.ts).

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
-- L-0129: capability literals in VALUES tuples for parity scanner detection.
-- ADR-0340 T0.5: these literals also satisfy check-pipeline-override-parity.ts.
CROSS JOIN (VALUES
  ('shift_swap.override',        'autonomous', 'admin', false, 24),
  ('shift_marketplace.override', 'autonomous', 'admin', false, 24)
) AS caps(capability, level, min_role, requires_four_eyes, observer_escalation_hours)
ON CONFLICT (workspace_id, capability) DO NOTHING;


-- ─── Update capability_default_registry COMMENT ───────────────────────────────
-- Extends the COMMENT set by 20260616100700_seed_comm_note_fanout_cross_dept_authority.sql.
-- Adds shift_swap.override + shift_marketplace.override to the canonical list.

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
  '  pos_account_management (ADR-0305, 2026-05-14), '
  '  comm.note_fanout_cross_dept (ADR-0333, 2026-05-15), '
  '  shift_swap.override (ADR-0340 T0.5, 2026-05-16), '
  '  shift_marketplace.override (ADR-0340 T0.5, 2026-05-16). '
  'For the full list query: SELECT capability FROM capability_default_registry ORDER BY 1.';
