-- 20260620141200_fn_birthday_cohort_for_workspace.sql
--
-- WHY: GDPR-safe cohort resolver for birthday auto-publish pipe (ADR-0372 Q1).
--   date_of_birth lives in user_identity (GDPR vault). This SECURITY DEFINER function
--   JOINs profile → user_identity on user_id, matches month+day to p_today, and returns
--   ONLY profile_id + display_name. DOB never crosses the function boundary.
--
-- Opt-out (Q4, ADR-0372): Fallback path while ADR-0373 profile_visibility matrix has not
--   shipped. The function reads notification_pref JSONB key 'celebrate_birthday' (default
--   true if missing or not false). When ADR-0373 ships, this migration should be replaced
--   with a version that LEFT JOINs profile_visibility instead.
--
-- GRANT EXECUTE: service_role ONLY. No authenticated / anon access.
--
-- ADR-0372 Q1 + Q4, ADR-0078 (DOB is PII — never leaves function boundary).

CREATE OR REPLACE FUNCTION public.fn_birthday_cohort_for_workspace(
  p_workspace_id uuid,
  p_today        date
)
RETURNS TABLE (
  profile_id   uuid,
  display_name text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- L-0177 fail-fast: workspace must exist before computing any cohort.
  IF NOT EXISTS (
    SELECT 1 FROM public.workspace WHERE workspace_id = p_workspace_id
  ) THEN
    RAISE EXCEPTION 'WORKSPACE_NOT_FOUND: % does not exist', p_workspace_id;
  END IF;

  RETURN QUERY
  SELECT
    p.profile_id,
    p.display_name
  FROM public.profile p
  JOIN public.user_identity ui
    ON ui.user_id = p.user_id
  WHERE
    -- Workspace scope (Law 1).
    p.workspace_id = p_workspace_id
    -- Only active + trainee employees (no system/departed profiles).
    AND p.status IN ('active', 'trainee')
    AND p.role NOT IN ('system')
    -- Birthday match: month AND day must match (year-agnostic).
    AND ui.date_of_birth IS NOT NULL
    AND EXTRACT(MONTH FROM ui.date_of_birth) = EXTRACT(MONTH FROM p_today)
    AND EXTRACT(DAY   FROM ui.date_of_birth) = EXTRACT(DAY   FROM p_today)
    -- Per-employee opt-out (Q4 fallback — ADR-0373 migration-out note below).
    -- JSONB key celebrate_birthday: if absent (default) = opt-in (true).
    -- Explicit false = opted out. Any other value or absent key = included.
    -- ADR-0373 migration-out: when profile_visibility matrix ships, REPLACE this
    -- filter with: NOT EXISTS (SELECT 1 FROM profile_visibility pv WHERE
    --   pv.profile_id = p.profile_id AND pv.field = 'date_of_birth' AND
    --   pv.audience = 'hidden' AND pv.source = 'opt_out')
    AND COALESCE(
      (p.notification_pref ->> 'celebrate_birthday')::boolean,
      true  -- default: opted in
    ) IS NOT FALSE;

  -- NOTE: DOB is intentionally NOT in the RETURNS TABLE or SELECT list.
  -- The function boundary is the GDPR vault exit point. Callers receive
  -- profile_id + display_name only.
END;
$$;

-- Revoke all, then grant only to service_role (cron + Edge Function use service_role client).
REVOKE ALL ON FUNCTION public.fn_birthday_cohort_for_workspace(uuid, date) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fn_birthday_cohort_for_workspace(uuid, date) TO service_role;

COMMENT ON FUNCTION public.fn_birthday_cohort_for_workspace(uuid, date) IS
  'GDPR-safe birthday cohort resolver (ADR-0372 Q1). Returns profile_id + display_name '
  'for profiles whose birthday month+day matches p_today. DOB never leaves this function. '
  'service_role ONLY. Per-employee opt-out via notification_pref JSONB key celebrate_birthday '
  '(Q4 fallback — to be replaced by profile_visibility matrix when ADR-0373 ships). '
  'SECURITY DEFINER to read user_identity across the profile join.';
