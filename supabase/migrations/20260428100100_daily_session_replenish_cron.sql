-- ============================================
-- 20260428100100_daily_session_replenish_cron.sql
-- Registers pg_cron job for daily session replenishment (02:00 UTC).
-- Fills the 7-day planning window for all workspaces with active seasons.
-- ============================================

DO $cmd$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.schedule(
      'daily-session-replenish',
      '0 2 * * *',
      $sql$SELECT net.http_post(
        url := current_setting('app.supabase_url', true) || '/functions/v1/daily-session-replenish',
        headers := jsonb_build_object('Authorization', 'Bearer ' || current_setting('app.watchdog_cron_secret', true))
      )$sql$
    );
  END IF;
END $cmd$;
