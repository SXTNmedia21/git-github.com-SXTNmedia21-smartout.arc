-- 20260417141000_fix_contract_intake_engine_state_filter.sql
-- Fix ultrareview rp6ofqyfv bug_007
--
-- check_contract_intake_completion (20260505100000:84-89) and
-- decline_contract_intake (20260505100000:157-162) filter their
-- engine_state transition UPDATE on status='running'. But 'running'
-- is not a valid value — the engine_state.status CHECK constraint
-- (migrations 20260304100000:138 + 20260505110000:19) only accepts
-- 'pending','active','waiting','complete','failed','escalated','blocked'.
--
-- No code path ever writes 'running'. engine-dispatch inserts rows
-- with status='active'; the blueprint wait_for_event handler transitions
-- to 'waiting'. The filter therefore matches ZERO rows every call.
-- employment_contract transitions to ready_to_send / declined correctly,
-- but the paired engine_state row is stuck in 'active' or 'waiting'
-- forever. Observability shows the run as still-live; downstream
-- wait-on-state steps never fire.
--
-- Fix: replace `status='running'` with `status IN ('active','waiting')`
-- in both RPCs. Body otherwise copied verbatim from 20260505100000.

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

  -- FIXED 2026-04-17: engine_state uses ('pending','active','waiting',
  -- 'complete','failed','escalated','blocked'); 'running' has never been
  -- valid. Filter on the values that actually occur for an in-flight run.
  UPDATE public.engine_state
  SET status = 'complete',
      updated_at = now()
  WHERE entity_type = 'employment_contract'
    AND entity_id = v_contract.contract_id::text
    AND status IN ('active', 'waiting');

  RETURN jsonb_build_object(
    'complete', true,
    'contract_id', v_contract.contract_id
  );
END;
$$;

COMMENT ON FUNCTION public.check_contract_intake_completion(UUID, UUID) IS
  'Check if employee PII is complete. If so, transition contract from pending_data to ready_to_send. '
  'Engine_state filter fixed 2026-04-17 (ultrareview rp6ofqyfv bug_007).';

-- decline_contract_intake: same engine_state-filter fix.
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

  -- FIXED 2026-04-17: same engine_state filter fix as check_contract_intake_completion.
  UPDATE public.engine_state
  SET status = 'failed',
      updated_at = now()
  WHERE entity_type = 'employment_contract'
    AND entity_id = v_contract.contract_id::text
    AND status IN ('active', 'waiting');

  RETURN jsonb_build_object(
    'declined', true,
    'contract_id', v_contract.contract_id
  );
END;
$$;

COMMENT ON FUNCTION public.decline_contract_intake(UUID, UUID, TEXT) IS
  'Employee declines contract data intake. Transitions contract to declined status. '
  'Engine_state filter fixed 2026-04-17 (ultrareview rp6ofqyfv bug_007).';
