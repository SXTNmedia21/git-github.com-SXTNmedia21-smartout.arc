SET search_path TO public, extensions;

-- ============================================
-- 20260413123343_shift_swap_engine.sql
-- Shift Swap via Event Engine (ADR-0067)
--
-- Seeds engine_process blueprint for shift_swap and creates
-- 3 SECURITY DEFINER RPCs for the 3-phase approval flow:
--   1. initiate_shift_swap   — Employee A requests
--   2. respond_to_shift_swap — Employee B accepts/rejects
--   3. approve_shift_swap    — Manager approves/rejects + executes
--
-- NO NEW TABLES — all swap state lives in engine_state.context JSONB.
-- ============================================

-- ── Engine Process Blueprint ────────────────────────────────────────────────

INSERT INTO public.engine_process (id, name, description, is_active, max_steps, allowed_channels)
VALUES (
  'shift_swap',
  'Shift Swap',
  'Mutual shift exchange between two employees with manager approval. 3-phase: request > accept > approve.',
  true,
  6,
  ARRAY['chat']
) ON CONFLICT (id) DO UPDATE SET
  allowed_channels = EXCLUDED.allowed_channels,
  description = EXCLUDED.description;

-- Engine steps for the shift_swap process
INSERT INTO public.engine_step (process_id, step_order, action_type, action_payload, assignee_rule) VALUES
  ('shift_swap', 1, 'wait_for_event', '{"event_type": "shift_swap.initiated"}'::jsonb, 'self'),
  ('shift_swap', 2, 'validate_settlement', '{"validation": "d3_swap_rules"}'::jsonb, 'self'),
  ('shift_swap', 3, 'wait_for_event', '{"event_type": "shift_swap.recipient_response"}'::jsonb, 'self'),
  ('shift_swap', 4, 'wait_for_event', '{"event_type": "shift_swap.manager_decision"}'::jsonb, 'manager'),
  ('shift_swap', 5, 'update_entity', '{"entity": "schedule_shift", "action": "swap_employee_ids"}'::jsonb, 'self'),
  ('shift_swap', 6, 'send_notification', '{"template": "shift_swap_result", "recipients": "all_parties"}'::jsonb, 'self')
ON CONFLICT (process_id, step_order) DO NOTHING;

-- ── RPC: Initiate Shift Swap ────────────────────────────────────────────────
-- Employee A requests a swap. Validates ownership and shift state.
-- Creates engine_state with swap context. Returns engine_state.id.

CREATE OR REPLACE FUNCTION public.initiate_shift_swap(
  p_requester_shift_id UUID,
  p_target_profile_id UUID,
  p_target_shift_id UUID,
  p_reason TEXT DEFAULT NULL
) RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_requester_id UUID;
  v_workspace_id UUID;
  v_state_id UUID;
  v_requester_shift RECORD;
  v_target_shift RECORD;
BEGIN
  -- Authenticate the requesting user
  v_requester_id := auth.uid();
  IF v_requester_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Verify requester owns the shift
  SELECT schedule_shift_id, employee_id, workspace_id, shift_date, start_time, end_time,
         work_hours, position_id, status, is_published
  INTO v_requester_shift
  FROM public.schedule_shift
  WHERE schedule_shift_id = p_requester_shift_id;

  IF v_requester_shift IS NULL THEN
    RAISE EXCEPTION 'Shift not found';
  END IF;

  -- Check requester owns this shift via profile link
  IF NOT EXISTS (
    SELECT 1 FROM public.profile
    WHERE user_id = v_requester_id
    AND profile_id = v_requester_shift.employee_id
    AND workspace_id = v_requester_shift.workspace_id
  ) THEN
    RAISE EXCEPTION 'You do not own this shift';
  END IF;

  -- Shift must be published and not started
  IF v_requester_shift.status NOT IN ('published', 'assigned') THEN
    RAISE EXCEPTION 'Shift must be published to swap';
  END IF;
  IF v_requester_shift.shift_date < CURRENT_DATE THEN
    RAISE EXCEPTION 'Cannot swap a past shift';
  END IF;

  v_workspace_id := v_requester_shift.workspace_id;

  -- Verify target shift exists and belongs to target profile
  SELECT schedule_shift_id, employee_id, shift_date, start_time, end_time,
         work_hours, position_id, status
  INTO v_target_shift
  FROM public.schedule_shift
  WHERE schedule_shift_id = p_target_shift_id
  AND employee_id = p_target_profile_id
  AND workspace_id = v_workspace_id;

  IF v_target_shift IS NULL THEN
    RAISE EXCEPTION 'Target shift not found or does not belong to target employee';
  END IF;

  -- Create engine_state for the swap workflow
  INSERT INTO public.engine_state (
    process_id, workspace_id, entity_type, entity_id,
    status, context, started_at
  ) VALUES (
    'shift_swap', v_workspace_id, 'schedule_shift', p_requester_shift_id,
    'active',
    jsonb_build_object(
      'requester_profile_id', v_requester_shift.employee_id,
      'target_profile_id', p_target_profile_id,
      'requester_shift_id', p_requester_shift_id,
      'target_shift_id', p_target_shift_id,
      'swap_type', 'mutual_exchange',
      'reason', COALESCE(p_reason, ''),
      'status', 'pending_recipient',
      'validation_result', jsonb_build_object(
        'eligible', true,
        'blockers', '[]'::jsonb,
        'warnings', '[]'::jsonb
      )
    ),
    now()
  ) RETURNING id INTO v_state_id;

  RETURN v_state_id;
