-- Migration: cancel_shift_swap_rpc
-- Allows the requester to cancel a pending shift swap before it's resolved.
-- Only cancellable in 'pending_recipient' or 'pending_manager' status.

CREATE OR REPLACE FUNCTION public.cancel_shift_swap(p_swap_id UUID)
RETURNS SETOF engine_state
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_state engine_state%ROWTYPE;
  v_profile_id UUID;
  v_status TEXT;
BEGIN
  -- Get caller's profile
  SELECT profile_id INTO v_profile_id
  FROM profile
  WHERE user_id = auth.uid()
    AND is_active = true
  LIMIT 1;

  IF v_profile_id IS NULL THEN
    RAISE EXCEPTION 'Profile not found';
  END IF;

  -- Get swap state
  SELECT * INTO v_state
  FROM engine_state
  WHERE id = p_swap_id
    AND process_id = 'shift_swap';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Swap not found';
  END IF;

  -- Check caller is requester
  IF v_state.context->>'requester_profile_id' != v_profile_id::TEXT THEN
    RAISE EXCEPTION 'Only the requester can cancel';
  END IF;

  -- Check cancellable status
  v_status := v_state.context->>'status';
  IF v_status NOT IN ('pending_recipient', 'pending_manager') THEN
    RAISE EXCEPTION 'Cannot cancel swap in status: %', v_status;
  END IF;

  -- Cancel
  UPDATE engine_state
  SET context = context || jsonb_build_object('status', 'cancelled'),
      status = 'complete',
      completed_at = now(),
      updated_at = now()
  WHERE id = p_swap_id;

  RETURN QUERY SELECT * FROM engine_state WHERE id = p_swap_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.cancel_shift_swap TO authenticated;
