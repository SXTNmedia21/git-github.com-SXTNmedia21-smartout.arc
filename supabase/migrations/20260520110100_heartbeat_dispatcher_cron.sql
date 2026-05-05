-- ============================================
-- 20260520110100_heartbeat_dispatcher_cron.sql
-- Phase 0 (Crown) — register pg_cron job for heartbeat-dispatcher.
-- Skipped silently in environments without pg_cron (e.g. Supabase Local).
-- Local dev uses manual invocation per Task 6.
-- ============================================

DO $cmd$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.schedule(
      'heartbeat-dispatcher',
      '*/1 * * * *',
      $sql$SELECT net.http_post(
        url := current_setting('app.supabase_url', true) || '/functions/v1/heartbeat-dispatcher',
        headers := jsonb_build_object('Authorization', 'Bearer ' || current_setting('app.watchdog_cron_secret', true))
      )$sql$
    );
  ELSE
    RAISE NOTICE 'pg_cron not enabled — heartbeat-dispatcher must be invoked manually (curl from Task 6)';
  END IF;
END $cmd$;
