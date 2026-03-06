-- Archive (delete) stale onboarding workspaces for the current user.
-- SECURITY DEFINER so it can bypass RLS. Only deletes workspaces
-- where the calling user has a profile AND contract_status is 'onboarding' or 'setup'.

CREATE OR REPLACE FUNCTION public.archive_onboarding_workspaces(
  p_workspace_ids uuid[]
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id uuid;
  v_valid_ids uuid[];
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Only allow archiving workspaces the user owns AND that are in onboarding/setup
  SELECT array_agg(w.workspace_id) INTO v_valid_ids
  FROM public.workspace w
  JOIN public.profile p ON p.workspace_id = w.workspace_id
  WHERE w.workspace_id = ANY(p_workspace_ids)
    AND p.user_id = v_user_id
    AND w.contract_status IN ('onboarding', 'setup');

  IF v_valid_ids IS NULL OR array_length(v_valid_ids, 1) = 0 THEN
    RETURN;
  END IF;

  -- Delete in dependency order
  DELETE FROM public.procedure WHERE protocol_id IN (
    SELECT protocol_id FROM public.protocol WHERE workspace_id = ANY(v_valid_ids)
  );
  DELETE FROM public.protocol WHERE workspace_id = ANY(v_valid_ids);
  DELETE FROM public.policy WHERE workspace_id = ANY(v_valid_ids);
  DELETE FROM public.zone WHERE workspace_id = ANY(v_valid_ids);
  DELETE FROM public.location WHERE workspace_id = ANY(v_valid_ids);
  DELETE FROM public.team WHERE workspace_id = ANY(v_valid_ids);
  DELETE FROM public.department WHERE workspace_id = ANY(v_valid_ids);
  DELETE FROM public.season WHERE workspace_id = ANY(v_valid_ids);
  DELETE FROM public.agent_profile WHERE workspace_id = ANY(v_valid_ids);
  DELETE FROM public.profile WHERE workspace_id = ANY(v_valid_ids);
  DELETE FROM public.workspace WHERE workspace_id = ANY(v_valid_ids);
END;
$$;
