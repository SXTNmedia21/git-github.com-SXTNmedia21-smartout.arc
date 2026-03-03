-- ============================================
-- Chat Communications Portal
-- Module: communications
-- Design: docs/plans/2026-03-20-chat-communications-portal-design.md
-- Connected files:
--   apps/web/src/app/dashboard/chat/ (all components + hooks)
--   packages/supabase/src/database.types.ts (regenerate after)
-- ============================================

-- ── Enum ─────────────────────────────────────────────────────
CREATE TYPE public.chat_conversation_type AS ENUM ('group', 'dm', 'ai');

-- ── chat_conversation ────────────────────────────────────────
CREATE TABLE public.chat_conversation (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id       UUID NOT NULL REFERENCES public.workspace(workspace_id) ON DELETE CASCADE,
  type               public.chat_conversation_type NOT NULL,
  name               TEXT,
  description        TEXT,
  avatar_url         TEXT,
  created_by         UUID NOT NULL REFERENCES public.profile(profile_id) ON DELETE CASCADE,
  is_archived        BOOLEAN NOT NULL DEFAULT false,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.chat_conversation IS 'Chat conversations: group channels, DMs, and AI assistant chats. Module: communications.';
COMMENT ON COLUMN public.chat_conversation.type IS 'group = team/dept channel, dm = 1:1, ai = AI assistant chat';
COMMENT ON COLUMN public.chat_conversation.name IS 'Display name. NULL for DM (derive from participants).';

-- ── chat_participant ─────────────────────────────────────────
CREATE TABLE public.chat_participant (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id    UUID NOT NULL REFERENCES public.chat_conversation(id) ON DELETE CASCADE,
  profile_id         UUID NOT NULL REFERENCES public.profile(profile_id) ON DELETE CASCADE,
  role               TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('member', 'admin')),
  last_read_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  is_muted           BOOLEAN NOT NULL DEFAULT false,
  joined_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  left_at            TIMESTAMPTZ,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (conversation_id, profile_id)
);

COMMENT ON TABLE public.chat_participant IS 'Links profiles to conversations. left_at != NULL means inactive. Module: communications.';
COMMENT ON COLUMN public.chat_participant.last_read_at IS 'Timestamp of last read — used for unread badge calculation.';

-- ── chat_message ─────────────────────────────────────────────
CREATE TABLE public.chat_message (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id    UUID NOT NULL REFERENCES public.chat_conversation(id) ON DELETE CASCADE,
  sender_id          UUID NOT NULL REFERENCES public.profile(profile_id) ON DELETE CASCADE,
  content            TEXT NOT NULL,
  reply_to_id        UUID REFERENCES public.chat_message(id) ON DELETE SET NULL,
  reactions          JSONB NOT NULL DEFAULT '{}',
  attachments        JSONB NOT NULL DEFAULT '[]',
  is_system          BOOLEAN NOT NULL DEFAULT false,
  edited_at          TIMESTAMPTZ,
  deleted_at         TIMESTAMPTZ,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.chat_message IS 'All chat messages with reactions, replies, and soft-delete. Module: communications.';
COMMENT ON COLUMN public.chat_message.reactions IS 'JSONB: {"emoji": ["profile_id_1", "profile_id_2"]}';
COMMENT ON COLUMN public.chat_message.reply_to_id IS 'Self-FK for threaded replies / quote-reply.';

-- ── RLS: chat_conversation ───────────────────────────────────
ALTER TABLE public.chat_conversation ENABLE ROW LEVEL SECURITY;

-- JWT: read if you are a participant
CREATE POLICY "jwt_read_chat_conversation"
  ON public.chat_conversation FOR SELECT
  USING (
    id IN (
      SELECT cp.conversation_id FROM public.chat_participant cp
      WHERE cp.profile_id IN (SELECT p.profile_id FROM public.profile p WHERE p.user_id = auth.uid())
      AND cp.left_at IS NULL
    )
  );

-- JWT: insert if workspace member
CREATE POLICY "jwt_insert_chat_conversation"
  ON public.chat_conversation FOR INSERT
  WITH CHECK (
    workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid()))
  );

-- JWT: update if conversation admin
CREATE POLICY "jwt_update_chat_conversation"
  ON public.chat_conversation FOR UPDATE
  USING (
    id IN (
      SELECT cp.conversation_id FROM public.chat_participant cp
      WHERE cp.profile_id IN (SELECT p.profile_id FROM public.profile p WHERE p.user_id = auth.uid())
      AND cp.role = 'admin'
      AND cp.left_at IS NULL
    )
  );

-- API key: read
CREATE POLICY "api_key_read_chat_conversation"
  ON public.chat_conversation FOR SELECT
  USING (workspace_id = get_api_workspace_id());

