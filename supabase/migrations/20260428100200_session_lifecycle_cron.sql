-- ============================================
-- 20260428100200_session_lifecycle_cron.sql
-- pg_cron job for session lifecycle auto-transitions (every 15 min).
-- Transitions: upcoming→active, active→pending_signoff, upcoming→missed.
-- ============================================

DO $cmd$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.schedule(
      'session-lifecycle',
      '*/15 * * * *',
      $sql$SELECT net.http_post(
        url := current_setting('app.supabase_url', true) || '/functions/v1/session-lifecycle',
        headers := jsonb_build_object('Authorization', 'Bearer ' || current_setting('app.watchdog_cron_secret', true))
      )$sql$
    );
  END IF;
END $cmd$;
