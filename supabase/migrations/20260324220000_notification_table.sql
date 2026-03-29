-- Migration: notification_table
-- Adds in_app notification channel, fixes notification_preference RLS,
-- creates the notification table with Realtime support, and registers
-- pg_cron jobs for polling and morning digest delivery.

-- 1. Add 'in_app' to notification_channel enum
ALTER TYPE notification_channel ADD VALUE IF NOT EXISTS 'in_app';

-- 2. Fix notification_preference: enable RLS + add browser_enabled
ALTER TABLE notification_preference ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_preference ADD COLUMN IF NOT EXISTS browser_enabled boolean DEFAULT false;

CREATE POLICY "Users read own preferences" ON notification_preference
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Users update own preferences" ON notification_preference
  FOR UPDATE USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users insert own preferences" ON notification_preference
  FOR INSERT WITH CHECK (user_id = auth.uid());

-- 3. Create notification table
CREATE TABLE notification (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id  uuid NOT NULL REFERENCES workspace(workspace_id),
  recipient_id  uuid NOT NULL REFERENCES profile(profile_id),
  group_key     text,
  title         text NOT NULL,
  body          text,
  action_url    text,
  icon_type     text NOT NULL DEFAULT 'info',
  is_read       boolean NOT NULL DEFAULT false,
  read_at       timestamptz,
  metadata      jsonb,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER set_notification_updated_at
  BEFORE UPDATE ON notification
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE INDEX idx_notification_recipient_unread
  ON notification(recipient_id, created_at DESC)
  WHERE is_read = false;

CREATE INDEX idx_notification_group
  ON notification(recipient_id, group_key, created_at DESC)
  WHERE group_key IS NOT NULL;

ALTER TABLE notification ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own notifications" ON notification
  FOR SELECT USING (
    recipient_id IN (
      SELECT profile_id FROM profile
      WHERE workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid()))
    )
  );

CREATE POLICY "Users update own notifications" ON notification
  FOR UPDATE USING (
    recipient_id IN (
      SELECT profile_id FROM profile
      WHERE workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid()))
    )
  )
  WITH CHECK (
    recipient_id IN (
      SELECT profile_id FROM profile
      WHERE workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid()))
    )
  );

CREATE POLICY "api_key_read_notification" ON notification
  FOR SELECT USING (workspace_id = get_api_workspace_id());

-- 4. Enable Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE notification;

-- 5. CRITICAL fast-path trigger (priority=2 → immediate dispatch)
CREATE OR REPLACE FUNCTION dispatch_critical_notification()
RETURNS trigger AS $$
BEGIN
  PERFORM net.http_post(
    url := current_setting('app.supabase_url', true) || '/functions/v1/process-notifications',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || current_setting('app.process_notifications_secret', true)
    )
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_critical_notification_dispatch
  AFTER INSERT ON notification_outbox
  FOR EACH ROW WHEN (NEW.priority = 2)
  EXECUTE FUNCTION dispatch_critical_notification();

-- 6. pg_cron registration (30s polling)
-- Uses $cmd$ outer tag to allow $$ inside the cron command string
DO $cmd$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.schedule(
      'process-notifications',
      '30 seconds',
      $sql$SELECT net.http_post(
        url := current_setting('app.supabase_url', true) || '/functions/v1/process-notifications',
        headers := jsonb_build_object('Authorization', 'Bearer ' || current_setting('app.process_notifications_secret', true))
      )$sql$
    );
  END IF;
END $cmd$;

-- 7. Morning digest cron (07:00 Europe/Oslo)
DO $cmd$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.schedule(
      'morning-digest',
      '0 7 * * *',
      $sql$SELECT net.http_post(
        url := current_setting('app.supabase_url', true) || '/functions/v1/send-morning-digest',
        headers := jsonb_build_object('Authorization', 'Bearer ' || current_setting('app.morning_digest_secret', true))
      )$sql$
    );
  END IF;
END $cmd$;
