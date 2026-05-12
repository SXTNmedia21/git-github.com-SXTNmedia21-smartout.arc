-- 20260508110100_payroll_phase3_export_authority_seed.sql
--
-- T2.2 — Authority seed for export_period capability (Payroll Phase 3).
--
-- Purpose:
--   The export_period tool (Wave B, T3.1) downloads a CSV export of a locked
--   payroll period. Because it may expose personnummer + bankkonto (when
--   include_unmasked=true), the authority level is 'confirm' at min_role='admin'.
--
--   Pattern mirrors 20260507110200_payroll_phase2_authority_seed.sql (Phase 2)
--   and 20260527100100_payroll_phase1_authority_seed.sql (Phase 1).
--
-- Design rationale:
--   - level='confirm': admin must confirm the download intent, particularly
--     when requesting unmasked PII. The capability tool body shows a confirmation
--     step before proceeding (Wave B, T3.1). This maps to 'confirm' not 'autonomous'.
--   - min_role='admin': managers can VIEW the Lines tab but may not export CSVs
--     (CSV export creates a downloadable file with aggregated salary data and
--     optionally unmasked PII — admin-only action per Riksavtalen compliance).
--   - requires_four_eyes=false: the confirm step in the UI is the human gate.
--     Four-eyes in engine_authority_config is a separate gate for a second
--     approver, not the first confirmer.
--   - observer_escalation_hours=72: export anomalies (e.g., unmasked PII download
--     outside expected hours) should be reviewed within 3 business days.
--
-- Sub-capability dot-notation:
--   Registered as 'payroll.export_period' (dot-scoped per-tool override under
--   the 'payroll' parent capability). Pattern established by:
--     payroll.override_calculation_line (Phase 2)
--     billing_query, contract, governance capabilities.
--
-- ADR references: ADR-0204 (gatedMutation), ADR-0151 (workspace_id isolation),
--                 ADR-0078 (channel guard — CSV download is chat-only, not voice).
--
-- Rollback plan:
--   DELETE FROM public.capability_default_registry WHERE capability = 'payroll.export_period';
--   DELETE FROM public.engine_authority_config WHERE capability = 'payroll.export_period';

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
        'payroll.export_period',
        'confirm',
        'admin',
        false,
        72,
        'Payroll Phase 3: admin exports CSV of a locked period. '
        'Chat-only (ADR-0078 — CSV files may contain unmasked PII). '
        'Tool body: gatedMutation + L-0177 fail-fast + ADR-0151 workspace scope. '
        'Unmasked PII: emits payroll.csv_export_unmasked (high-PII audit event). '
        'Period must be status=''locked'' before export (locked-period guard). '
        'Idempotency key prevents double-export. '
        'ADR-0204.'
      )
    ON CONFLICT (capability) DO NOTHING;
  END IF;
END $$;

-- ─── Part B: Backfill engine_authority_config for all existing workspaces ─────
-- Same COALESCE chain as Phase 1 + Phase 2 seeds.
-- ON CONFLICT DO NOTHING: existing rows (from workspace_seed_authority_defaults_trg
-- or a prior seed run) are not disturbed.

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
  'payroll.export_period',
  'confirm',
  'admin',
  false,
  72,
  -- COALESCE: owner or admin of the workspace, falling back to any member,
  -- falling back to any user_identity (sandbox/test workspaces only).
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
  'Dot-scoped names (e.g. ''payroll.export_period'') are per-tool overrides '
  'nested within the parent capability (e.g. ''payroll''). '
  'payroll.export_period seeded at confirm/admin (ADR-0204, 20260508110100).';
