-- Multi-channel template support
-- Extends platform_email_template to support email, sms, push, and in_app channels

-- Channel discriminator
ALTER TABLE platform_email_template
  ADD COLUMN IF NOT EXISTS channel TEXT NOT NULL DEFAULT 'email';

-- SMS-specific fields
ALTER TABLE platform_email_template
  ADD COLUMN IF NOT EXISTS sms_body TEXT;

-- Push notification fields
ALTER TABLE platform_email_template
  ADD COLUMN IF NOT EXISTS push_title TEXT,
  ADD COLUMN IF NOT EXISTS push_body TEXT,
  ADD COLUMN IF NOT EXISTS push_action_url TEXT;

-- In-app notification fields
ALTER TABLE platform_email_template
  ADD COLUMN IF NOT EXISTS in_app_title TEXT,
  ADD COLUMN IF NOT EXISTS in_app_body TEXT,
  ADD COLUMN IF NOT EXISTS in_app_action_url TEXT,
  ADD COLUMN IF NOT EXISTS in_app_mode TEXT DEFAULT 'work',
  ADD COLUMN IF NOT EXISTS in_app_priority INT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS in_app_icon_type TEXT DEFAULT 'info';

COMMENT ON COLUMN platform_email_template.channel IS 'Channel: email | sms | push | in_app';

CREATE INDEX IF NOT EXISTS idx_template_channel ON platform_email_template(channel);
