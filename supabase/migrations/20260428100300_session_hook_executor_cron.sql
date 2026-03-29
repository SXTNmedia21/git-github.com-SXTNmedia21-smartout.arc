-- ============================================
-- 20260428100300_session_hook_executor_cron.sql
-- pg_cron job for session hook execution (every 5 min).
-- Materializes procedure steps into session_task records
-- when hooks fire based on session timing.
-- ============================================

DO $cmd$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.schedule(
      'session-hook-executor',
      '*/5 * * * *',
      $sql$SELECT net.http_post(
        url := current_setting('app.supabase_url', true) || '/functions/v1/session-hook-executor',
        headers := jsonb_build_object('Authorization', 'Bearer ' || current_setting('app.watchdog_cron_secret', true))
      )$sql$
    );
  END IF;
END $cmd$;
