-- Emma Conversations — voice session transcripts for history view
-- Each row = one Ultravox session with its transcript entries

CREATE TABLE IF NOT EXISTS emma_conversation (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspace(workspace_id) ON DELETE CASCADE,
  profile_id uuid NOT NULL REFERENCES profile(profile_id) ON DELETE CASCADE,
  started_at timestamptz NOT NULL DEFAULT now(),
  ended_at timestamptz,
  summary text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Individual transcript entries within a conversation
CREATE TABLE IF NOT EXISTS emma_transcript (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES emma_conversation(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('user', 'agent', 'tool')),
  content text NOT NULL DEFAULT '',
  tool_name text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- RLS
ALTER TABLE emma_conversation ENABLE ROW LEVEL SECURITY;
ALTER TABLE emma_transcript ENABLE ROW LEVEL SECURITY;

CREATE POLICY "emma_conversation_select_own" ON emma_conversation
  FOR SELECT USING (
    workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid()))
  );

CREATE POLICY "emma_conversation_insert_own" ON emma_conversation
  FOR INSERT WITH CHECK (
    workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid()))
    AND profile_id = (SELECT profile_id FROM profile WHERE user_id = auth.uid() AND workspace_id = emma_conversation.workspace_id LIMIT 1)
  );

CREATE POLICY "emma_conversation_update_own" ON emma_conversation
  FOR UPDATE USING (
    profile_id = (SELECT profile_id FROM profile WHERE user_id = auth.uid() LIMIT 1)
  );

CREATE POLICY "emma_transcript_select_via_conv" ON emma_transcript
  FOR SELECT USING (
    conversation_id IN (
      SELECT id FROM emma_conversation
      WHERE workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid()))
    )
  );

CREATE POLICY "emma_transcript_insert_via_conv" ON emma_transcript
  FOR INSERT WITH CHECK (
    conversation_id IN (
      SELECT id FROM emma_conversation
      WHERE workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid()))
    )
  );

-- Indexes
CREATE INDEX idx_emma_conversation_profile
  ON emma_conversation (profile_id, started_at DESC);

CREATE INDEX idx_emma_transcript_conversation
  ON emma_transcript (conversation_id, created_at ASC);
