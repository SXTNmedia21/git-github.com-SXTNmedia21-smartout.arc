-- 20260527100000_payroll_phase1_provenance.sql
-- T0.2 — Add provenance column to payroll.calculation.
--
-- Verified: column is absent from database.types.ts (payroll.calculation Row
-- has no provenance field). Required by calc-engine for ADR-0076 snapshot-and-forward.
--
-- Two-step for rollback safety on production data:
--   Step 1 — add column with default (immediately safe for existing rows)
--   Step 2 — DROP the default so new rows must supply provenance explicitly
--
-- Source authority: SORTIE-PHASE-1.md T0.2 / docs/modules/payroll/ARCHITECTURE.md §3.

SET search_path TO payroll, public, extensions;

ALTER TABLE payroll.calculation
  ADD COLUMN IF NOT EXISTS provenance JSONB NOT NULL DEFAULT '{}'::jsonb;

-- NOTE: Default intentionally retained for Phase 1.
-- The seed.sql data and early calc-engine rows may not yet carry provenance.
-- Phase 2 will DROP DEFAULT once all write paths supply provenance explicitly.
-- See SORTIE-PHASE-1.md T0.2 — "verified present" is the acceptance criterion.

COMMENT ON COLUMN payroll.calculation.provenance IS
  'ADR-0076 snapshot-and-forward provenance blob. '
  'Minimum shape: { "tariff_snapshot": {...}, "rules_evaluated": [...], "derivation_version": N }. '
  'Immutable after INSERT (append-only pattern mirrors shift_pay_calculation_event).';
