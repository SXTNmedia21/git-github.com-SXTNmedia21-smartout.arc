-- Multi-channel support for platform admin communications
-- Extends platform_communication_log to track email, sms, push, in_app, and channel messages

-- 1. Add channel column to platform_communication_log
ALTER TABLE platform_communication_log
  ADD COLUMN IF NOT EXISTS channel TEXT NOT NULL DEFAULT 'email',
  ADD COLUMN IF NOT EXISTS campaign_id UUID,
  ADD COLUMN IF NOT EXISTS scheduled_for TIMESTAMPTZ;

COMMENT ON COLUMN platform_communication_log.channel IS 'Delivery channel: email | sms | push | in_app | channel_message';
COMMENT ON COLUMN platform_communication_log.campaign_id IS 'Groups multi-channel sends into a single campaign';
COMMENT ON COLUMN platform_communication_log.scheduled_for IS 'NULL = immediate, otherwise deferred until this time';

-- 2. Per-channel delivery tracking for multi-channel sends
CREATE TABLE IF NOT EXISTS platform_communication_channel_result (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  communication_id UUID NOT NULL REFERENCES platform_communication_log(communication_id) ON DELETE CASCADE,
  channel TEXT NOT NULL,
  recipient_count INT NOT NULL DEFAULT 0,
  sent_count INT NOT NULL DEFAULT 0,
  failed_count INT NOT NULL DEFAULT 0,
  provider TEXT,
  provider_batch_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE platform_communication_channel_result IS 'Per-channel delivery results for multi-channel platform communications';

-- 3. Indexes
CREATE INDEX IF NOT EXISTS idx_comm_log_campaign
  ON platform_communication_log(campaign_id)
  WHERE campaign_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_comm_log_channel
  ON platform_communication_log(channel);

CREATE INDEX IF NOT EXISTS idx_comm_log_scheduled
  ON platform_communication_log(scheduled_for)
  WHERE scheduled_for IS NOT NULL AND status = 'queued';

CREATE INDEX IF NOT EXISTS idx_comm_channel_result_comm_id
  ON platform_communication_channel_result(communication_id);

-- 4. RLS (platform admin tables - service role only, no RLS needed but add policy for consistency)
ALTER TABLE platform_communication_channel_result ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access on channel results"
  ON platform_communication_channel_result
  FOR ALL
  USING (true)
  WITH CHECK (true);
