-- ============================================
-- 20260414240000_ops_monitor_cron.sql
-- Registers pg_cron job for periodic operations monitoring (every 15 min).
-- ADR-0088: AI Operations Intelligence Phase 2 — MONITOR function.
-- ============================================

DO $cmd$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.schedule(
      'ops-monitor',
      '*/15 * * * *',
      $sql$SELECT net.http_post(
        url := current_setting('app.supabase_url', true) || '/functions/v1/ops-monitor',
        headers := jsonb_build_object('Authorization', 'Bearer ' || current_setting('app.watchdog_cron_secret', true))
      )$sql$
    );
  END IF;
END $cmd$;
