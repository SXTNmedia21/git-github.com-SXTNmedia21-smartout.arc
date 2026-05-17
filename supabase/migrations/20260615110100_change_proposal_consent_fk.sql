-- Migration: Add consent_document FK + deduction_type to change_proposal
-- SMA-328 — AML §14-15 tredje ledd trekk-samtykke
-- ADR-0311: FK links wage_line_override proposals to their signed consent document.
--
-- ADD COLUMN IF NOT EXISTS used for idempotency (safe to re-run).
-- ON DELETE RESTRICT: prevents deleting a consent_document while proposals reference it
-- (audit trail integrity — the consent evidence must outlive the proposal).

ALTER TABLE public.change_proposal
  ADD COLUMN IF NOT EXISTS consent_document_id UUID NULL
    REFERENCES payroll.consent_document(consent_document_id) ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS deduction_type TEXT NULL
    CHECK (deduction_type IN ('loan_agreement', 'uniform_policy', 'union_dues', 'court_order', 'other_voluntary'));

-- Index on consent_document_id for reverse lookup (which proposals reference this consent?)
-- Partial: only non-null rows, so rows without deduction context are not indexed.
CREATE INDEX IF NOT EXISTS idx_change_proposal_consent_doc
  ON public.change_proposal (consent_document_id)
  WHERE consent_document_id IS NOT NULL;

-- Backfill: flag existing deduction proposals that lack consent_document_id.
-- Council Q2 verdict: deviation-flag, NOT retroactive block (Bokf.lov §7 journalføring).
-- Inserts payroll.deviation rows so auditors see the gap without blocking historical export.
--
-- payroll.deviation schema (renamed from public.payroll_deviation via 20260422110700_payroll_schema.sql):
--   check_id TEXT NOT NULL   — maps to 'consent_gap_aml_14_15_tredje_ledd'
--   severity payroll.deviation_severity — 'warning' (not error: does not block export per lovsen)
--   message TEXT NOT NULL
--   details JSONB DEFAULT '{}'
--   profile_id UUID REFERENCES profile(profile_id)
--   period_id  UUID REFERENCES payroll.period(id)
--   workspace_id UUID NOT NULL
--
-- Only targets: kind='wage_line_override' + category='deduction' + consent_document_id IS NULL.
-- Safe to re-run (does NOT create duplicate deviations — uses NOT EXISTS guard on check_id + profile).
INSERT INTO payroll.deviation (
  workspace_id,
  check_id,
  severity,
  profile_id,
  period_id,
  message,
  details,
  created_at,
  updated_at
)
SELECT
  cp.workspace_id,
  'consent_gap_aml_14_15_tredje_ledd',
  'warning',
  (cp.changes ->> 'target_profile_id')::uuid,
  (cp.changes ->> 'period_id')::uuid,
  'Historisk trekk-forslag uten registrert samtykke (Aml. §14-15 tredje ledd nr. 1-6). Eksport ikke blokkert per Bokf.lov §7, men gap bør vurderes av revisor.',
  jsonb_build_object(
    'change_proposal_id', cp.change_proposal_id,
    'paragraph', 'Aml. §14-15 tredje ledd nr. 1-6',
    'backfill_migration', '20260615110100'
  ),
  now(),
  now()
FROM public.change_proposal cp
WHERE cp.kind = 'wage_line_override'
  AND cp.changes ->> 'category' = 'deduction'
  AND cp.consent_document_id IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM payroll.deviation d
    WHERE d.check_id = 'consent_gap_aml_14_15_tredje_ledd'
      AND (d.details ->> 'change_proposal_id') = cp.change_proposal_id::text
  );
