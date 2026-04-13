-- ============================================
-- 20260414230100_ops_day_brief_cron.sql
-- Registers pg_cron job for daily Day Brief compilation (05:00 UTC / 07:00 Oslo).
-- ADR-0088: AI Operations Intelligence Phase 1.
-- ============================================

DO $cmd$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.schedule(
      'ops-day-brief',
      '0 5 * * *',
      $sql$SELECT net.http_post(
        url := current_setting('app.supabase_url', true) || '/functions/v1/ops-day-brief',
        headers := jsonb_build_object('Authorization', 'Bearer ' || current_setting('app.watchdog_cron_secret', true))
      )$sql$
    );
  END IF;
END $cmd$;
