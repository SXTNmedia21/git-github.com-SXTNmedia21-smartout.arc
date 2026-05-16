-- ============================================================
-- 20260616100600_note_fanout_scheduler_cron.sql
-- Dagslinjen QuickAdd — pg_cron job for note fanout scheduler
--
-- PURPOSE
-- -------
-- Registers a pg_cron job that invokes the Edge Function
-- `note-fanout-scheduler` every 5 minutes. The Edge Function
-- queries session_note rows WHERE notify_at <= now() AND
-- delivered_at IS NULL AND deleted_at IS NULL, resolves each
-- row's audience JSONB into a deduplicated profile_ids[], emits
-- push/in-app notifications, and sets delivered_at idempotently.
--
-- CADENCE
-- -------
-- '*/5 * * * *' — 5-minute cadence per ADR-0332 § Cadence value
-- justification. Matches session-hook-executor cadence (same
-- operational class). UX surface promises "Påminner ca HH:MM
-- (±5 min)" — the cadence IS the product contract (ADR-0332 § R3).
--
-- AUTH PATTERN
-- ------------
-- Bearer auth via app.watchdog_cron_secret — identical to
-- session-hook-executor (20260428100300_session_hook_executor_cron.sql).
-- Edge Function validates this secret at invocation time. No JWT is
-- issued; Edge Function operates with service_role client internally.
--
-- LOCAL DEV PARITY
-- ----------------
-- pg_cron is NOT available in Supabase local (supabase start).
-- The DO $cmd$ BEGIN IF EXISTS guard makes this migration a no-op
-- when pg_cron extension is absent, preserving `db reset` idempotency.
-- Developer can manually trigger the scheduler during local dev:
--   curl -X POST $SUPABASE_URL/functions/v1/note-fanout-scheduler \
--     -H "Authorization: Bearer $WATCHDOG_CRON_SECRET"
--
-- IDEMPOTENCY
-- -----------
-- cron.schedule upserts by job name — re-running this migration
-- (e.g. db reset replay) will overwrite the job definition rather
-- than inserting a duplicate. Safe under Supabase branch DB replay.
--
-- TIMEOUT
-- -------
-- 30 000 ms (30 s). Matches session-hook-executor. Edge Function
-- should complete well within this window for typical batch sizes
-- (LIMIT 100 per tick per spec § 4 Journey 4).
--
-- REFERENCES
-- ----------
-- ADR-0332: scheduler cadence + transport decision
-- ADR-0048: pg_cron + Edge Functions as canonical scheduled-work mechanism
-- session-hook-executor mirror: 20260428100300_session_hook_executor_cron.sql
-- Spec:     docs/superpowers/specs/2026-05-15-dagslinjen-quickadd-design.md § 5
-- ============================================================

DO $cmd$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.schedule(
      'note-fanout-scheduler',
      '*/5 * * * *',
      $sql$SELECT net.http_post(
        url     := current_setting('app.supabase_url', true) || '/functions/v1/note-fanout-scheduler',
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
