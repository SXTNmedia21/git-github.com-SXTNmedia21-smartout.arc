-- ============================================================
-- 20260620110400_policy_create_manual_capability_seed.sql
-- Capability seeds: policy.create_manual + hms.escalate_deviation
-- (Retimestamped from 20260617110000 — B1 R1-fixup, below dev tip 20260619100000)
--
-- PURPOSE
-- -------
-- Seeds engine_authority_config rows for TWO capabilities:
--
--   1. policy.create_manual — called by `createPolicy` Server Action in:
--        apps/web/src/app/dashboard/policies/_actions/policy-actions.ts
--      min_role='admin', level='confirm'
--
--   2. hms.escalate_deviation — called by `escalateDeviationAction` in:
--        apps/web/src/app/dashboard/_actions/update-deviation-action.ts
--      min_role='manager', level='confirm'
--      Added at G4 supervisor review 2026-05-17 (HIGH blocker fix): the original
--      escalateDeviationAction called gate_action with capability literal
--      'hms.update_deviation_manual' which was UNSEEDED → default-allow CVE.
--      Renamed to 'hms.escalate_deviation' (matches naming pattern of sibling
--      hms.acknowledge_deviation + hms.resolve_deviation) and seeded here.
--
-- WITHOUT these seeds, gate_action() hits the default-allow path (L-0189 /
-- L-0066 documented behavior: no engine_authority_config row → allow=true
-- regardless of caller role) — silently authorising ANY caller.
--
-- WITH these seeds, the gate enforces min_role floors per capability above.
-- For policy.create_manual: managers and employees
-- receive downgrade_to='suggest' (treated as deny by the Server Action caller).
--
-- WHY CONFIRM LEVEL
-- -----------------
-- Policy creation is an admin-authored, workspace-scoped governance action.
-- level='confirm' (not 'autonomous'): the admin triggers creation from a dialog;
-- a single confirmation click is the expected UX. 'autonomous' is reserved for
-- background/automated actions.
--
-- AUTHORITY POLICY
-- ----------------
--   capability             = 'policy.create_manual'
--   level                  = 'confirm'  — dialog-initiated admin action
--   min_role               = 'admin'    — manager and below → downgrade to suggest
--   requires_four_eyes     = false      — policy creation is single-admin authority
--   observer_escalation_hours = 24      — standard for governance writes
--
-- TWO-PART SEED PATTERN (ADR-0192)
-- ----------------------------------
-- Part A: INSERT into capability_default_registry (platform-wide default).
--         Consumed by workspace_seed_authority_defaults_trg on every new
--         workspace INSERT. Future workspaces automatically inherit this row.
--
-- Part B: Backfill INSERT into engine_authority_config for all EXISTING
--         workspaces. The trigger only fires on new workspace INSERT —
--         existing workspaces need an explicit backfill.
--         COALESCE chain: owner/admin → any company member → any user_identity.
--
-- IDEMPOTENCY
-- -----------
-- Part A: ON CONFLICT (capability) DO NOTHING
-- Part B: ON CONFLICT (workspace_id, capability) DO NOTHING
-- Safe under `npx supabase db reset` + replay and repeated migration runs.
--
-- CI PARITY
-- ---------
-- scripts/authority-seed-parity.ts scans for gate_action() call sites using
-- 'policy.create_manual' as the capability literal and verifies this seed row
-- exists (ADR-0189 parity gate). The literal 'policy.create_manual' in the
-- VALUES tuple below satisfies that scanner (per L-0129 pattern).
--
-- REFERENCES
-- ----------
-- ADR-0099: unified authority gate (gate_action RPC)
-- ADR-0192: capability_default_registry + bootstrap trigger pattern
-- ADR-0189: authority-seed-parity CI gate
-- L-0066:   default-allow CVE class (missing seed = silent authority escape)
-- L-0129:   capability literals in VALUES tuples for parity scanner
-- Sortie:   M5 HMS Sortie 1 (council-verified 2026-05-17)
-- ============================================================

SET search_path TO public, extensions;

-- ─── Part A — capability_default_registry: platform-wide defaults ────────────
-- Consumed by workspace_seed_authority_defaults_trg (ADR-0192) on every new
-- workspace INSERT. Adding this row is sufficient for all future workspaces.

INSERT INTO public.capability_default_registry
  (capability, level, min_role, requires_four_eyes, observer_escalation_hours, notes)
VALUES
  (
    'policy.create_manual',
    'confirm',
    'admin',
    false,
    24,
    'M5 HMS Sortie 1. Policy creation from /dashboard/policies create dialog. '
    'policy.create_manual (admin+, confirm): admin creates a workspace-scoped policy. '
    'Called by createPolicy Server Action (policy-actions.ts). '
    'min_role=admin — only workspace admins and owners may create policies. '
    'level=confirm — dialog-initiated action; single confirmation step. '
    'requires_four_eyes=false — single-admin governance write. '
    '24h observer_escalation: governance writes warrant visibility. '
    'Absent this row gate_action default-allows (L-0066 CVE class). 2026-05-17.'
  ),
  (
    'hms.escalate_deviation',
    'confirm',
    'manager',
    false,
    24,
    'M5 HMS Sortie 1 (G4 follow-up). Deviation escalation from DeviationDetailDrawer. '
    'hms.escalate_deviation (manager+, confirm): manager escalates an open or acknowledged deviation. '
    'Called by escalateDeviationAction (update-deviation-action.ts). '
    'min_role=manager — matches sibling hms.resolve_deviation pattern (manager-level workspace action). '
    'level=confirm — drawer-initiated action; single confirmation step. '
    'requires_four_eyes=false — single-manager workspace write. '
    '24h observer_escalation: deviation lifecycle writes warrant visibility. '
    'Absent this row gate_action default-allows (L-0066 CVE class). Renamed from '
    'hms.update_deviation_manual at G4 review 2026-05-17 (naming consistency with '
    'sibling hms.acknowledge_deviation + hms.resolve_deviation seeds).'
  )
ON CONFLICT (capability) DO NOTHING;


-- ─── Part B — engine_authority_config: backfill for all existing workspaces ───
-- The trigger (Part A) covers only FUTURE workspace INSERTs. This CROSS JOIN
-- fills the gap for all workspaces that existed before this migration lands.
-- COALESCE chain mirrors 20260620110300_seed_pipeline_override_authority.sql.
-- Per L-0129: capability literal must appear explicitly in VALUES tuple for the
-- parity scanner (scripts/authority-seed-parity.ts) to detect this seed.

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
CROSS JOIN (VALUES
  ('policy.create_manual',    'confirm', 'admin',   false, 24),
  ('hms.escalate_deviation',  'confirm', 'manager', false, 24)
) AS caps(capability, level, min_role, requires_four_eyes, observer_escalation_hours)
ON CONFLICT (workspace_id, capability) DO NOTHING;


-- ─── Update capability_default_registry COMMENT ───────────────────────────────
-- Extends the COMMENT set by 20260620110300_seed_pipeline_override_authority.sql.
-- Adds policy.create_manual to the canonical list.

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
  '  shift_marketplace.override (ADR-0340 T0.5, 2026-05-16), '
  '  policy.create_manual (M5 HMS Sortie 1, 2026-05-17), '
  '  hms.escalate_deviation (M5 HMS Sortie 1 G4 follow-up, 2026-05-17). '
  'For the full list query: SELECT capability FROM capability_default_registry ORDER BY 1.';
