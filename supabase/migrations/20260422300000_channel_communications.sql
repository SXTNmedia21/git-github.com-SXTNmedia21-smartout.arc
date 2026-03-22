-- Channel Communications System — Phase 1: Messaging
-- Enums, tables, indexes, constraints, triggers
-- Spec: docs/superpowers/specs/2026-03-22-channel-communications-design.md

--------------------------------------------------------------------------------
-- ENUMS (16 total, all guarded with IF NOT EXISTS)
--------------------------------------------------------------------------------

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'comm_channel_type') THEN
    CREATE TYPE comm_channel_type AS ENUM (
      'department', 'team', 'session', 'custom', 'direct', 'news', 'skill'
    );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'channel_message_type') THEN
    CREATE TYPE channel_message_type AS ENUM (
      'text', 'image', 'file', 'voice_clip', 'system', 'brief',
      'handoff', 'announcement', 'reminder', 'summary'
    );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'channel_origin_type') THEN
    CREATE TYPE channel_origin_type AS ENUM (
      'human', 'ai', 'system', 'webhook', 'scheduler', 'workflow'
    );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'channel_delivery_mode') THEN
    CREATE TYPE channel_delivery_mode AS ENUM (
      'timeline', 'silent', 'notification_only'
    );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'channel_message_visibility') THEN
    CREATE TYPE channel_message_visibility AS ENUM (
      'all_members', 'admins', 'targeted_members'
    );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'channel_audio_policy') THEN
    CREATE TYPE channel_audio_policy AS ENUM (
      'disabled', 'ptt', 'open_mic', 'listen_only'
    );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'channel_video_policy') THEN
    CREATE TYPE channel_video_policy AS ENUM (
      'disabled', 'optional', 'default_on', 'required'
    );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'channel_recording_policy') THEN
    CREATE TYPE channel_recording_policy AS ENUM (
      'off', 'optional', 'auto'
    );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'channel_ai_voice_policy') THEN
    CREATE TYPE channel_ai_voice_policy AS ENUM (
      'disabled', 'listen_only', 'interactive'
    );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'channel_member_role') THEN
    CREATE TYPE channel_member_role AS ENUM ('member', 'admin');
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'channel_call_status') THEN
    CREATE TYPE channel_call_status AS ENUM ('active', 'ending', 'ended');
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'channel_presence_status') THEN
    CREATE TYPE channel_presence_status AS ENUM ('online', 'away', 'offline');
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'channel_integration_status') THEN
    CREATE TYPE channel_integration_status AS ENUM ('active', 'paused', 'error');
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'channel_ai_text_mode') THEN
    CREATE TYPE channel_ai_text_mode AS ENUM ('disabled', 'mention_only', 'proactive');
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'channel_ai_voice_mode') THEN
    CREATE TYPE channel_ai_voice_mode AS ENUM ('disabled', 'listen_only', 'interactive');
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'channel_notification_priority') THEN
    CREATE TYPE channel_notification_priority AS ENUM ('critical', 'high', 'normal', 'low');
  END IF;
END $$;

--------------------------------------------------------------------------------
-- CORE TABLES: channel, channel_member, channel_message
--------------------------------------------------------------------------------

