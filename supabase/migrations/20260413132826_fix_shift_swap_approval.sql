SET search_path TO public, extensions;

-- ============================================
-- 20260413132826_fix_shift_swap_approval.sql
-- Fixes approve_shift_swap RPC:
--   1. ADR-0066: Add temporal lock check before swapping employee_ids
--   2. Store profile_id (not user_id) in rejected_by context field
--   3. Provenance (source_type/source_id) skipped — columns do not exist
--      on schedule_shift yet
-- ============================================

CREATE OR REPLACE FUNCTION public.approve_shift_swap(
  p_swap_id UUID,
  p_approved BOOLEAN,
  p_reason TEXT DEFAULT NULL
) RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_user_id UUID;
  v_state RECORD;
  v_workspace_id UUID;
  v_requester_shift_id UUID;
  v_target_shift_id UUID;
  v_requester_profile_id UUID;
  v_target_profile_id UUID;
  v_manager_profile_id UUID;
  v_requester_shift RECORD;
  v_target_shift RECORD;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Fetch the swap state
  SELECT id, context, workspace_id, status
  INTO v_state
  FROM public.engine_state
  WHERE id = p_swap_id AND process_id = 'shift_swap';

  IF v_state IS NULL THEN
    RAISE EXCEPTION 'Swap not found';
  END IF;

  IF v_state.context->>'status' != 'pending_manager' THEN
    RAISE EXCEPTION 'Swap is not pending manager approval';
  END IF;

  v_workspace_id := v_state.workspace_id;

  -- Verify user is admin/manager in workspace
  IF NOT is_admin_in_workspace(v_user_id, v_workspace_id) THEN
    RAISE EXCEPTION 'Only admins can approve swaps';
  END IF;

  -- Resolve the manager's profile_id for provenance
  SELECT profile_id INTO v_manager_profile_id
  FROM public.profile
  WHERE user_id = v_user_id AND workspace_id = v_workspace_id
  LIMIT 1;

  IF NOT p_approved THEN
    -- Reject and close — store profile_id (not user_id) as rejected_by
    UPDATE public.engine_state
    SET context = context || jsonb_build_object(
          'status', 'rejected',
          'rejected_by', COALESCE(v_manager_profile_id::text, v_user_id::text),
          'rejection_reason', COALESCE(p_reason, '')
        ),
        status = 'complete',
        completed_at = now(),
        updated_at = now()
    WHERE id = p_swap_id;
    RETURN;
  END IF;

  -- ── Approve: execute the swap ─────────────────────────────────────────
  v_requester_shift_id := (v_state.context->>'requester_shift_id')::uuid;
  v_target_shift_id := (v_state.context->>'target_shift_id')::uuid;
  v_requester_profile_id := (v_state.context->>'requester_profile_id')::uuid;
  v_target_profile_id := (v_state.context->>'target_profile_id')::uuid;

  -- Re-verify shifts still exist and haven't changed ownership
  SELECT schedule_shift_id, shift_date, start_time, workspace_id
  INTO v_requester_shift
  FROM schedule_shift
  WHERE schedule_shift_id = v_requester_shift_id
  AND employee_id = v_requester_profile_id;

  IF v_requester_shift IS NULL THEN
    RAISE EXCEPTION 'Requester shift has changed since swap was requested';
  END IF;

  SELECT schedule_shift_id, shift_date, start_time, workspace_id
  INTO v_target_shift
  FROM schedule_shift
  WHERE schedule_shift_id = v_target_shift_id
  AND employee_id = v_target_profile_id;

  IF v_target_shift IS NULL THEN
    RAISE EXCEPTION 'Target shift has changed since swap was requested';
  END IF;

  -- ADR-0066: Verify neither shift is temporally locked before swapping.
  -- The trigger on schedule_shift also enforces this, but a proactive check
  -- here gives a clearer error message specific to swap context.
  IF public.schedule_shift_is_temporally_locked(
       v_requester_shift.workspace_id,
       v_requester_shift.shift_date,
       v_requester_shift.start_time
  ) THEN
    RAISE EXCEPTION 'Requester shift is temporally locked — cannot swap a shift that has started or passed';
  END IF;

  IF public.schedule_shift_is_temporally_locked(
       v_target_shift.workspace_id,
       v_target_shift.shift_date,
       v_target_shift.start_time
  ) THEN
    RAISE EXCEPTION 'Target shift is temporally locked — cannot swap a shift that has started or passed';
  END IF;

  -- Swap employee_ids on both shifts
  UPDATE public.schedule_shift
  SET employee_id = v_target_profile_id, updated_at = now()
  WHERE schedule_shift_id = v_requester_shift_id;

  UPDATE public.schedule_shift
  SET employee_id = v_requester_profile_id, updated_at = now()
  WHERE schedule_shift_id = v_target_shift_id;

  -- Mark engine_state as complete with executed status
  UPDATE public.engine_state
  SET context = context || jsonb_build_object(
        'status', 'executed',
        'executed_at', to_char(now(), 'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
        'approved_by', COALESCE(v_manager_profile_id::text, v_user_id::text)
      ),
      status = 'complete',
      completed_at = now(),
      updated_at = now()
  WHERE id = p_swap_id;
END;
$$;

-- Re-grant after CREATE OR REPLACE
GRANT EXECUTE ON FUNCTION public.approve_shift_swap TO authenticated;