END;
$$;

-- ── RPC: Respond to Shift Swap ──────────────────────────────────────────────
-- Employee B accepts or rejects the swap request.
-- Only the target profile can respond. Updates engine_state.context.status.

CREATE OR REPLACE FUNCTION public.respond_to_shift_swap(
  p_swap_id UUID,
  p_accepted BOOLEAN,
  p_reason TEXT DEFAULT NULL
) RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_user_id UUID;
  v_state RECORD;
  v_target_profile_id TEXT;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Fetch the swap state
  SELECT id, context, status
  INTO v_state
  FROM public.engine_state
  WHERE id = p_swap_id AND process_id = 'shift_swap';

  IF v_state IS NULL THEN
    RAISE EXCEPTION 'Swap not found';
  END IF;

  IF v_state.context->>'status' != 'pending_recipient' THEN
    RAISE EXCEPTION 'Swap is not pending recipient response';
  END IF;

  -- Verify the responding user is the target
  v_target_profile_id := v_state.context->>'target_profile_id';
  IF NOT EXISTS (
    SELECT 1 FROM public.profile
    WHERE user_id = v_user_id AND profile_id::text = v_target_profile_id
  ) THEN
    RAISE EXCEPTION 'You are not the target of this swap';
  END IF;

  IF p_accepted THEN
    -- Advance to manager approval phase
    UPDATE public.engine_state
    SET context = context || jsonb_build_object('status', 'pending_manager'),
        updated_at = now()
    WHERE id = p_swap_id;
  ELSE
    -- Reject and close the workflow
    UPDATE public.engine_state
    SET context = context || jsonb_build_object(
          'status', 'rejected',
          'rejected_by', v_target_profile_id,
          'rejection_reason', COALESCE(p_reason, '')
        ),
        status = 'complete',
        completed_at = now(),
        updated_at = now()
    WHERE id = p_swap_id;
  END IF;
END;
$$;

-- ── RPC: Approve/Reject Shift Swap ──────────────────────────────────────────
-- Manager approves or rejects the swap. On approval: swaps employee_ids
-- on both schedule_shift records and marks the workflow complete.

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

  IF NOT p_approved THEN
    -- Reject and close
    UPDATE public.engine_state
    SET context = context || jsonb_build_object(
          'status', 'rejected',
          'rejected_by', v_user_id::text,
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

  -- Re-verify shifts still exist and havent changed ownership
  IF NOT EXISTS (
    SELECT 1 FROM schedule_shift
    WHERE schedule_shift_id = v_requester_shift_id
    AND employee_id = v_requester_profile_id
  ) THEN
    RAISE EXCEPTION 'Requester shift has changed since swap was requested';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM schedule_shift
    WHERE schedule_shift_id = v_target_shift_id
    AND employee_id = v_target_profile_id
  ) THEN
    RAISE EXCEPTION 'Target shift has changed since swap was requested';
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
        'executed_at', to_char(now(), 'YYYY-MM-DD"T"HH24:MI:SS"Z"')
      ),
      status = 'complete',
      completed_at = now(),
      updated_at = now()
  WHERE id = p_swap_id;
END;
$$;

-- ── Grant execute to authenticated users ────────────────────────────────────

GRANT EXECUTE ON FUNCTION public.initiate_shift_swap TO authenticated;
GRANT EXECUTE ON FUNCTION public.respond_to_shift_swap TO authenticated;
GRANT EXECUTE ON FUNCTION public.approve_shift_swap TO authenticated;