-- ── RLS: chat_participant ────────────────────────────────────
ALTER TABLE public.chat_participant ENABLE ROW LEVEL SECURITY;

-- JWT: read if you are in the same conversation
CREATE POLICY "jwt_read_chat_participant"
  ON public.chat_participant FOR SELECT
  USING (
    conversation_id IN (
      SELECT cp2.conversation_id FROM public.chat_participant cp2
      WHERE cp2.profile_id IN (SELECT p.profile_id FROM public.profile p WHERE p.user_id = auth.uid())
      AND cp2.left_at IS NULL
    )
  );

-- JWT: insert (add participants) if conversation admin or conversation creator
CREATE POLICY "jwt_insert_chat_participant"
  ON public.chat_participant FOR INSERT
  WITH CHECK (
    conversation_id IN (
      SELECT cp.conversation_id FROM public.chat_participant cp
      WHERE cp.profile_id IN (SELECT p.profile_id FROM public.profile p WHERE p.user_id = auth.uid())
      AND cp.role = 'admin'
      AND cp.left_at IS NULL
    )
    OR conversation_id IN (
      SELECT cc.id FROM public.chat_conversation cc
      WHERE cc.created_by IN (SELECT p.profile_id FROM public.profile p WHERE p.user_id = auth.uid())
    )
  );

-- JWT: update own participant record (mute, last_read_at)
CREATE POLICY "jwt_update_chat_participant"
  ON public.chat_participant FOR UPDATE
  USING (
    profile_id IN (SELECT p.profile_id FROM public.profile p WHERE p.user_id = auth.uid())
  );

-- API key: read
CREATE POLICY "api_key_read_chat_participant"
  ON public.chat_participant FOR SELECT
  USING (
    conversation_id IN (
      SELECT cc.id FROM public.chat_conversation cc
      WHERE cc.workspace_id = get_api_workspace_id()
    )
  );

-- ── RLS: chat_message ────────────────────────────────────────
ALTER TABLE public.chat_message ENABLE ROW LEVEL SECURITY;

-- JWT: read if participant in conversation
CREATE POLICY "jwt_read_chat_message"
  ON public.chat_message FOR SELECT
  USING (
    conversation_id IN (
      SELECT cp.conversation_id FROM public.chat_participant cp
      WHERE cp.profile_id IN (SELECT p.profile_id FROM public.profile p WHERE p.user_id = auth.uid())
      AND cp.left_at IS NULL
    )
  );

-- JWT: insert if participant and sender is self
CREATE POLICY "jwt_insert_chat_message"
  ON public.chat_message FOR INSERT
  WITH CHECK (
    conversation_id IN (
      SELECT cp.conversation_id FROM public.chat_participant cp
      WHERE cp.profile_id IN (SELECT p.profile_id FROM public.profile p WHERE p.user_id = auth.uid())
      AND cp.left_at IS NULL
    )
    AND sender_id IN (SELECT p.profile_id FROM public.profile p WHERE p.user_id = auth.uid())
  );

-- JWT: update own messages (edit, soft-delete)
CREATE POLICY "jwt_update_chat_message"
  ON public.chat_message FOR UPDATE
  USING (
    sender_id IN (SELECT p.profile_id FROM public.profile p WHERE p.user_id = auth.uid())
  );

-- API key: read
CREATE POLICY "api_key_read_chat_message"
  ON public.chat_message FOR SELECT
  USING (
    conversation_id IN (
      SELECT cc.id FROM public.chat_conversation cc
      WHERE cc.workspace_id = get_api_workspace_id()
    )
  );

-- ── Indexes ──────────────────────────────────────────────────
CREATE INDEX idx_chat_conversation_workspace
  ON public.chat_conversation (workspace_id);

CREATE INDEX idx_chat_participant_conversation
  ON public.chat_participant (conversation_id)
  WHERE left_at IS NULL;

CREATE INDEX idx_chat_participant_profile
  ON public.chat_participant (profile_id)
  WHERE left_at IS NULL;

CREATE INDEX idx_chat_message_conversation_created
  ON public.chat_message (conversation_id, created_at DESC);

CREATE INDEX idx_chat_message_reply_to
  ON public.chat_message (reply_to_id)
  WHERE reply_to_id IS NOT NULL;

-- ── Triggers ─────────────────────────────────────────────────
CREATE TRIGGER set_chat_conversation_updated_at
  BEFORE UPDATE ON public.chat_conversation
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER set_chat_participant_updated_at
  BEFORE UPDATE ON public.chat_participant
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER set_chat_message_updated_at
  BEFORE UPDATE ON public.chat_message
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ── Enable Realtime ──────────────────────────────────────────
ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_message;
ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_participant;
