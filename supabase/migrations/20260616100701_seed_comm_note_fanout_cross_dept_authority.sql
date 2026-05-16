-- ============================================================
-- 20260616100700_seed_comm_note_fanout_cross_dept_authority.sql
-- Dagslinjen QuickAdd — authority seed for comm.note_fanout_cross_dept
--
-- PURPOSE
-- -------
-- Seeds engine_authority_config for capability 'comm.note_fanout_cross_dept'
-- per ADR-0333 (Cross-Department Note Fanout — C4 Authority Gate).
--
-- This capability is gated in create-targeted-note-action.ts when the
-- manager's audience.dept_ids includes a department outside the actor's
-- primary dept-set. Per ADR-0099, every authority decision must produce a
-- gate_evaluation audit row; this seed ensures gate_action() has a
-- workspace-level config row to evaluate against (prevents default-allow
-- transparent passthrough per L-0066).
--
-- AUTHORITY POLICY (ADR-0333)
-- ---------------------------
--   level                  = 'confirm'  — admin must explicitly confirm the
--                                         cross-dept fanout; no auto-execute
--                                         even when role floor is satisfied.
--   min_role               = 'admin'    — manager attempting cross-dept fanout
--                                         receives "Kontakt admin for tverr-avdeling".
--   requires_four_eyes     = false      — single-approver; Phase 2 allowlist
--                                         mechanism (ADR-0333 § Phase 2) will
--                                         downgrade min_role for allowlisted pairs
--                                         without changing this column.
--   observer_escalation_hours = 24      — standard for cross-workspace comms.
--
-- TWO-PART SEED PATTERN (ADR-0192)
-- ----------------------------------
-- Part A: INSERT into capability_default_registry (platform-wide default).
--         Consumed by workspace_seed_authority_defaults_trg on every new
--         workspace INSERT. Future workspaces automatically inherit this row.
--
-- Part B: Backfill INSERT into engine_authority_config for all EXISTING workspaces.
--         The trigger only fires on new workspace INSERT — existing workspaces
--         need an explicit backfill (this section).
--         COALESCE chain: owner/admin → any company member → any user_identity row
--         (mirrors 20260611120100_wfm_capability_authority_seed.sql pattern).
--
-- IDEMPOTENCY
-- -----------
-- Part A: ON CONFLICT (capability) DO NOTHING
-- Part B: ON CONFLICT (workspace_id, capability) DO NOTHING
-- Safe under `db reset` + replay and repeated migrations on Supabase Cloud.
--
-- CI PARITY
-- ---------
-- scripts/authority-seed-parity.ts scans for gateAction({ capability: "X" })
-- call sites in create-targeted-note-action.ts and verifies a matching seed row
-- exists here. The literal 'comm.note_fanout_cross_dept' in the VALUES tuple
-- below satisfies the scanner (L-0129).
--
-- REFERENCES
-- ----------
-- ADR-0333: cross-dept C4 authority gate decision
-- ADR-0099: unified authority gate (gate_action RPC + gate_evaluation audit)
-- ADR-0189: authority-seed-parity CI gate (capability literal required)
-- ADR-0192: capability_default_registry + bootstrap trigger pattern
-- L-0066:   default-allow CVE class (missing seed = silent authority escape)
-- L-0129:   capability literals in VALUES tuples for parity scanner
-- Spec:     docs/superpowers/specs/2026-05-15-dagslinjen-quickadd-design.md § 8
-- ============================================================

SET search_path TO public, extensions;

-- ─── Part A — capability_default_registry: platform-wide default ─────────────
-- Consumed by workspace_seed_authority_defaults_trg (ADR-0192) on every new
-- workspace INSERT. Adding this row is sufficient for all future workspaces.

INSERT INTO public.capability_default_registry
  (capability, level, min_role, requires_four_eyes, observer_escalation_hours, notes)
VALUES
  (
    'comm.note_fanout_cross_dept',
    'confirm',
    'admin',
    false,
    24,
    'ADR-0333. Cross-department targeted note fanout. '
    'note_fanout_cross_dept (admin+, confirm): manager in Dept X targeting audience '
    'that resolves to recipients in Dept Y requires admin confirmation. '
    'Own-dept path does NOT hit this capability — only cross-dept audiences are gated. '
    'level=confirm: admin must explicitly confirm the cross-dept blast. '
    'Phase 2 allowlist (ADR-0333 § Phase 2) will downgrade min_role for explicitly '
    'allowlisted dept pairs without changing this registry row. '
    '24h observer escalation: cross-dept comms warrant supervisor visibility. 2026-05-15.'
  )
ON CONFLICT (capability) DO NOTHING;


-- ─── Part B — engine_authority_config: backfill for all existing workspaces ───
-- The trigger (Part A) covers only FUTURE workspace INSERTs. This section
-- backfills all workspaces that existed before this migration lands.
-- COALESCE chain mirrors 20260611120100_wfm_capability_authority_seed.sql.
-- Per L-0129: capability literals must appear explicitly in VALUES tuples for
-- the parity scanner (scripts/authority-seed-parity.ts) to detect seeds.

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
-- L-0129: capability literal in VALUES tuple for parity scanner detection
CROSS JOIN (VALUES
  ('comm.note_fanout_cross_dept', 'confirm', 'admin', false, 24)
) AS caps(capability, level, min_role, requires_four_eyes, observer_escalation_hours)
ON CONFLICT (workspace_id, capability) DO NOTHING;


-- ─── Update capability_default_registry COMMENT ───────────────────────────────
-- Extends the COMMENT set by 20260611120100_wfm_capability_authority_seed.sql.
-- Adds comm.note_fanout_cross_dept to the canonical documentation list.

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
  '  comm.note_fanout_cross_dept (ADR-0333, 2026-05-15). '
  'For the full list query: SELECT capability FROM capability_default_registry ORDER BY 1.';
