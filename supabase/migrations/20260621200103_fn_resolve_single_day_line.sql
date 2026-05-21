-- 20260621200103_fn_resolve_single_day_line.sql
--
-- Resolve the single day_line for a department_session.
-- Returns the day_line_id when the session has EXACTLY ONE active day_line;
-- NULL when zero (no anchor yet) or many (ambiguous — never guess, per ADR-0367 + council Q-C).
--
-- Mirrors the (department_session_id, location_id) → day_line resolution in
-- ensure_shift_session() (migration 20260620130000 lines 65-70) and the single-location
-- LIMIT 1 pattern in 20260620120700_day_line_backfill.sql. DRY: one helper instead of
-- inlining the same count-guard in 3+ Edge Functions.
--
-- "Cancelled" day_lines (cancelled_at IS NOT NULL) are excluded — they no longer represent
-- a valid anchor for shift attachment.
--
-- SINGLE-AREA V1: a department_session with >1 day_line (multi-area day) leaves auto-spawned
-- tasks department-level (day_line_id NULL) and logs via RAISE LOG. Full per-area fan-out is
-- ADR-0367 Rule 2, deferred to a follow-up sortie.

CREATE OR REPLACE FUNCTION public.fn_resolve_single_day_line(p_department_session_id uuid)
RETURNS uuid
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count  bigint;
  v_result uuid;
BEGIN
  SELECT count(*)
    INTO v_count
  FROM public.day_line dl
  WHERE dl.department_session_id = p_department_session_id
    AND dl.cancelled_at IS NULL;

  -- Return the id only when exactly one active day_line exists.
  -- NULL for zero (no anchor) or many (ambiguous — per ADR-0367 + council Q-C: never guess).
  IF v_count = 1 THEN
    SELECT dl.day_line_id
      INTO v_result
    FROM public.day_line dl
    WHERE dl.department_session_id = p_department_session_id
      AND dl.cancelled_at IS NULL
    LIMIT 1;
    RETURN v_result;
  END IF;

  -- Multi-area session (single-area V1 scope cut): make the de-anchor OBSERVABLE, not silent.
  -- Return contract is unchanged (still NULL) — this log only surfaces the boundary in postgres logs.
  IF v_count > 1 THEN
    RAISE LOG 'fn_resolve_single_day_line: department_session % has % active day_lines (multi-area) — task left department-level (single-area V1 scope, ADR-0367 Rule 2 fan-out deferred)', p_department_session_id, v_count;
  END IF;
  RETURN NULL;
END;
$$;

REVOKE ALL ON FUNCTION public.fn_resolve_single_day_line(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.fn_resolve_single_day_line(uuid) TO service_role;
