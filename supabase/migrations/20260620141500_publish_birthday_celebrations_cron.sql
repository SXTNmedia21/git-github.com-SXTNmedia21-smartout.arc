-- 20260620141500_publish_birthday_celebrations_cron.sql
--
-- WHY: Register hourly pg_cron job for birthday auto-publish pipe (ADR-0372 Q2).
--   Fires every hour (UTC). Edge Function filters to workspaces whose local time
--   is in [06:00, 07:00), ensuring "morning of birthday" delivery per workspace timezone.
--
-- AUTH PATTERN: Bearer auth via app.watchdog_cron_secret — identical to
--   note-fanout-scheduler (20260616100601_note_fanout_scheduler_cron.sql).
--
-- LOCAL DEV PARITY: pg_cron is NOT available in Supabase local (supabase start).
--   The DO $cmd$ BEGIN IF EXISTS guard makes this a no-op on local, preserving
--   `db reset` idempotency. Developer can manually trigger:
--     curl -X POST $SUPABASE_URL/functions/v1/publish-birthday-celebrations \
--       -H "Authorization: Bearer $WATCHDOG_CRON_SECRET"
--
-- IDEMPOTENCY: cron.schedule upserts by job name — safe under branch DB replay.
-- TIMEOUT: 30 000 ms (30 s) — matches note-fanout-scheduler class.
--
-- ADR-0372 Q2, ADR-0048 (pg_cron + Edge Functions canonical scheduled-work mechanism).

DO $cmd$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.schedule(
      'publish-birthday-celebrations',
      '0 * * * *',
      $sql$SELECT net.http_post(
        url     := current_setting('app.supabase_url', true) || '/functions/v1/publish-birthday-celebrations',
        headers := jsonb_build_object(
          'Content-Type',  'application/json',
          'Authorization', 'Bearer ' || current_setting('app.watchdog_cron_secret', true)
        ),
        body              := '{}'::jsonb,
        timeout_milliseconds := 30000
      )$sql$
    );
  END IF;
END $cmd$;
