-- 20260507110200_payroll_phase2_authority_seed.sql
--
-- T1.3 — Authority seed for override_calculation_line capability (Payroll Phase 2).
--
-- Purpose:
--   The override_calculation_line tool is a new payroll capability tool introduced
--   in Phase 2. It allows a manager to insert a change_proposal of kind='wage_line_override'
--   for admin review. Because the tool can result in changes to a calculated payroll
--   line (after admin approval + recalc), the authority level is 'confirm' at
--   min_role='manager' — the manager proposes, the admin confirms (four-eyes pattern).
--
--   This seed follows the identical pattern established in:
--     20260519160000_payroll_capability_authority_seed.sql (payroll capability)
--     20260527100100_payroll_phase1_authority_seed.sql (Phase 1 per-tool notes)
--
-- Design note: override_calculation_line is NOT a separate CapabilityName. It is a
-- tool within the existing 'payroll' capability. The engine_authority_config row
-- registers it under capability='payroll.override_calculation_line' to allow
-- fine-grained per-tool authority override while remaining nested under 'payroll'.
-- Pattern established by billing_query, contract, and governance capabilities.
--
-- Authority rationale:
--   - level='confirm': manager proposes → UI shows "Venter godkjenning" → admin approves.
--     The tool body inserts change_proposal (not the final mutation). The actual
--     payroll_calculation mutation happens only after admin approval via the
--     override-applier (T2.2). This maps to 'confirm' not 'autonomous'.
--   - min_role='manager': employees cannot propose line overrides (they lack the
--     context to distinguish tariff interpretation from data errors).
--   - requires_four_eyes=false: the propose+approve flow IS the two-eyes pattern.
--     Four-eyes in engine_authority_config is a separate gate on the approval action,
--     not the proposal submission. Keep false here.
--
-- ADR references: ADR-0292 (override-applier semantics), ADR-0204 (gatedMutation).
--
-- Rollback plan:
--   DELETE FROM public.capability_default_registry WHERE capability = 'payroll.override_calculation_line';
--   DELETE FROM public.engine_authority_config WHERE capability = 'payroll.override_calculation_line';

SET search_path TO public, extensions;

-- ─── Part A: Register in capability_default_registry ─────────────────────────
-- L-0042 ordering bug: capability_default_registry is created later (in
-- 20260518000000_contract_authority_seed_upsert_and_bootstrap.sql). Guard so
-- this migration is a no-op on fresh DBs; the registry insert is re-driven
-- by 20260518000000's bootstrap function once that migration runs.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_tables
    WHERE schemaname = 'public' AND tablename = 'capability_default_registry'
  ) THEN
    INSERT INTO public.capability_default_registry
      (capability, level, min_role, requires_four_eyes, observer_escalation_hours, notes)
    VALUES
      (
        'payroll.override_calculation_line',
        'confirm',
        'manager',
        false,
        24,
        'Payroll Phase 2: manager proposes wage_line_override change_proposal; admin approves. '
        'Chat-only (ADR-0078 — PII). Tool body: gatedMutation + L-0177 fail-fast + ADR-0151. '
        'Propose action: confirm/manager. Approve/reject: handled by payroll capability at confirm/admin. '
        'ADR-0292.'
      )
    ON CONFLICT (capability) DO NOTHING;
  END IF;
END $$;

-- ─── Part B: Backfill engine_authority_config for all existing workspaces ─────
-- Mirrors the COALESCE chain from 20260519160000 and 20260527100100.
-- ON CONFLICT DO NOTHING: existing rows (from workspace_seed_authority_defaults_trg)
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
  'payroll.override_calculation_line',
  'confirm',
  'manager',
  false,
  24,
  -- COALESCE: owner or admin of the workspace, falling back to any member,
  -- falling back to any user_identity (only if workspace has no members yet —
  -- sandbox/test workspaces only).
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
  'Dot-scoped names (e.g. ''payroll.override_calculation_line'') are per-tool overrides '
  'nested within the parent capability (e.g. ''payroll''). '
  'payroll.override_calculation_line seeded at confirm/manager (ADR-0292, 20260507110200).';
