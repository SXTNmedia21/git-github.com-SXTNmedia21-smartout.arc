-- Migration: Create payroll.consent_document
-- SMA-328 — AML §14-15 tredje ledd trekk-samtykke
-- ADR-0311: Trekk-samtykke som payroll-domain artifact
--
-- New table payroll.consent_document: own lifecycle, own RLS, own DocuSeal binding.
-- Supersedes plan to extend confirmation_signature (rejected: FK chain violation,
-- cascade invariant 2 — one entity = one role).
--
-- Paragraph: Aml. §14-15 tredje ledd nr. 1-6
-- DocuSeal: deduction_consent document type routes here (NOT to confirmation_signature).

CREATE TABLE IF NOT EXISTS payroll.consent_document (
  consent_document_id    UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id           UUID         NOT NULL REFERENCES public.workspace(workspace_id) ON DELETE CASCADE,
  employee_profile_id    UUID         NOT NULL REFERENCES public.profile(profile_id)    ON DELETE RESTRICT,
  consent_type           TEXT         NOT NULL
    CHECK (consent_type IN ('loan_agreement', 'uniform_policy', 'union_dues', 'court_order', 'other_voluntary')),
  -- court_order_reference is required when consent_type = 'court_order' (lovhjemmel sufficient,
  -- no employee signature — stores the utleggstrekk-saksnummer / court order reference number).
  court_order_reference  TEXT         NULL,
  signed_at              TIMESTAMPTZ  NOT NULL,
  signed_document_url    TEXT         NOT NULL,
  docuseal_submission_id TEXT         NULL,
  -- expires_at: e.g. loan-agreement repayment-end date. NULL = does not expire.
  expires_at             TIMESTAMPTZ  NULL,
  -- superseded_by_id: self-FK for consent renewal chain (new consent supersedes old one).
  superseded_by_id       UUID         NULL REFERENCES payroll.consent_document(consent_document_id) ON DELETE SET NULL,
  status                 TEXT         NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'expired', 'revoked', 'superseded')),
  -- paragraph_ref: canonical Norwegian law reference stored per row for audit immutability.
  paragraph_ref          TEXT         NOT NULL DEFAULT 'Aml. §14-15 tredje ledd nr. 1-6',
  created_at             TIMESTAMPTZ  NOT NULL DEFAULT now(),
  updated_at             TIMESTAMPTZ  NOT NULL DEFAULT now(),
  -- Constraint: court_order type MUST have a non-null court_order_reference.
  CHECK (consent_type != 'court_order' OR court_order_reference IS NOT NULL)
);

-- Indexes --
-- Primary lookup: employee profile + workspace + status (most queries filter on all three).
CREATE INDEX IF NOT EXISTS idx_consent_doc_profile_status
  ON payroll.consent_document (employee_profile_id, workspace_id, status);

-- Partial index on expires_at for the expiry-sweep job (skips NULL rows).
CREATE INDEX IF NOT EXISTS idx_consent_doc_expires
  ON payroll.consent_document (expires_at)
  WHERE expires_at IS NOT NULL;

-- Row Level Security --
ALTER TABLE payroll.consent_document ENABLE ROW LEVEL SECURITY;

-- JWT policy: workspace-scoped SELECT for managers and above.
-- Uses the shared helper get_workspace_ids_for_user() (ADR-0151 pattern).
CREATE POLICY jwt_select_consent_doc ON payroll.consent_document
  FOR SELECT
  USING (workspace_id IN (SELECT public.get_workspace_ids_for_user(auth.uid())));

-- Service role policy: full access for DocuSeal callback path.
-- INSERT is exclusively via service role (DocuSeal webhook callback route) —
-- employees sign externally; no JWT INSERT path is exposed.
CREATE POLICY service_role_consent_doc ON payroll.consent_document
  FOR ALL
  TO service_role
  USING (true);

-- API key read policy: workspace-scoped read for external integrations.
-- get_api_workspace_id() validates the API key JWT claim (ADR-0039 gateway pattern).
CREATE POLICY api_key_select_consent_doc ON payroll.consent_document
  FOR SELECT
  USING (workspace_id = public.get_api_workspace_id());
