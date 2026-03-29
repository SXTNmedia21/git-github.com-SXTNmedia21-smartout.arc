-- Telegram WalkAi Adapter — admin command & control bot
-- Adds 'telegram' channel, chat bridge state, poll action mapping, callback action lookup

-- 1. Expand engine_sessions channel constraint to include 'telegram'
ALTER TABLE engine_sessions DROP CONSTRAINT engine_sessions_channel_check;
ALTER TABLE engine_sessions ADD CONSTRAINT engine_sessions_channel_check
  CHECK (channel IN ('voice', 'sms', 'chat', 'email', 'autonomous', 'telegram'));

-- 2. Chat bridge state — tracks active Telegram↔Smartout chat bridges
CREATE TABLE telegram_chat_bridge (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id       UUID NOT NULL REFERENCES engine_sessions(id),
  channel_id       UUID NOT NULL REFERENCES channel(id),
  telegram_chat_id BIGINT NOT NULL,
  status           TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'closed')),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  closed_at        TIMESTAMPTZ
);

-- Deny-all RLS (service_role only — platform admin infrastructure)
ALTER TABLE telegram_chat_bridge ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER set_updated_at_telegram_chat_bridge
  BEFORE UPDATE ON telegram_chat_bridge
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- 3. Poll action mapping — stores poll option→action mappings until answered
CREATE TABLE telegram_poll_action (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  telegram_poll_id TEXT NOT NULL UNIQUE,
  session_id       UUID NOT NULL REFERENCES engine_sessions(id),
  options          JSONB NOT NULL,
  resolved         BOOLEAN NOT NULL DEFAULT false,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at      TIMESTAMPTZ
);

ALTER TABLE telegram_poll_action ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER set_updated_at_telegram_poll_action
  BEFORE UPDATE ON telegram_poll_action
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- 4. Callback action lookup — stores inline button actions (64-byte callback_data limit)
CREATE TABLE telegram_callback_action (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  action_type      TEXT NOT NULL,
  action_payload   JSONB NOT NULL,
  session_id       UUID NOT NULL REFERENCES engine_sessions(id),
  resolved         BOOLEAN NOT NULL DEFAULT false,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at      TIMESTAMPTZ
);

ALTER TABLE telegram_callback_action ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER set_updated_at_telegram_callback_action
  BEFORE UPDATE ON telegram_callback_action
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- 5. Bridge relay trigger — PG NOTIFY on new channel_message for active bridges.
-- Uses sender_id (the actual column name on channel_message) and passes
-- system_data so the receiver can detect and skip admin relay echo messages.
CREATE OR REPLACE FUNCTION notify_telegram_bridge()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM pg_notify('telegram_bridge', json_build_object(
    'channel_id', NEW.channel_id,
    'sender_id', NEW.sender_id,
    'origin_type', NEW.origin_type,
    'system_data', NEW.system_data,
    'content', NEW.content,
    'id', NEW.id
  )::text);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_notify_telegram_bridge
  AFTER INSERT ON channel_message
  FOR EACH ROW EXECUTE FUNCTION notify_telegram_bridge();
