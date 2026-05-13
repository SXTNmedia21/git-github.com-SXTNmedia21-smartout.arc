-- migrations/20260606120000_fn_normalize_task_status_priority.sql
-- Helper functions for fn_list_my_tasks (ADR-0298 Sortie 2).
-- Both are IMMUTABLE PARALLEL SAFE — safe for index expressions and planner inlining.
-- No I/O: pure CASE-WHEN mapping, deterministic on input alone.

-- ─── fn_normalize_session_task_status ─────────────────────────────────────────
-- Collapses session_task_status ENUM (7 values) into the 6-value normalized set.
-- Precision is preserved in fn_list_my_tasks.raw_status — callers that need the
-- original enum value read raw_status; callers that drive badge colour read status.
--
-- Mapping:
--   pending   → pending
--   available → pending   (pickup-eligible, not yet started)
--   in_progress → in_progress
--   completed → done
--   skipped   → cancelled
--   overdue   → overdue
--   escalated → overdue   (escalated is a severity escalation of overdue, not a
--                          distinct normalized state)
--   <else>    → pending   (defensive — treats unknown future enum values safely)

CREATE OR REPLACE FUNCTION public.fn_normalize_session_task_status(p_raw TEXT)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
AS $$
  SELECT CASE p_raw
    WHEN 'pending'     THEN 'pending'
    WHEN 'available'   THEN 'pending'
    WHEN 'in_progress' THEN 'in_progress'
    WHEN 'completed'   THEN 'done'
    WHEN 'skipped'     THEN 'cancelled'
    WHEN 'overdue'     THEN 'overdue'
    WHEN 'escalated'   THEN 'overdue'
    ELSE 'pending'
  END;
$$;

REVOKE ALL ON FUNCTION public.fn_normalize_session_task_status(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.fn_normalize_session_task_status(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.fn_normalize_session_task_status(TEXT) TO service_role;

COMMENT ON FUNCTION public.fn_normalize_session_task_status IS
  'ADR-0298 Sortie 2 helper. Maps session_task_status ENUM (7 values) to 6-value '
  'normalized status set. IMMUTABLE — safe for planner inlining. '
  'Precision preserved in fn_list_my_tasks.raw_status.';

-- ─── fn_normalize_priority ────────────────────────────────────────────────────
-- Collapses source-native priority values across all task tables into the
-- 4-value normalized set: low | normal | high | critical.
--
-- personal_task.priority CHECK ('low','normal','high','urgent') — 'urgent' maps
-- to 'critical' (ADR-0298 §3.3 divergence 2).
-- 'medium' is a legacy alias for 'normal' tolerated for forward-compat.
-- Uses lower() so any mixed-case value from future sources lands safely.

CREATE OR REPLACE FUNCTION public.fn_normalize_priority(p_raw TEXT)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
AS $$
  SELECT CASE lower(p_raw)
    WHEN 'urgent'   THEN 'critical'
    WHEN 'critical' THEN 'critical'
    WHEN 'high'     THEN 'high'
    WHEN 'normal'   THEN 'normal'
    WHEN 'medium'   THEN 'normal'
    WHEN 'low'      THEN 'low'
    ELSE 'normal'
  END;
$$;

REVOKE ALL ON FUNCTION public.fn_normalize_priority(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.fn_normalize_priority(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.fn_normalize_priority(TEXT) TO service_role;

COMMENT ON FUNCTION public.fn_normalize_priority IS
  'ADR-0298 Sortie 2 helper. Maps source-native priority values to 4-value '
  'normalized set (low|normal|high|critical). personal_task uses urgent→critical. '
  'IMMUTABLE — safe for planner inlining.';
