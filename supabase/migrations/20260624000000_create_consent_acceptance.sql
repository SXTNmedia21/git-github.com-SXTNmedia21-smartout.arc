-- 20260624000000_create_consent_acceptance.sql
-- Onboarding-layer consent capture (handbook + GDPR + tariff).
-- Append-only audit table per Bokf. §13-style immutability.
-- Distinct from ADR-0311 payroll.consent_document (Aml. §14-15 deduction consent).

CREATE TABLE public.consent_acceptance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspace(workspace_id) ON DELETE CASCADE,
  profile_id   UUID NOT NULL REFERENCES public.profile(profile_id) ON DELETE CASCADE,
  consent_type TEXT NOT NULL CHECK (consent_type IN ('handbook','gdpr','tariff')),
  document_version  TEXT NOT NULL,
  accepted_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  source            TEXT NOT NULL DEFAULT 'employee-onboarding-wizard',
  client_user_agent TEXT,
  client_ip         TEXT
);

CREATE INDEX idx_consent_acceptance_profile
  ON public.consent_acceptance(profile_id, consent_type, accepted_at DESC);

ALTER TABLE public.consent_acceptance ENABLE ROW LEVEL SECURITY;

-- SELECT: own profile + manager/admin/owner in same workspace
CREATE POLICY "jwt_read_own_consent" ON public.consent_acceptance
  FOR SELECT
  USING (
    profile_id IN (
      SELECT p.profile_id FROM public.profile p
      WHERE p.user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.profile p
      WHERE p.user_id = auth.uid()
        AND p.workspace_id = consent_acceptance.workspace_id
        AND p.role IN ('manager','admin','owner')
    )
  );

-- API-key path (mirrors smartout-database-guide convention)
CREATE POLICY "api_key_read_consent" ON public.consent_acceptance
  FOR SELECT
  USING (workspace_id = public.get_api_workspace_id());

-- INSERT: service-role only (Server Action / SECURITY DEFINER RPC).
-- No JWT INSERT policy → forces all writes through the action layer.

-- NO UPDATE policy. NO DELETE policy. Audit-trail immutability.

COMMENT ON TABLE  public.consent_acceptance IS
  'Onboarding-layer consent audit log (handbook + GDPR + tariff). Append-only.';
COMMENT ON COLUMN public.consent_acceptance.document_version IS
  'Version tag of the document the user accepted (e.g. handbook-v3). V1 hardcodes constants.';
