-- ============================================
-- 20260519170000_is_employee_blocked_function.sql
-- is_employee_blocked — SECURITY DEFINER RPC (ADR-0243, Part C)
--
-- Returns whether an employee has blocking contract obligations.
-- "Blocking" = is_blocker=true AND status IN ('pending','in_progress','overdue').
--
-- Used by:
--   - Clock-in middleware (Phase 5)
--   - Amendment-handler (pre-flight check)
--   - obligation-overdue-cron (before setting overdue)
--
-- SECURITY DEFINER: reads contract_obligation for a given workspace+profile
-- regardless of the caller's JWT (the gate is the calling context, not RLS).
-- Pattern per L-0172: SECURITY DEFINER + SET search_path + REVOKE from PUBLIC.
--
-- Returns: JSON with { blocked: boolean, reasons: [{obligation_id, title, status, due_at}] }
-- ============================================

SET search_path TO public, extensions;

CREATE OR REPLACE FUNCTION public.is_employee_blocked(
  p_profile_id   UUID,
  p_workspace_id UUID
)
RETURNS JSONB
LANGUAGE PLPGSQL
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_blockers JSONB;
  v_blocked  BOOLEAN;
BEGIN
  SELECT
    jsonb_agg(
      jsonb_build_object(
        'obligation_id', ob.id,
        'title',         ob.title,
        'status',        ob.status,
        'due_at',        ob.due_at,
        'obligation_type', ob.obligation_type
      )
    )
  INTO v_blockers
  FROM public.contract_obligation ob
  JOIN public.employment_contract ec
    ON ob.contract_id = ec.contract_id
  WHERE ec.profile_id    = p_profile_id
    AND ob.workspace_id  = p_workspace_id
    AND ob.is_blocker    = true
    AND ob.status IN ('pending', 'in_progress', 'overdue');

  v_blocked := v_blockers IS NOT NULL AND jsonb_array_length(v_blockers) > 0;

  RETURN jsonb_build_object(
    'blocked',  v_blocked,
    'reasons',  COALESCE(v_blockers, '[]'::jsonb)
  );
END;
$$;

COMMENT ON FUNCTION public.is_employee_blocked(UUID, UUID) IS
  'Returns {blocked: bool, reasons: [{obligation_id, title, status, due_at}]} '
  'for a given profile in a workspace. Reads contract_obligation rows where '
  'is_blocker=true AND status IN (pending, in_progress, overdue). '
  'SECURITY DEFINER per L-0172 — caller must be authenticated; gate is the '
  'calling context (e.g. clock-in middleware, amendment-handler). '
  'ADR-0243. Migration 20260519170000.';

-- Least-privilege: revoke broad execute, grant to authenticated only.
REVOKE EXECUTE ON FUNCTION public.is_employee_blocked(UUID, UUID) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.is_employee_blocked(UUID, UUID) TO authenticated;
GRANT  EXECUTE ON FUNCTION public.is_employee_blocked(UUID, UUID) TO service_role;
