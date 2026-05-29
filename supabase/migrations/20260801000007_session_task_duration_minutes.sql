-- Migration 20260801000007: session_task.duration_minutes
-- Day-line P1 (PLAN-4b). Timeline task blocks hardcoded end = start + 60 min
-- (ManagerTimelineShell). Add an explicit, nullable duration so the chart can
-- render real block heights; null → caller falls back to 60 (no behavior change
-- for existing rows).
--
-- L-0042: timestamp 20260801000007 is strictly > current tip 20260801000006.
-- No RLS change — column on an existing, already-RLS'd table.

BEGIN;

ALTER TABLE public.session_task
  ADD COLUMN IF NOT EXISTS duration_minutes integer;

COMMENT ON COLUMN public.session_task.duration_minutes IS
  'Planned task duration in minutes (day-line block height). NULL = use default 60 (PLAN-4b, ADR-0367).';

COMMIT;
