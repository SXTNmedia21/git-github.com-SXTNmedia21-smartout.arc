-- Channel Voice — Phase 2: call session, participants, presence, call log
-- Spec: docs/superpowers/specs/2026-03-22-livekit-phase2-design.md

--------------------------------------------------------------------------------
-- NEW ENUM
--------------------------------------------------------------------------------

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'channel_call_type') THEN
    CREATE TYPE channel_call_type AS ENUM ('direct', 'group', 'ptt');
  END IF;
END $$;

--------------------------------------------------------------------------------
-- TABLES
--------------------------------------------------------------------------------

-- Coarse presence snapshot (NOT authoritative — Supabase Realtime Presence is)
CREATE TABLE IF NOT EXISTS channel_presence (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id uuid NOT NULL REFERENCES channel(id) ON DELETE CASCADE,
  workspace_id uuid NOT NULL REFERENCES workspace(workspace_id),
  profile_id uuid NOT NULL REFERENCES profile(profile_id) ON DELETE RESTRICT,
  status channel_presence_status NOT NULL,
  device_type text,
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(channel_id, profile_id)
);

CREATE TRIGGER set_updated_at BEFORE UPDATE ON channel_presence
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE INDEX idx_channel_presence_workspace ON channel_presence(workspace_id);
CREATE INDEX idx_channel_presence_channel ON channel_presence(channel_id);

-- Active call session per channel
CREATE TABLE IF NOT EXISTS channel_call_session (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id uuid NOT NULL REFERENCES channel(id) ON DELETE CASCADE,
  workspace_id uuid NOT NULL REFERENCES workspace(workspace_id),
  call_type channel_call_type NOT NULL,
  livekit_room_name text NOT NULL,
  status channel_call_status NOT NULL DEFAULT 'active',
  audio_policy channel_audio_policy NOT NULL,
  video_policy channel_video_policy NOT NULL DEFAULT 'disabled',
  recording_policy channel_recording_policy NOT NULL DEFAULT 'off',
  started_by uuid REFERENCES profile(profile_id),
  max_participants int NOT NULL DEFAULT 0,
  started_at timestamptz NOT NULL DEFAULT now(),
  ended_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER set_updated_at BEFORE UPDATE ON channel_call_session
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE INDEX idx_call_session_workspace ON channel_call_session(workspace_id);
CREATE INDEX idx_call_session_channel ON channel_call_session(channel_id);
CREATE INDEX idx_call_session_active ON channel_call_session(channel_id)
  WHERE status = 'active';

-- Per-participant state in a call
CREATE TABLE IF NOT EXISTS channel_call_participant (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  call_session_id uuid NOT NULL REFERENCES channel_call_session(id) ON DELETE CASCADE,
  workspace_id uuid NOT NULL REFERENCES workspace(workspace_id),
  profile_id uuid NOT NULL REFERENCES profile(profile_id) ON DELETE RESTRICT,
  is_ai boolean NOT NULL DEFAULT false,
  joined_at timestamptz NOT NULL DEFAULT now(),
  left_at timestamptz,
  mic_enabled boolean NOT NULL DEFAULT false,
  speaking_seconds int NOT NULL DEFAULT 0,
  device_type text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER set_updated_at BEFORE UPDATE ON channel_call_participant
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE UNIQUE INDEX idx_call_participant_active
  ON channel_call_participant(call_session_id, profile_id)
  WHERE left_at IS NULL;

CREATE INDEX idx_call_participant_workspace ON channel_call_participant(workspace_id);
CREATE INDEX idx_call_participant_session ON channel_call_participant(call_session_id);
CREATE INDEX idx_call_participant_profile ON channel_call_participant(profile_id, created_at DESC);

-- Historical call log (immutable, created on call end)
CREATE TABLE IF NOT EXISTS call_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id uuid NOT NULL REFERENCES channel(id) ON DELETE CASCADE,
  workspace_id uuid NOT NULL REFERENCES workspace(workspace_id),
  call_session_id uuid NOT NULL REFERENCES channel_call_session(id),
  livekit_room_name text NOT NULL,
  started_at timestamptz NOT NULL,
  ended_at timestamptz NOT NULL,
  duration_seconds int NOT NULL,
  max_participants int NOT NULL,
  total_participants int NOT NULL,
  participant_summary jsonb NOT NULL DEFAULT '[]',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_call_log_workspace ON call_log(workspace_id);
CREATE INDEX idx_call_log_channel ON call_log(channel_id, created_at DESC);

--------------------------------------------------------------------------------
-- RLS
--------------------------------------------------------------------------------

ALTER TABLE channel_presence ENABLE ROW LEVEL SECURITY;
ALTER TABLE channel_call_session ENABLE ROW LEVEL SECURITY;
ALTER TABLE channel_call_participant ENABLE ROW LEVEL SECURITY;
ALTER TABLE call_log ENABLE ROW LEVEL SECURITY;

-- channel_presence
CREATE POLICY "presence_jwt_select" ON channel_presence FOR SELECT USING (
  workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid()))
);
CREATE POLICY "presence_jwt_upsert" ON channel_presence FOR INSERT WITH CHECK (
  profile_id IN (SELECT profile_id FROM profile WHERE user_id = auth.uid())
);
CREATE POLICY "presence_jwt_update" ON channel_presence FOR UPDATE USING (
  profile_id IN (SELECT profile_id FROM profile WHERE user_id = auth.uid())
);
CREATE POLICY "presence_api_select" ON channel_presence FOR SELECT
  USING (workspace_id = get_api_workspace_id());

-- channel_call_session
CREATE POLICY "call_session_jwt_select" ON channel_call_session FOR SELECT USING (
  workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid()))
);
CREATE POLICY "call_session_jwt_insert" ON channel_call_session FOR INSERT WITH CHECK (
  workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid()))
);
CREATE POLICY "call_session_jwt_update" ON channel_call_session FOR UPDATE USING (
  workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid()))
);
CREATE POLICY "call_session_api_select" ON channel_call_session FOR SELECT
  USING (workspace_id = get_api_workspace_id());

-- channel_call_participant
CREATE POLICY "call_participant_jwt_select" ON channel_call_participant FOR SELECT USING (
  workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid()))
);
CREATE POLICY "call_participant_jwt_insert" ON channel_call_participant FOR INSERT WITH CHECK (
  profile_id IN (SELECT profile_id FROM profile WHERE user_id = auth.uid())
);
CREATE POLICY "call_participant_jwt_update" ON channel_call_participant FOR UPDATE USING (
  profile_id IN (SELECT profile_id FROM profile WHERE user_id = auth.uid())
);
CREATE POLICY "call_participant_api_select" ON channel_call_participant FOR SELECT
  USING (workspace_id = get_api_workspace_id());

-- call_log
CREATE POLICY "call_log_jwt_select" ON call_log FOR SELECT USING (
  workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid()))
);
CREATE POLICY "call_log_api_select" ON call_log FOR SELECT
  USING (workspace_id = get_api_workspace_id());

--------------------------------------------------------------------------------
-- REALTIME
--------------------------------------------------------------------------------

ALTER PUBLICATION supabase_realtime ADD TABLE channel_call_session;
ALTER PUBLICATION supabase_realtime ADD TABLE channel_call_participant;
