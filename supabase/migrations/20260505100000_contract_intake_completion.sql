-- Phase 1: Add ready_to_send status + intake completion/decline RPCs
-- Part of contract intake agent integration.

-- 1. Add ready_to_send to contract_status enum
ALTER TYPE public.contract_status ADD VALUE IF NOT EXISTS 'ready_to_send';

-- 2. check_contract_intake_completion RPC
-- Checks if all required PII fields are present on the employee's profile.
-- If complete: updates employment_contract status to ready_to_send,
-- inserts contract_event, and marks engine_state as complete.
CREATE OR REPLACE FUNCTION public.check_contract_intake_completion(
  p_profile_id UUID,
  p_workspace_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_profile RECORD;
  v_contract RECORD;
  v_all_present BOOLEAN;
BEGIN
  -- Load profile PII fields
  SELECT personal_number, bank_account, address_line_1, postal_code
  INTO v_profile
  FROM public.profile
  WHERE profile_id = p_profile_id
    AND workspace_id = p_workspace_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('complete', false, 'contract_id', null);
  END IF;

  -- Check all required fields are present
  v_all_present := (
    v_profile.personal_number IS NOT NULL
    AND v_profile.bank_account IS NOT NULL
    AND v_profile.address_line_1 IS NOT NULL
    AND v_profile.postal_code IS NOT NULL
  );

  IF NOT v_all_present THEN
    RETURN jsonb_build_object('complete', false, 'contract_id', null);
  END IF;

  -- Find the active pending_data contract
  SELECT contract_id, signing_contract_id
  INTO v_contract
  FROM public.employment_contract
  WHERE profile_id = p_profile_id
    AND workspace_id = p_workspace_id
    AND status = 'pending_data'
  ORDER BY created_at DESC
  LIMIT 1;

  IF NOT FOUND THEN
    -- All data present but no pending_data contract — still report complete
    RETURN jsonb_build_object('complete', true, 'contract_id', null);
  END IF;

  -- Update employment_contract status
  UPDATE public.employment_contract
  SET status = 'ready_to_send',
      updated_at = now()
  WHERE contract_id = v_contract.contract_id;

  -- Insert contract_event
  IF v_contract.signing_contract_id IS NOT NULL THEN
    INSERT INTO public.contract_event (
      contract_id, workspace_id, event_type, actor_type, actor_id, details
    ) VALUES (
      v_contract.signing_contract_id,
      p_workspace_id,
      'intake_complete',
      'system',
      p_profile_id,
      jsonb_build_object('employment_contract_id', v_contract.contract_id)
    );
  END IF;

  -- Mark engine_state as complete
  UPDATE public.engine_state
  SET status = 'complete',
      updated_at = now()
  WHERE entity_type = 'employment_contract'
    AND entity_id = v_contract.contract_id::text
    AND status = 'running';

  RETURN jsonb_build_object(
    'complete', true,
    'contract_id', v_contract.contract_id
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.check_contract_intake_completion(UUID, UUID)
  TO authenticated, service_role;

COMMENT ON FUNCTION public.check_contract_intake_completion(UUID, UUID) IS
  'Check if employee PII is complete. If so, transition contract from pending_data to ready_to_send.';

-- 3. decline_contract_intake RPC
-- Updates employment_contract status to declined + inserts contract_event.
CREATE OR REPLACE FUNCTION public.decline_contract_intake(
  p_profile_id UUID,
  p_workspace_id UUID,
  p_reason TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_contract RECORD;
BEGIN
  -- Find the active pending_data contract for this profile
  SELECT contract_id, signing_contract_id
  INTO v_contract
  FROM public.employment_contract
  WHERE profile_id = p_profile_id
    AND workspace_id = p_workspace_id
    AND status = 'pending_data'
  ORDER BY created_at DESC
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('declined', false, 'error', 'No pending_data contract found');
  END IF;

  -- Update employment_contract
  UPDATE public.employment_contract
  SET status = 'declined',
      updated_at = now()
  WHERE contract_id = v_contract.contract_id;

  -- Insert contract_event
  IF v_contract.signing_contract_id IS NOT NULL THEN
    INSERT INTO public.contract_event (
      contract_id, workspace_id, event_type, actor_type, actor_id, details
    ) VALUES (
      v_contract.signing_contract_id,
      p_workspace_id,
      'intake_declined',
      'user',
      p_profile_id,
      jsonb_build_object(
        'employment_contract_id', v_contract.contract_id,
        'reason', COALESCE(p_reason, 'No reason provided')
      )
    );
  END IF;

  -- Mark engine_state as failed
  UPDATE public.engine_state
  SET status = 'failed',
      updated_at = now()
  WHERE entity_type = 'employment_contract'
    AND entity_id = v_contract.contract_id::text
    AND status = 'running';

  RETURN jsonb_build_object(
    'declined', true,
    'contract_id', v_contract.contract_id
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.decline_contract_intake(UUID, UUID, TEXT)
  TO authenticated, service_role;

COMMENT ON FUNCTION public.decline_contract_intake(UUID, UUID, TEXT) IS
  'Employee declines contract data intake. Transitions contract to declined status.';
