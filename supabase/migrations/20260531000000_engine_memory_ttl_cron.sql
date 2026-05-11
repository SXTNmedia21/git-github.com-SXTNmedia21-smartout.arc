-- ============================================================================
-- F-MEM-UNBLOCK-A3 Task 4 — pg_cron TTL cleanup for engine_memory
--
-- engine_memory.expires_at is a nullable timestamptz. Rows where expires_at
-- IS NOT NULL and expires_at < now() are considered stale and safe to delete.
--
-- The summary rows written at session-end (writeSessionSummary) are written
-- with expires_at = NULL (no TTL — summaries persist indefinitely until an
-- admin or the user explicitly deletes them). Only rows where a caller
-- explicitly set expires_at (e.g. short-lived conversation-scope memories)
-- are purged by this job.
--
-- Schedule: daily at 03:00 UTC — low-traffic window, after nightly reconcile.
--
-- Guard: the entire pg_cron registration is skipped when pg_cron is not
-- installed (Supabase Local dev, older cloud branches). Same pattern as
-- 20260428100100_daily_session_replenish_cron.sql and
-- 20260520110100_heartbeat_dispatcher_cron.sql.
--
-- Idempotent: cron.schedule() is UPSERT-by-name — safe to re-apply.
--
-- Refs: engine_memory schema (20260319120000_fix_engine_memory_constraints.sql),
--       F-MEM-UNBLOCK-A3 plan, BOTSSON-SYSTEM-MAP.md §G1.
-- ============================================================================

DO $outer$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.schedule(
      'engine-memory-ttl-purge',
      '0 3 * * *',
      $job$
        DELETE FROM engine_memory
         WHERE expires_at IS NOT NULL
           AND expires_at < now();
      $job$
    );
    RAISE NOTICE 'pg_cron job engine-memory-ttl-purge registered (daily 03:00 UTC)';
  ELSE
    RAISE NOTICE 'pg_cron not enabled — engine_memory TTL purge must be run manually or via Edge Function';
  END IF;
END;
$outer$;

-- Verification (manual):
--   SELECT jobid, schedule, command, nodename
--     FROM cron.job
--    WHERE jobname = 'engine-memory-ttl-purge';
