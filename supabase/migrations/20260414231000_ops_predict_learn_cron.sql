-- ============================================
-- 20260414231000_ops_predict_learn_cron.sql
-- Registers pg_cron jobs for weekly PREDICT and LEARN Edge Functions.
-- ADR-0088: AI Operations Intelligence Phase 3.
--
-- Schedule:
--   ops-predict: Sunday 22:00 UTC (Monday 00:00 Oslo)
--   ops-learn:   Monday 01:00 UTC (Monday 03:00 Oslo)
--
-- LEARN runs 3 hours after PREDICT so that fresh predictions
-- exist before pattern extraction runs.
-- ============================================

-- ops-predict: weekly prediction analysis
DO $cmd$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.schedule(
      'ops-predict',
      '0 22 * * 0',
      $sql$SELECT net.http_post(
        url := current_setting('app.supabase_url', true) || '/functions/v1/ops-predict',
        headers := jsonb_build_object('Authorization', 'Bearer ' || current_setting('app.watchdog_cron_secret', true))
      )$sql$
    );
  END IF;
END $cmd$;

-- ops-learn: weekly pattern extraction + retention cleanup
DO $cmd$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.schedule(
      'ops-learn',
      '0 1 * * 1',
      $sql$SELECT net.http_post(
        url := current_setting('app.supabase_url', true) || '/functions/v1/ops-learn',
        headers := jsonb_build_object('Authorization', 'Bearer ' || current_setting('app.watchdog_cron_secret', true))
      )$sql$
    );
  END IF;
END $cmd$;
