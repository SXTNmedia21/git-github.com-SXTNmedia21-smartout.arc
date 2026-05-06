-- ============================================
-- 20260519160000_payroll_capability_authority_seed.sql
-- Resurrect `payroll` capability authority seed (ADR-0234)
--
-- `payroll` has been in the CapabilityName union since the initial agent
-- design but was never seeded in engine_authority_config or
-- capability_default_registry — meaning it defaulted to the gate_action
-- default-allow path (CVE-class per L-0066 / L-0097).
--
-- This migration:
--   A. Registers `payroll` in capability_default_registry (auto-seeds
--      new workspaces via the workspace_seed_authority_defaults_trg trigger
--      installed in 20260518000000).
--   B. Backfills engine_authority_config for ALL existing workspaces
--      (mirrors the pattern from 20260518000000 Part B.4).
--
-- Authority level: `confirm` / `admin` — Høy-PII tools require admin
-- confirmation before any write. allowedChannels: ["chat"] (ADR-0078).
-- ADR-0234: payroll capability split from legal capability.
-- ============================================

SET search_path TO public, extensions;

-- ─── Part A: Register in capability_default_registry ─────────────────────────
INSERT INTO public.capability_default_registry
  (capability, level, min_role, requires_four_eyes, observer_escalation_hours, notes)
VALUES
  ('payroll', 'confirm', 'admin', false, 24,
   'Payroll capability — Høy-PII tools. allowedChannels chat-only. ADR-0234.')
ON CONFLICT (capability) DO NOTHING;

-- ─── Part B: Backfill existing workspaces ────────────────────────────────────
-- Same COALESCE chain as 20260518000000 Part B.4 for audit-trail consistency.

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

COMMENT ON COLUMN public.engine_authority_config.capability IS
  'Capability name (matches packages/ai/src/capabilities/types.ts CapabilityName union). '
  'Authority defaults sourced from public.capability_default_registry. '
  'payroll seeded at confirm/admin/24h (ADR-0234, 20260519160000).';
