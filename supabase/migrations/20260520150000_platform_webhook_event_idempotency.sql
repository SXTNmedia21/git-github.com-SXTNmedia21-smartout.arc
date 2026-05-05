-- Add sg_message_id column and UNIQUE constraint to prevent SendGrid retry duplicates (CF-13-03)
ALTER TABLE platform_webhook_event
  ADD COLUMN IF NOT EXISTS sg_message_id text;

-- Partial unique index: only deduplicate rows where sg_message_id is present.
-- Non-SendGrid providers (or events without a message ID) are excluded.
CREATE UNIQUE INDEX IF NOT EXISTS platform_webhook_event_provider_sg_msg_id_key
  ON platform_webhook_event (provider, sg_message_id)
  WHERE sg_message_id IS NOT NULL;
