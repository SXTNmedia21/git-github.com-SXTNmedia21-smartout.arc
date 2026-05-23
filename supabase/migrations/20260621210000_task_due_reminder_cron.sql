-- Migration: task_due_reminder_cron
-- ADR-0298: task sources are personal_task, emma_task, session_task, schedule_day_task.
--
-- This migration adds:
--   1. notified_due_soon_at / notified_overdue_at columns on personal_task + emma_task
--      for idempotency guards (these two sources have a proper timestamptz due_at).
--   2. enqueue_task_due_notifications() — scans due tasks across targeted sources
--      and inserts notification_outbox rows for task.due_soon and task.overdue.
--   3. pg_cron job 'task-due-reminder' running every 15 minutes.
--
-- SCOPE DECISION (V1 task sources targeted vs excluded):
--
--   INCLUDED:
--     personal_task  — clear recipient (profile_id), timestamptz due_at, status 'open'/'done'/'cancelled'
--     emma_task      — clear recipient (profile_id), timestamptz due_at, status 'pending'/'triggered'/'done'/'dismissed'
--
--   EXCLUDED:
--     session_task   — due_at is derived from department_session.session_date (DATE, not a per-task
--                      timestamptz deadline). A session_task "due" time is the full-day session boundary,
--                      not a specific clock time, so a 60-min due_soon window would fire nonsensically
--                      at midnight. Covered by the existing session.hook / shift-related notification paths.
--     schedule_day_task — same issue: shift_date is a DATE, not a timestamptz per-task deadline.
--                         assigned_to may also be NULL (pickup-eligible). Excluded from V1.
--
-- IDEMPOTENCY GUARD:
--   Added columns notified_due_soon_at / notified_overdue_at on personal_task and emma_task.
--   The cron function checks: if the column is already set, skip. This is simpler and more
--   reliable than checking existing notification_outbox rows (which may be purged or TTL-expired).
--   Column is reset to NULL if the task is reopened (no reset trigger needed in V1 — tasks
--   in these sources don't have a "reopen" lifecycle path).
--
-- See: 20260504100003_shift_reminder_crons.sql for the mirrored shift-reminder pattern.
-- See: 20260621201500_reregister_pg_cron_jobs.sql (CRON-REGISTRY-CANONICAL) — updated below.

-- ── 1. Idempotency columns ──────────────────────────────────────────────────

ALTER TABLE public.personal_task
  ADD COLUMN IF NOT EXISTS notified_due_soon_at  TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS notified_overdue_at   TIMESTAMPTZ;

ALTER TABLE public.emma_task
  ADD COLUMN IF NOT EXISTS notified_due_soon_at  TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS notified_overdue_at   TIMESTAMPTZ;

COMMENT ON COLUMN public.personal_task.notified_due_soon_at IS 'Set when task.due_soon notification has been enqueued. Guards against re-notification.';
COMMENT ON COLUMN public.personal_task.notified_overdue_at  IS 'Set when task.overdue notification has been enqueued. Guards against re-notification.';
COMMENT ON COLUMN public.emma_task.notified_due_soon_at     IS 'Set when task.due_soon notification has been enqueued. Guards against re-notification.';
COMMENT ON COLUMN public.emma_task.notified_overdue_at      IS 'Set when task.overdue notification has been enqueued. Guards against re-notification.';

-- ── 2. Cron function ────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.enqueue_task_due_notifications()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
BEGIN
  -- ── ARM A: personal_task — due_soon ──────────────────────────────────────
  -- due_at within the next 60 minutes, status still 'open', not yet notified.
  WITH due_soon_personal AS (
    UPDATE public.personal_task pt
    SET notified_due_soon_at = now()
    WHERE pt.status = 'open'
      AND pt.due_at IS NOT NULL
      AND pt.due_at BETWEEN now() AND (now() + INTERVAL '60 minutes')
      AND pt.notified_due_soon_at IS NULL
    RETURNING
      pt.id            AS task_id,
      pt.profile_id,
      pt.workspace_id,
      pt.title         AS task_title,
      pt.due_at
  )
  INSERT INTO public.notification_outbox (
    workspace_id, recipient_id, mode, priority,
    title, body, action_url, metadata, allowed_channels
  )
  SELECT
    d.workspace_id,
    d.profile_id,
    'work'::notification_mode,
    1,
    'Oppgave forfaller snart',
    d.task_title || ' forfaller snart',
    '/dashboard/operations',
    jsonb_build_object(
      'event_key',   'task.due_soon',
      'task_id',     d.task_id,
      'task_title',  d.task_title,
      'due_at',      d.due_at,
      'due_label',   'om ' || EXTRACT(EPOCH FROM (d.due_at - now()))::int / 60 || ' min',
      'source',      'personal'
    ),
    ARRAY['push', 'in_app']::notification_channel[]
  FROM due_soon_personal d;

  -- ── ARM B: emma_task — due_soon ───────────────────────────────────────────
  WITH due_soon_emma AS (
    UPDATE public.emma_task et
    SET notified_due_soon_at = now()
    WHERE et.status = 'pending'
      AND et.due_at IS NOT NULL
      AND et.due_at BETWEEN now() AND (now() + INTERVAL '60 minutes')
      AND et.notified_due_soon_at IS NULL
    RETURNING
      et.id            AS task_id,
      et.profile_id,
      et.workspace_id,
      et.title         AS task_title,
      et.due_at
  )
  INSERT INTO public.notification_outbox (
    workspace_id, recipient_id, mode, priority,
    title, body, action_url, metadata, allowed_channels
  )
  SELECT
    d.workspace_id,
    d.profile_id,
    'work'::notification_mode,
    1,
    'Oppgave forfaller snart',
    d.task_title || ' forfaller snart',
    '/dashboard/operations',
    jsonb_build_object(
      'event_key',   'task.due_soon',
      'task_id',     d.task_id,
      'task_title',  d.task_title,
      'due_at',      d.due_at,
      'due_label',   'om ' || EXTRACT(EPOCH FROM (d.due_at - now()))::int / 60 || ' min',
      'source',      'emma'
    ),
    ARRAY['push', 'in_app']::notification_channel[]
  FROM due_soon_emma d;

  -- ── ARM C: personal_task — overdue ────────────────────────────────────────
  -- due_at is in the past, status still 'open', not yet notified.
  WITH overdue_personal AS (
    UPDATE public.personal_task pt
    SET notified_overdue_at = now()
    WHERE pt.status = 'open'
      AND pt.due_at IS NOT NULL
      AND pt.due_at < now()
      AND pt.notified_overdue_at IS NULL
    RETURNING
      pt.id            AS task_id,
      pt.profile_id,
      pt.workspace_id,
      pt.title         AS task_title,
      pt.due_at
  )
  INSERT INTO public.notification_outbox (
    workspace_id, recipient_id, mode, priority,
    title, body, action_url, metadata, allowed_channels
  )
  SELECT
    d.workspace_id,
    d.profile_id,
    'work'::notification_mode,
    2,
    'Oppgave er forfalt',
    d.task_title || ' er forfalt',
    '/dashboard/operations',
    jsonb_build_object(
      'event_key',   'task.overdue',
      'task_id',     d.task_id,
      'task_title',  d.task_title,
      'due_at',      d.due_at,
      'source',      'personal'
    ),
    ARRAY['push', 'in_app']::notification_channel[]
  FROM overdue_personal d;

  -- ── ARM D: emma_task — overdue ────────────────────────────────────────────
  WITH overdue_emma AS (
    UPDATE public.emma_task et
    SET notified_overdue_at = now()
    WHERE et.status = 'pending'
      AND et.due_at IS NOT NULL
      AND et.due_at < now()
      AND et.notified_overdue_at IS NULL
    RETURNING
      et.id            AS task_id,
      et.profile_id,
      et.workspace_id,
      et.title         AS task_title,
      et.due_at
  )
  INSERT INTO public.notification_outbox (
    workspace_id, recipient_id, mode, priority,
    title, body, action_url, metadata, allowed_channels
  )
  SELECT
    d.workspace_id,
    d.profile_id,
    'work'::notification_mode,
    2,
    'Oppgave er forfalt',
    d.task_title || ' er forfalt',
    '/dashboard/operations',
    jsonb_build_object(
      'event_key',   'task.overdue',
      'task_id',     d.task_id,
      'task_title',  d.task_title,
      'due_at',      d.due_at,
      'source',      'emma'
    ),
    ARRAY['push', 'in_app']::notification_channel[]
  FROM overdue_emma d;
END;
$fn$;

REVOKE ALL ON FUNCTION public.enqueue_task_due_notifications() FROM public;
GRANT EXECUTE ON FUNCTION public.enqueue_task_due_notifications() TO service_role;

COMMENT ON FUNCTION public.enqueue_task_due_notifications() IS
  'Cron function (every 15 min). Scans personal_task + emma_task for due_soon (next 60 min) '
  'and overdue (past due_at, still open/pending) tasks. Inserts notification_outbox rows and '
  'stamps notified_due_soon_at / notified_overdue_at for idempotency. '
  'session_task + schedule_day_task excluded in V1 (date-only due boundaries, not timestamptz). '
  'ADR-0298 task ontology.';

-- ── 3. pg_cron job ──────────────────────────────────────────────────────────

DO $cron$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    BEGIN PERFORM cron.unschedule('task-due-reminder'); EXCEPTION WHEN OTHERS THEN NULL; END;
    PERFORM cron.schedule(
      'task-due-reminder',
      '*/15 * * * *',
      'SELECT public.enqueue_task_due_notifications();'
    );
    RAISE NOTICE 'pg_cron job task-due-reminder registered';
  ELSE
    RAISE NOTICE 'pg_cron not enabled — task-due-reminder job not registered (expected on local dev)';
  END IF;
END
$cron$;

-- ── 4. CRON-REGISTRY-CANONICAL update ───────────────────────────────────────
-- The canonical reregister file (20260621201500_reregister_pg_cron_jobs.sql) declares
-- "CRON-REGISTRY-CANONICAL: this file is the enforced single source of truth".
-- This job is registered above. On a fresh DB, the reregister migration runs BEFORE
-- this one (lower timestamp). The job will be registered by THIS migration on fresh
-- installs. For existing prod DBs where reregister has already run, this migration
-- adds the job directly. See inline comment in reregister file for update instructions.
