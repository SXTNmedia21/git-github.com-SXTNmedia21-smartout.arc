-- 20260622110000_session_task_overdue_cron.sql
--
-- Register the session-task-overdue-cron pg_cron job.
-- The Edge Function session-task-overdue-cron:
--   1. Selects session_task rows with status IN ('pending','available','in_progress')
--      and due_at < now() - grace_period.
--   2. Updates status → 'overdue'.
--   3. Inserts notification_outbox rows for assignee + department managers.
--   4. Writes activity_trail (event_key = 'session_task.overdue').
--
-- Runs every 5 minutes — same cadence as session-hook-executor (task lifecycle symmetry).
-- WATCHDOG_CRON_SECRET stored in vault (20260621202000_cron_jobs_via_vault.sql pattern).
--
-- ADR-0298 Sortie 3 — task capability / overdue transition.
-- CRON-REGISTRY-CANONICAL: also register in 20260621201500_reregister_pg_cron_jobs.sql
-- if pg_cron was ever disabled in prod (see ADR-0388).
-- ==========================================================================

DO $cmd$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    -- Unschedule idempotently before re-registering.
    BEGIN
      PERFORM cron.unschedule('session-task-overdue-cron');
    EXCEPTION WHEN OTHERS THEN NULL;
    END;

    PERFORM cron.schedule(
      'session-task-overdue-cron',
      '*/5 * * * *',
      $sql$SELECT net.http_post(
        url := current_setting('app.supabase_url', true) || '/functions/v1/session-task-overdue-cron',
        headers := jsonb_build_object('Authorization', 'Bearer ' || current_setting('app.watchdog_cron_secret', true))
      )$sql$
    );
  END IF;
END $cmd$;
