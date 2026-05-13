-- 20260515120200_agent_session_envelope.sql
-- ADR-0184 § Redaction Pipeline — reversible break-glass for PII.
--
-- L-0042 timestamp verified: tip 20260515120100, depends on:
--   - agent_session_recording (20260515120100) — FK content_envelope_id
--   - workspace (00001_identity_tables.sql)

SET search_path TO public, extensions;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE public.agent_session_envelope (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id       uuid NOT NULL REFERENCES public.workspace(workspace_id) ON DELETE CASCADE,
  encrypted_payload  bytea NOT NULL,
  pii_class          text NOT NULL CHECK (pii_class IN (
    'personnummer','bank','email','phone','address','salary','medical','free_text'
  )),
  created_at         timestamptz NOT NULL DEFAULT now(),
  redact_after       timestamptz NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_ase_redact_after ON public.agent_session_envelope (redact_after);
CREATE INDEX IF NOT EXISTS idx_ase_workspace ON public.agent_session_envelope (workspace_id);

-- Add FK from recording back to envelope
ALTER TABLE public.agent_session_recording
  ADD CONSTRAINT fk_asr_envelope
  FOREIGN KEY (content_envelope_id)
  REFERENCES public.agent_session_envelope(id)
  ON DELETE SET NULL;

-- RLS — godmode only for envelope reads (break-glass is platform-admin)
ALTER TABLE public.agent_session_envelope ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "godmode_only_read_envelope" ON public.agent_session_envelope;
CREATE POLICY "godmode_only_read_envelope" ON public.agent_session_envelope
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.user_identity
      WHERE user_identity.user_id = auth.uid() AND user_identity.is_godmode = true
    )
  );

COMMENT ON TABLE public.agent_session_envelope IS
  'ADR-0184 § PII: encrypted break-glass envelope. Raw PII accessed only via BFF /recorder/break-glass endpoint (audit-logged).';
