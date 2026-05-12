-- 20260527100100_payroll_phase1_authority_seed.sql
-- T1.1 — Payroll capability authority seed (per-tool notes).
--
-- SCHEMA REALITY CHECK: capability_default_registry has columns:
--   capability, level, min_role, requires_four_eyes,
--   observer_escalation_hours, notes
-- There is NO `tool` or `allowed_channels` column (verified against database.types.ts).
--
-- SORTIE-PHASE-1.md §4.1 lists 7 per-tool rows — those columns do not exist.
-- The existing pattern (20260519160000) seeds ONE row per capability.
-- Payroll capability row was already seeded by 20260519160000 at level='confirm'/min_role='admin'.
--
-- This migration: seeds the payroll capability row idempotently, and backfills
-- engine_authority_config for any workspaces created after 20260519160000.
-- Per-tool authority documentation is encoded in the notes column.
--
-- Source authority: SORTIE-PHASE-1.md §4.1, ADR-0234.
-- All payroll tools are chat-only (ADR-0078) — enforced at capability tool level.

SET search_path TO public, extensions;

-- ─── Part A: Ensure capability_default_registry row (idempotent) ──────────────
INSERT INTO public.capability_default_registry
  (capability, level, min_role, requires_four_eyes, observer_escalation_hours, notes)
VALUES
  ('payroll', 'confirm', 'admin', false, 24,
   'Payroll tools (chat-only, ADR-0078). Per-tool authority: lock_period=confirm/admin, '
   'acknowledge_deviation=suggest/manager, set_overtime_mode=confirm/admin, '
   'adjust_timebank_balance=confirm/admin, force_timebank_payout=confirm/admin, '
   'query_timebank_balance=autonomous/employee, add_manual_supplement=confirm/admin, '
   'recalculate_period=autonomous/system. ADR-0234.')
ON CONFLICT (capability) DO NOTHING;

-- ─── Part B: Backfill engine_authority_config for new workspaces ──────────────
-- Mirrors pattern from 20260519160000. ON CONFLICT DO NOTHING is safe —
-- existing rows created by the workspace_seed_authority_defaults_trg trigger
-- are not disturbed.
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
  'payroll',
  'confirm',
  'admin',
  false,
  24,
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
