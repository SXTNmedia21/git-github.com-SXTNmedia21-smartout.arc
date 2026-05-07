-- 20260527100400_payroll_phase1_tariff_law_version.sql
-- T1.7 — Extend tariff_rate_table with law_version, verbatim_pending,
--         paragraf_ref, seniority_level, role_class.
--
-- Current tariff_rate_table columns (from database.types.ts):
--   id, workspace_id, rate_type, source, amount, unit, effective_from, effective_until,
--   seniority_years (NUMERIC, nullable), profession_id (FK), provenance, metadata,
--   seeded_at, seeded_from_framework_binding_id, created_at, updated_at.
--
-- MISSING per task spec T1.7 + T1.9:
--   law_version        — Riksavtalen year string ('2024', '2025', '2026')
--   verbatim_pending   — whether Lovsen-MCP fetch is pending for this row
--   paragraf_ref       — e.g. 'Riksavtalen §4.3-3.2' (used in seed + audit)
--   seniority_level    — human-readable seniority name (Begynner / 2år / 4år …)
--   role_class         — kokk_m_fagbrev | kokk_u_fagbrev | øvrig_m_fagbrev | øvrig_u_fagbrev
--
-- NOTE: seniority_years already exists (NUMERIC, nullable) — disambiguates numeric level.
-- role_class and seniority_level are TEXT columns for minstelønn disambiguation.
--
-- Two-step for law_version default (add with default → drop default):
-- Source authority: SORTIE-PHASE-1.md T1.7, T1.9, SORTIE-PHASE-1.md §4.2.

SET search_path TO public, extensions;

-- law_version: versioning string for Riksavtalen year. Two-step.
ALTER TABLE public.tariff_rate_table
  ADD COLUMN IF NOT EXISTS law_version TEXT NOT NULL DEFAULT '2025';

ALTER TABLE public.tariff_rate_table
  ALTER COLUMN law_version DROP DEFAULT;

-- verbatim_pending: true = Lovsen-MCP fetch not yet completed for this row.
ALTER TABLE public.tariff_rate_table
  ADD COLUMN IF NOT EXISTS verbatim_pending BOOLEAN NOT NULL DEFAULT false;

-- paragraf_ref: Riksavtalen paragraph reference for audit and Botsson salary_query.
ALTER TABLE public.tariff_rate_table
  ADD COLUMN IF NOT EXISTS paragraf_ref TEXT;

-- seniority_level: human-readable seniority label (Begynner / 2år / 4år / 6år / 8år / 10år).
-- Complements existing seniority_years (numeric). Text label for display and matching.
ALTER TABLE public.tariff_rate_table
  ADD COLUMN IF NOT EXISTS seniority_level TEXT;

-- role_class: minstelønn role discriminator.
-- Values: 'kokk_m_fagbrev' | 'kokk_u_fagbrev' | 'øvrig_m_fagbrev' | 'øvrig_u_fagbrev'
-- NULL for supplement/overtime rows that are not role-specific.
ALTER TABLE public.tariff_rate_table
  ADD COLUMN IF NOT EXISTS role_class TEXT
    CHECK (role_class IN ('kokk_m_fagbrev', 'kokk_u_fagbrev', 'øvrig_m_fagbrev', 'øvrig_u_fagbrev'));

COMMENT ON COLUMN public.tariff_rate_table.law_version IS
  'Riksavtalen agreement year: ''2024'', ''2025'', ''2026''. '
  'No default — every INSERT must supply the year. ADR-0252.';

COMMENT ON COLUMN public.tariff_rate_table.verbatim_pending IS
  'true = Lovsen-MCP has not yet fetched and verified verbatim_text for this row. '
  'Rows with verbatim_pending=true should be treated as unverified by the engine.';

COMMENT ON COLUMN public.tariff_rate_table.paragraf_ref IS
  'Riksavtalen paragraph reference, e.g. ''Riksavtalen §4.3-3.2''. '
  'Used in shift_pay_calculation_event.source_text_applied and Botsson salary_query.';

COMMENT ON COLUMN public.tariff_rate_table.seniority_level IS
  'Human-readable seniority label: Begynner / 2år / 4år / 6år / 8år / 10år. '
  'Complements seniority_years (numeric). NULL for non-minstelønn rows.';

COMMENT ON COLUMN public.tariff_rate_table.role_class IS
  'Minstelønn role class discriminator per Riksavtalen §3.3: '
  'kokk_m_fagbrev | kokk_u_fagbrev | øvrig_m_fagbrev | øvrig_u_fagbrev. '
  'NULL for supplement and overtime rate rows.';
