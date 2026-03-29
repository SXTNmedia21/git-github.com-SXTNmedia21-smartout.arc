-- Auto-dispatch for notification outbox rows.
--
-- pg_cron is not available in Supabase Local, so the 30-second poll of
-- process-notifications never fires. This trigger uses pg_net to call the
-- Edge Function on EVERY outbox INSERT, replacing the cron dependency.
-- The existing critical-only trigger (trg_critical_notification_dispatch) is
-- kept but this one covers all priorities.

CREATE OR REPLACE FUNCTION dispatch_outbox_notification()
RETURNS trigger AS $$
BEGIN
  PERFORM net.http_post(
    url := concat(
      coalesce(
        current_setting('app.supabase_url', true),
        'http://host.docker.internal:54321'
      ),
      '/functions/v1/process-notifications'
    ),
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', concat(
        'Bearer ',
        coalesce(current_setting('app.process_notifications_secret', true), '')
      )
    ),
    body := '{}'::jsonb
  );
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Never block the INSERT if the EF call fails
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Fire on every INSERT (not just critical)
CREATE TRIGGER trg_outbox_auto_dispatch
  AFTER INSERT ON notification_outbox
  FOR EACH ROW
  EXECUTE FUNCTION dispatch_outbox_notification();

COMMENT ON TRIGGER trg_outbox_auto_dispatch ON notification_outbox IS
  'Calls process-notifications EF on every outbox INSERT. Replaces pg_cron dependency for local dev and low-traffic production.';
