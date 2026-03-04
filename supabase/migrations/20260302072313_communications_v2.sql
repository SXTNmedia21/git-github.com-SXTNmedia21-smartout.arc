SET search_path TO public, extensions;

-- ═══════════════════════════════════════════════════════════════
-- Migration: Communications v2 — Template Data + Engagement Tracking + Webhook Events
-- Module 17 — Super Admin Backoffice
-- Adds SendGrid template support, open/click tracking, and webhook event audit trail
-- ═══════════════════════════════════════════════════════════════

-- 1. Add SendGrid template columns to platform_communication_log
ALTER TABLE platform_communication_log
  ADD COLUMN IF NOT EXISTS sendgrid_template_id text,
  ADD COLUMN IF NOT EXISTS template_data jsonb,
  ADD COLUMN IF NOT EXISTS opened_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS clicked_count integer NOT NULL DEFAULT 0;

COMMENT ON COLUMN platform_communication_log.sendgrid_template_id IS 'SendGrid dynamic template ID (d-xxxx)';
COMMENT ON COLUMN platform_communication_log.template_data IS 'Handlebars variables sent to SendGrid template';
COMMENT ON COLUMN platform_communication_log.opened_count IS 'Aggregated open count from webhook events';
COMMENT ON COLUMN platform_communication_log.clicked_count IS 'Aggregated click count from webhook events';

-- 2. Add engagement tracking to platform_communication_recipient
ALTER TABLE platform_communication_recipient
  ADD COLUMN IF NOT EXISTS opened_at timestamptz,
  ADD COLUMN IF NOT EXISTS clicked_at timestamptz,
  ADD COLUMN IF NOT EXISTS open_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS click_count integer NOT NULL DEFAULT 0;

-- 3. Webhook event log for audit trail
CREATE TABLE IF NOT EXISTS platform_webhook_event (
  event_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider text NOT NULL DEFAULT 'sendgrid',
  event_type text NOT NULL,
  email text NOT NULL,
  communication_id uuid REFERENCES platform_communication_log(communication_id) ON DELETE SET NULL,
  recipient_id uuid REFERENCES platform_communication_recipient(recipient_id) ON DELETE SET NULL,
  raw_payload jsonb NOT NULL,
  processed_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_webhook_event_communication
  ON platform_webhook_event(communication_id);
CREATE INDEX IF NOT EXISTS idx_webhook_event_email
  ON platform_webhook_event(email);
CREATE INDEX IF NOT EXISTS idx_webhook_event_type
  ON platform_webhook_event(event_type);

COMMENT ON TABLE platform_webhook_event IS 'Inbound webhook events from SendGrid (opens, clicks, bounces, unsubscribes)';

-- 4. Atomic counter increment function (used by webhook receiver)
CREATE OR REPLACE FUNCTION increment_communication_counter(
  p_communication_id uuid,
  p_field text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF p_field = 'opened_count' THEN
    UPDATE platform_communication_log
    SET opened_count = opened_count + 1, updated_at = now()
    WHERE communication_id = p_communication_id;
  ELSIF p_field = 'clicked_count' THEN
    UPDATE platform_communication_log
    SET clicked_count = clicked_count + 1, updated_at = now()
    WHERE communication_id = p_communication_id;
  END IF;
END;
$$;
