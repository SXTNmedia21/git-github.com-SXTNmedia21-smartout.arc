-- ============================================
-- 20260616100300_engine_authority_config_contract_seed.sql
-- contracts-compliance-debt-cleanup sortie — Track C
--
-- Purpose
--   Closes the default-allow gap opened by T1 (feat/contracts-compliance-
--   cluster, merge f959d9643): five gateAction call sites now use
--   capability='contract' with action_types:
--     compose        — POST /api/employment-contracts (new employment contract)
--     send_single    — POST /api/employment-contracts/[id]/send
--     revise         — POST /api/employment-contracts/[id]/revise
--     regenerate     — POST /api/employment-contracts/[id]/regenerate
--     send_dispatch  — POST /api/contracts/send (DocuSeal dispatch)
--
-- Schema reality
--   engine_authority_config columns (accumulated across migrations):
--     id, workspace_id (NOT NULL, FK), capability, level, min_role,
--     requires_four_eyes, observer_escalation_hours, updated_by (nullable),
--     created_at, updated_at.
--   There is NO action_types, default_action, or required_role column.
--   NULL workspace_id is NOT supported (NOT NULL constraint).
--   gate_action() queries WHERE workspace_id = p_workspace_id — workspace-specific.
--
-- Prior seed status
--   contract capability already seeded:
--     20260515170500 — initial seed (godmode-guarded, may have no-oped on fresh DBs)
--     20260518000000 — definitive UPSERT + trigger bootstrap (ADR-0192)
--   Both use level='confirm', min_role='admin', requires_four_eyes=false.
--   capability_default_registry row exists ('contract', 'confirm', 'admin', ...).
--   New workspaces auto-seed via workspace_seed_authority_defaults_trg trigger.
--
-- This migration does two things:
--   A. Backfills any workspace that may have been created AFTER 20260518000000
--      landed but whose trigger invocation was lost (e.g. replayed DB from
--      pre-20260518 snapshot). Idempotent via ON CONFLICT DO NOTHING.
--   B. Updates capability_default_registry.notes for 'contract' to document
--      the T1 action_types — serves as the authority-seed-parity CI comment
--      target so scripts/authority-seed-parity.ts can verify gateAction sites.
--
-- Policy (unchanged from 20260518000000 / 20260515170500)
--   level                  = 'confirm'  — admin must confirm before any
--                                          contract authoring mutation fires.
--   min_role               = 'admin'    — manager and employee are downgraded
--                                         to suggest (read-only in router).
--   requires_four_eyes     = false      — single-approver; T1 did not change this.
--   observer_escalation_hours = 72      — matches helpdesk_query (L-0066).
--
-- Refs: ADR-0192, ADR-0162, ADR-0309, L-0066, L-0097
--       SMA-306, SMA-307, SMA-310, SMA-311
--       feat/contracts-compliance-cluster merge f959d9643
-- ============================================

SET search_path TO public, extensions;

-- ─── Part A: Backfill engine_authority_config for all workspaces ─────────────
-- Idempotent: ON CONFLICT (workspace_id, capability) DO NOTHING.
-- Any workspace already covered by 20260515170500 or 20260518000000 is
-- silently skipped. This only inserts rows for workspaces that somehow
-- missed both prior seeds.

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
      -- Fallback: any member of the company.
      SELECT cm.user_id
      FROM public.company_member cm
      WHERE cm.company_id = w.company_id
      ORDER BY cm.created_at
      LIMIT 1
    ),
    (
      -- Last resort: any user_identity row (local seed data).
      SELECT ui.user_id FROM public.user_identity ui ORDER BY ui.created_at LIMIT 1
    )
  )
FROM public.workspace w
ON CONFLICT (workspace_id, capability) DO NOTHING;

-- ─── Part B: Update capability_default_registry notes ────────────────────────
-- Documents the T1 gateAction action_types so authority-seed-parity CI can
-- cross-reference the five call sites without scanning route files.
-- UPDATE only; DO NOT INSERT — 20260518000000 already owns the canonical row.

UPDATE public.capability_default_registry
SET notes = 'Chat-only authoring capability. Council 2026-04-22 Gate G4. ADR-0192. '
            'T1 gateAction action_types (f959d9643): compose (POST /api/employment-contracts), '
            'send_single (/[id]/send), revise (/[id]/revise), regenerate (/[id]/regenerate), '
            'send_dispatch (POST /api/contracts/send). '
            'level=confirm/min_role=admin: all five routes require admin role.'
WHERE capability = 'contract';
