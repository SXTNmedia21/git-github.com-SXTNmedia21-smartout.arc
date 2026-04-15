-- =====================================================================
-- 20260508100100_engine_state_archive_job.sql
-- Phase 5 per ADR-0098: engine_state TTL + archive.
--
-- ADR-0098 invariant: engine_state is coordination-only, never truth.
-- Completed/failed/escalated rows older than the retention window move
-- to engine_state_archive so the live table stays small (target <1000
-- active rows steady-state).
--
-- NOTE on status values: the engine_state.status CHECK constraint allows
-- ('pending', 'active', 'waiting', 'complete', 'failed', 'escalated').
-- ADR-0098 describes these semantically as "completed, failed, blocked";
-- we archive 'complete', 'failed', and 'escalated' which correspond.
-- =====================================================================

SET search_path TO public, extensions;

-- ──────────────────────────────────────────────
-- 1. engine_state_archive
-- ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.engine_state_archive (
  -- Mirror engine_state columns so historical rows can be rehydrated 1:1.
  id              UUID PRIMARY KEY,
  trigger_id      UUID,
  process_id      TEXT NOT NULL,
  workspace_id    UUID NOT NULL,
  current_step    INTEGER NOT NULL DEFAULT 0,
  status          TEXT NOT NULL,
  entity_type     TEXT,
  entity_id       UUID,
  assignee_id     UUID,
  context         JSONB NOT NULL DEFAULT '{}',
  steps_snapshot  JSONB,
  result          JSONB,
  depth           INTEGER NOT NULL DEFAULT 0,
  parent_state_id UUID,
  retry_count     INTEGER NOT NULL DEFAULT 0,
  last_error      TEXT,
  started_at      TIMESTAMPTZ NOT NULL,
  updated_at      TIMESTAMPTZ NOT NULL,
  completed_at    TIMESTAMPTZ,
  -- Archive-only metadata
  archived_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_engine_state_archive_workspace
  ON public.engine_state_archive (workspace_id);
CREATE INDEX IF NOT EXISTS idx_engine_state_archive_process
  ON public.engine_state_archive (process_id);
CREATE INDEX IF NOT EXISTS idx_engine_state_archive_completed
  ON public.engine_state_archive (completed_at DESC);

ALTER TABLE public.engine_state_archive ENABLE ROW LEVEL SECURITY;

-- Service-role only: archive is operational, not user-surfaced.
DROP POLICY IF EXISTS "service_role_engine_state_archive" ON public.engine_state_archive;
CREATE POLICY "service_role_engine_state_archive" ON public.engine_state_archive
  FOR ALL USING (auth.role() = 'service_role');

COMMENT ON TABLE public.engine_state_archive IS
  'ADR-0098 Phase 5 archive for engine_state. Mirrors engine_state columns + archived_at. '
  'Queryable for audit; not used by dispatcher.';

-- ──────────────────────────────────────────────
-- 2. Archive function
-- ──────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.archive_completed_engine_states(
  p_retention_days INT DEFAULT 30
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_moved INTEGER := 0;
  v_cutoff TIMESTAMPTZ := now() - (p_retention_days || ' days')::interval;
BEGIN
  WITH moved AS (
    DELETE FROM public.engine_state
     WHERE status IN ('complete', 'failed', 'escalated')
       AND updated_at < v_cutoff
    RETURNING *
  )
  INSERT INTO public.engine_state_archive (
    id, trigger_id, process_id, workspace_id, current_step, status,
    entity_type, entity_id, assignee_id, context, steps_snapshot, result,
    depth, parent_state_id, retry_count, last_error,
    started_at, updated_at, completed_at
  )
  SELECT
    id, trigger_id, process_id, workspace_id, current_step, status,
    entity_type, entity_id, assignee_id, context, steps_snapshot, result,
    depth, parent_state_id, retry_count, last_error,
    started_at, updated_at, completed_at
  FROM moved;

  GET DIAGNOSTICS v_moved = ROW_COUNT;
  RETURN v_moved;
END;
$$;

COMMENT ON FUNCTION public.archive_completed_engine_states(INT) IS
  'ADR-0098 Phase 5. Moves complete/failed/escalated engine_state rows older than the '
  'retention window into engine_state_archive. Returns the number of rows archived.';

GRANT EXECUTE ON FUNCTION public.archive_completed_engine_states(INT) TO service_role;

-- ──────────────────────────────────────────────
-- 3. pg_cron schedule (if extension is enabled)
-- ──────────────────────────────────────────────
-- pg_cron is typically enabled by default on Supabase Cloud but not on
-- all local/dev instances. Schedule conditionally so this migration
-- never fails on environments without pg_cron. Ops must verify the job
-- registered on Cloud; if missing, enable pg_cron in the dashboard and
-- re-run this block.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    -- Unschedule any prior version under the same name (idempotent).
    PERFORM cron.unschedule(jobid)
      FROM cron.job
     WHERE jobname = 'archive_completed_engine_states_daily';

    PERFORM cron.schedule(
      'archive_completed_engine_states_daily',
      '0 3 * * *',  -- 03:00 UTC daily
      $job$SELECT public.archive_completed_engine_states(30);$job$
    );
  ELSE
    RAISE NOTICE 'pg_cron not installed — archive_completed_engine_states_daily NOT scheduled. Enable pg_cron in Supabase Cloud dashboard and re-apply this migration.';
  END IF;
END $$;
