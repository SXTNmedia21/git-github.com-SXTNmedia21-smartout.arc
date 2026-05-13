-- 20260515120300_agent_session_whisper.sql
-- ADR-0185 — Platform Admin Whisper (metadata injection, never user-facing).
--
-- L-0042 timestamp verified: tip 20260515120200, depends on:
--   - workspace (00001_identity_tables.sql)
--   - profile (00001_identity_tables.sql)
--
-- Whispers are <admin_note> metadata injected into the next-turn system prompt.
-- They are NEVER rendered to the user — enforced via stage-engine consumer + ADR-0078.

SET search_path TO public, extensions;

CREATE TABLE public.agent_session_whisper (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id       uuid NOT NULL,
  workspace_id     uuid NOT NULL REFERENCES public.workspace(workspace_id) ON DELETE CASCADE,
  admin_profile_id uuid NOT NULL REFERENCES public.profile(profile_id) ON DELETE RESTRICT,
  content          text NOT NULL CHECK (length(content) > 0 AND length(content) <= 2000),
  is_consumed      boolean NOT NULL DEFAULT false,
  consumed_at      timestamptz,
  created_at       timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_asw_session_unconsumed
  ON public.agent_session_whisper (session_id, created_at)
  WHERE is_consumed = false;

ALTER TABLE public.agent_session_whisper ENABLE ROW LEVEL SECURITY;

-- Workspace admin reads/writes their workspace whispers
DROP POLICY IF EXISTS "jwt_admin_rw_whisper" ON public.agent_session_whisper;
CREATE POLICY "jwt_admin_rw_whisper" ON public.agent_session_whisper
  FOR ALL
  USING (
    workspace_id IN (SELECT public.get_workspace_ids_for_user(auth.uid()))
    AND public.is_admin_in_workspace(auth.uid(), workspace_id)
  );

-- Godmode cross-workspace
DROP POLICY IF EXISTS "godmode_rw_whisper" ON public.agent_session_whisper;
CREATE POLICY "godmode_rw_whisper" ON public.agent_session_whisper
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.user_identity
      WHERE user_identity.user_id = auth.uid() AND user_identity.is_godmode = true
    )
  );

COMMENT ON TABLE public.agent_session_whisper IS
  'ADR-0185: Admin whispers — <admin_note> metadata injected into next-turn system prompt. NEVER rendered to user.';
