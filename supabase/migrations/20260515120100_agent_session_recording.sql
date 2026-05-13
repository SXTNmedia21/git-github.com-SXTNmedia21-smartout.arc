-- 20260515120100_agent_session_recording.sql
-- ADR-0184 — Session Recorder Architecture
-- Per-turn agent session recording. Redact-on-write for PII. Tiered retention via cron.
--
-- L-0042 timestamp verified: tip 20260515120000, deps:
--   - workspace: created in 00001_identity_tables.sql (earlier)
--   - profile: created in 00001_identity_tables.sql (earlier)
--   - engine_state: created in 20260304100000_engine_process_tables.sql (earlier)
--
-- Schema note: workspace PK is workspace_id, profile PK is profile_id, engine_state PK is id.

SET search_path TO public, extensions;

CREATE TABLE public.agent_session_recording (
  id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id             uuid NOT NULL,
  workspace_id           uuid NOT NULL REFERENCES public.workspace(workspace_id) ON DELETE CASCADE,
  profile_id             uuid REFERENCES public.profile(profile_id) ON DELETE SET NULL,
  engine_state_id        uuid REFERENCES public.engine_state(id) ON DELETE SET NULL,
  turn_index             int NOT NULL,
  turn_kind              text NOT NULL CHECK (turn_kind IN (
    'user_input','agent_response','tool_call','tool_result',
    'guardian_verdict','memory_read','memory_write','whisper'
  )),
  phase                  text NOT NULL CHECK (phase IN (
    'classifier_input','classifier_output','authority_load','context_collect',
    'prompt_built','llm_request','llm_response','tool_exec','guardian_eval','post_turn'
  )),
  content_redacted       jsonb NOT NULL,
  content_envelope_id    uuid,  -- FK added after envelope table (Task 2)
  meta                   jsonb NOT NULL DEFAULT '{}'::jsonb,
  is_flagged             boolean NOT NULL DEFAULT false,
  flag_reason            text,
  flagged_by_profile_id  uuid REFERENCES public.profile(profile_id) ON DELETE SET NULL,
  attention_score        numeric(4,2) CHECK (attention_score >= 0 AND attention_score <= 1),
  created_at             timestamptz NOT NULL DEFAULT now(),
  updated_at             timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_asr_session_turn ON public.agent_session_recording (session_id, turn_index);
CREATE INDEX IF NOT EXISTS idx_asr_workspace_created ON public.agent_session_recording (workspace_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_asr_engine_state ON public.agent_session_recording (engine_state_id) WHERE engine_state_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_asr_flagged ON public.agent_session_recording (is_flagged, created_at DESC) WHERE is_flagged = true;
CREATE INDEX IF NOT EXISTS idx_asr_high_attention ON public.agent_session_recording (attention_score DESC) WHERE attention_score > 0.7;

DROP TRIGGER IF EXISTS trg_asr_updated_at ON public.agent_session_recording;
CREATE TRIGGER trg_asr_updated_at
  BEFORE UPDATE ON public.agent_session_recording
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.agent_session_recording ENABLE ROW LEVEL SECURITY;

-- JWT read policy: workspace admins read their workspace
DROP POLICY IF EXISTS "jwt_admin_read_asr" ON public.agent_session_recording;
CREATE POLICY "jwt_admin_read_asr" ON public.agent_session_recording
  FOR SELECT
  USING (
    workspace_id IN (SELECT public.get_workspace_ids_for_user(auth.uid()))
    AND public.is_admin_in_workspace(auth.uid(), workspace_id)
  );

-- Platform admin (godmode) reads cross-workspace
DROP POLICY IF EXISTS "godmode_read_asr" ON public.agent_session_recording;
CREATE POLICY "godmode_read_asr" ON public.agent_session_recording
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.user_identity
      WHERE user_identity.user_id = auth.uid() AND user_identity.is_godmode = true
    )
  );

-- Service role writes (stage-engine only — no user-facing write path)
-- Default service-role bypass is sufficient. No explicit INSERT policy needed.

COMMENT ON TABLE public.agent_session_recording IS
  'ADR-0184: Per-turn agent session recording. Redact-on-write for PII. Tiered retention via cron.';