-- channel: persistent communication space tied to org structure
CREATE TABLE IF NOT EXISTS channel (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspace(workspace_id),
  channel_type comm_channel_type NOT NULL,
  name text,
  description text,
  avatar_url text,
  created_by uuid REFERENCES profile(profile_id),
  department_id uuid REFERENCES department(department_id),
  team_id uuid REFERENCES team(team_id),
  session_id uuid REFERENCES department_session(department_session_id),
  direct_pair_hash text,
  is_read_only boolean NOT NULL DEFAULT false,
  is_archived boolean NOT NULL DEFAULT false,
  read_receipts_enabled boolean NOT NULL DEFAULT false,
  audio_policy channel_audio_policy NOT NULL DEFAULT 'disabled',
  video_policy channel_video_policy NOT NULL DEFAULT 'disabled',
  recording_policy channel_recording_policy NOT NULL DEFAULT 'off',
  ai_voice_policy channel_ai_voice_policy NOT NULL DEFAULT 'disabled',
  allow_user_override boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE channel ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_channel_workspace ON channel(workspace_id);
CREATE INDEX idx_channel_department ON channel(department_id) WHERE department_id IS NOT NULL;
CREATE INDEX idx_channel_team ON channel(team_id) WHERE team_id IS NOT NULL;
CREATE INDEX idx_channel_session ON channel(session_id) WHERE session_id IS NOT NULL;

-- Uniqueness constraints for trigger safety
CREATE UNIQUE INDEX idx_channel_direct_pair
  ON channel(workspace_id, direct_pair_hash) WHERE direct_pair_hash IS NOT NULL;
CREATE UNIQUE INDEX idx_channel_one_per_department
  ON channel(department_id) WHERE department_id IS NOT NULL AND is_archived = false;
CREATE UNIQUE INDEX idx_channel_one_per_team
  ON channel(team_id) WHERE team_id IS NOT NULL AND is_archived = false;
CREATE UNIQUE INDEX idx_channel_one_per_session
  ON channel(session_id) WHERE session_id IS NOT NULL AND is_archived = false;

CREATE TRIGGER set_updated_at BEFORE UPDATE ON channel
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- channel_member: membership link between profiles and channels
CREATE TABLE IF NOT EXISTS channel_member (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id uuid NOT NULL REFERENCES channel(id) ON DELETE CASCADE,
  workspace_id uuid NOT NULL REFERENCES workspace(workspace_id),
  profile_id uuid NOT NULL REFERENCES profile(profile_id) ON DELETE RESTRICT,
  role channel_member_role NOT NULL DEFAULT 'member',
  is_ai boolean NOT NULL DEFAULT false,
  last_read_message_id uuid,  -- FK added after channel_message exists
  is_muted boolean NOT NULL DEFAULT false,
  muted_until timestamptz,
  joined_at timestamptz NOT NULL DEFAULT now(),
  left_at timestamptz,
  UNIQUE(channel_id, profile_id)
);

ALTER TABLE channel_member ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_channel_member_channel_active ON channel_member(channel_id) WHERE left_at IS NULL;
CREATE INDEX idx_channel_member_profile_active ON channel_member(profile_id) WHERE left_at IS NULL;
CREATE INDEX idx_channel_member_workspace ON channel_member(workspace_id);

-- channel_message: individual messages within a channel
CREATE TABLE IF NOT EXISTS channel_message (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id uuid NOT NULL REFERENCES channel(id) ON DELETE CASCADE,
  workspace_id uuid NOT NULL REFERENCES workspace(workspace_id),
  sender_id uuid NOT NULL REFERENCES profile(profile_id) ON DELETE RESTRICT,
  content text NOT NULL,
  message_type channel_message_type NOT NULL DEFAULT 'text',
  origin_type channel_origin_type NOT NULL DEFAULT 'human',
  origin_id text,
  delivery_mode channel_delivery_mode NOT NULL DEFAULT 'timeline',
  visibility_scope channel_message_visibility NOT NULL DEFAULT 'all_members',
  target_profile_ids uuid[],
  event_id uuid,  -- FK added after channel_event exists
  reply_to_id uuid REFERENCES channel_message(id) ON DELETE SET NULL,
  system_data jsonb,
  is_pinned boolean NOT NULL DEFAULT false,
  pinned_by uuid REFERENCES profile(profile_id),
  pinned_at timestamptz,
  edited_at timestamptz,
  deleted_at timestamptz,
  client_message_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE channel_message ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_channel_message_channel_created ON channel_message(channel_id, created_at DESC);
CREATE INDEX idx_channel_message_workspace ON channel_message(workspace_id);
CREATE INDEX idx_channel_message_reply_to ON channel_message(reply_to_id) WHERE reply_to_id IS NOT NULL;
CREATE UNIQUE INDEX idx_channel_message_client_id
  ON channel_message(channel_id, client_message_id) WHERE client_message_id IS NOT NULL;

CREATE TRIGGER set_updated_at BEFORE UPDATE ON channel_message
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Deferred FK: channel_member.last_read_message_id -> channel_message
ALTER TABLE channel_member
  ADD CONSTRAINT channel_member_last_read_fk
  FOREIGN KEY (last_read_message_id) REFERENCES channel_message(id) ON DELETE SET NULL;

-- Integrity trigger: last_read_message_id must reference a message in the same channel
CREATE OR REPLACE FUNCTION validate_last_read_same_channel()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.last_read_message_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM channel_message
      WHERE id = NEW.last_read_message_id
        AND channel_id = NEW.channel_id
    ) THEN
      RAISE EXCEPTION 'last_read_message_id must reference a message in the same channel';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_validate_last_read
  BEFORE INSERT OR UPDATE OF last_read_message_id ON channel_member
  FOR EACH ROW EXECUTE FUNCTION validate_last_read_same_channel();

--------------------------------------------------------------------------------
-- SUPPORTING TABLES: event, reaction, attachment, read, policy tables
--------------------------------------------------------------------------------

-- channel_event: immutable source-of-truth for machine/system/AI/external events
CREATE TABLE IF NOT EXISTS channel_event (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id uuid NOT NULL REFERENCES channel(id) ON DELETE CASCADE,
  workspace_id uuid NOT NULL REFERENCES workspace(workspace_id),
  event_type text NOT NULL,
  source text NOT NULL,
  source_id text,
  payload jsonb NOT NULL,
  correlation_id uuid,
  causation_id uuid,
  idempotency_key text,
  created_at timestamptz NOT NULL DEFAULT now()
  -- Immutable: no updated_at
);

ALTER TABLE channel_event ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_channel_event_channel ON channel_event(channel_id, created_at DESC);
CREATE INDEX idx_channel_event_workspace ON channel_event(workspace_id);
CREATE INDEX idx_channel_event_correlation ON channel_event(correlation_id) WHERE correlation_id IS NOT NULL;
CREATE UNIQUE INDEX idx_channel_event_idempotency ON channel_event(idempotency_key) WHERE idempotency_key IS NOT NULL;

-- Deferred FK: channel_message.event_id -> channel_event
ALTER TABLE channel_message
  ADD CONSTRAINT channel_message_event_fk
  FOREIGN KEY (event_id) REFERENCES channel_event(id) ON DELETE SET NULL;
CREATE INDEX idx_channel_message_event ON channel_message(event_id) WHERE event_id IS NOT NULL;

-- channel_message_reaction: emoji reactions on messages
-- Includes channel_id (denormalized) for Realtime filter and RLS
CREATE TABLE IF NOT EXISTS channel_message_reaction (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id uuid NOT NULL REFERENCES channel_message(id) ON DELETE CASCADE,
  channel_id uuid NOT NULL REFERENCES channel(id) ON DELETE CASCADE,
  workspace_id uuid NOT NULL REFERENCES workspace(workspace_id),
  profile_id uuid NOT NULL REFERENCES profile(profile_id) ON DELETE RESTRICT,
  emoji text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(message_id, profile_id, emoji)
);

ALTER TABLE channel_message_reaction ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_channel_reaction_message ON channel_message_reaction(message_id);
CREATE INDEX idx_channel_reaction_channel ON channel_message_reaction(channel_id);

-- channel_message_attachment: files attached to messages
-- Includes channel_id (denormalized) for Realtime filter and RLS
CREATE TABLE IF NOT EXISTS channel_message_attachment (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id uuid NOT NULL REFERENCES channel_message(id) ON DELETE CASCADE,
  channel_id uuid NOT NULL REFERENCES channel(id) ON DELETE CASCADE,
  workspace_id uuid NOT NULL REFERENCES workspace(workspace_id),
  file_type text NOT NULL,
  url text NOT NULL,
  filename text NOT NULL,
  size_bytes bigint NOT NULL,
  mime_type text,
  duration_seconds int,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE channel_message_attachment ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_channel_attachment_message ON channel_message_attachment(message_id);

-- channel_message_read: per-message read receipts (only when channel.read_receipts_enabled = true)
CREATE TABLE IF NOT EXISTS channel_message_read (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id uuid NOT NULL REFERENCES channel_message(id) ON DELETE CASCADE,
  workspace_id uuid NOT NULL REFERENCES workspace(workspace_id),
  profile_id uuid NOT NULL REFERENCES profile(profile_id) ON DELETE RESTRICT,
  read_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(message_id, profile_id)
);

ALTER TABLE channel_message_read ENABLE ROW LEVEL SECURITY;

--------------------------------------------------------------------------------
-- SUBSYSTEM 3: Policy tables (automation & events domain)
--------------------------------------------------------------------------------

-- channel_integration: external service connections per channel
CREATE TABLE IF NOT EXISTS channel_integration (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id uuid NOT NULL REFERENCES channel(id) ON DELETE CASCADE,
  workspace_id uuid NOT NULL REFERENCES workspace(workspace_id),
  provider_type text NOT NULL,
  display_name text NOT NULL,
  status channel_integration_status NOT NULL DEFAULT 'active',
  endpoint_url text,
  endpoint_secret_vault_id text,
  config jsonb NOT NULL DEFAULT '{}',
  enabled_events text[],
  created_by uuid NOT NULL REFERENCES profile(profile_id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE channel_integration ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER set_updated_at BEFORE UPDATE ON channel_integration
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- channel_notification_policy: per-channel notification routing rules
CREATE TABLE IF NOT EXISTS channel_notification_policy (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id uuid NOT NULL REFERENCES channel(id) ON DELETE CASCADE,
  workspace_id uuid NOT NULL REFERENCES workspace(workspace_id),
  event_type text NOT NULL,
  priority channel_notification_priority NOT NULL DEFAULT 'normal',
  delivery_channels text[] NOT NULL DEFAULT '{in_app}',
  respect_quiet_hours boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(channel_id, event_type)
);

ALTER TABLE channel_notification_policy ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER set_updated_at BEFORE UPDATE ON channel_notification_policy
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- channel_ai_policy: per-channel AI behavior configuration
CREATE TABLE IF NOT EXISTS channel_ai_policy (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id uuid NOT NULL REFERENCES channel(id) ON DELETE CASCADE,
  workspace_id uuid NOT NULL REFERENCES workspace(workspace_id),
  text_participation channel_ai_text_mode NOT NULL DEFAULT 'disabled',
  voice_participation channel_ai_voice_mode NOT NULL DEFAULT 'disabled',
  auto_summarize boolean NOT NULL DEFAULT false,
  auto_shift_prep boolean NOT NULL DEFAULT false,
  auto_reminders boolean NOT NULL DEFAULT false,
  personality_override jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(channel_id)
);

ALTER TABLE channel_ai_policy ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER set_updated_at BEFORE UPDATE ON channel_ai_policy
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- channel_retention_policy: lifecycle rules per channel
CREATE TABLE IF NOT EXISTS channel_retention_policy (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id uuid NOT NULL REFERENCES channel(id) ON DELETE CASCADE,
  workspace_id uuid NOT NULL REFERENCES workspace(workspace_id),
  auto_archive_on_close boolean NOT NULL DEFAULT true,
  archive_grace_period_hours int NOT NULL DEFAULT 1,
  generate_summary_on_close boolean NOT NULL DEFAULT true,
  pin_summary_on_close boolean NOT NULL DEFAULT true,
  retain_media_days int NOT NULL DEFAULT 90,
  retain_messages_days int NOT NULL DEFAULT 365,
  searchable_after_archive boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(channel_id)
);

ALTER TABLE channel_retention_policy ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER set_updated_at BEFORE UPDATE ON channel_retention_policy
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
