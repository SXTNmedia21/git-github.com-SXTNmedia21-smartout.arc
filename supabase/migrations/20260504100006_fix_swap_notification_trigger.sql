-- Fix notify_swap_result trigger: replace process_key with process_id
-- The trigger was written against a schema that had a process_key column,
-- but engine_state uses process_id (TEXT). Every UPDATE to engine_state
-- was failing with "record new has no field process_key", silently rolling
-- back status updates (including wait_for_event → waiting transitions).

CREATE OR REPLACE FUNCTION notify_swap_result()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_status TEXT;
  v_old_status TEXT;
  v_requester_user_id UUID;
  v_target_user_id UUID;
  v_requester_name TEXT;
  v_target_name TEXT;
  v_workspace_id UUID;
  v_date TEXT;
BEGIN
  -- Only trigger on shift_swap process state changes
  IF NEW.process_id != 'shift_swap' THEN
    RETURN NEW;
  END IF;

  v_status := NEW.context->>'status';
  v_old_status := OLD.context->>'status';

  -- Skip if status didn't change
  IF v_status = v_old_status THEN
    RETURN NEW;
  END IF;

  v_workspace_id := NEW.workspace_id;
  v_date := COALESCE(NEW.context->>'shift_date', '');

  -- Resolve user IDs and names
  SELECT p.user_id, p.display_name INTO v_requester_user_id, v_requester_name
  FROM profile p WHERE p.profile_id = (NEW.context->>'requester_profile_id')::UUID;

  SELECT p.user_id, p.display_name INTO v_target_user_id, v_target_name
  FROM profile p WHERE p.profile_id = (NEW.context->>'target_profile_id')::UUID;

  IF v_status = 'approved' AND v_old_status = 'pending_requester_confirm' THEN
    -- Notify requester that swap is approved
    IF v_requester_user_id IS NOT NULL THEN
      PERFORM dispatch_swap_notification(
        v_workspace_id, v_requester_user_id,
        'shift.swap_approved',
        'Vaktbytte godkjent',
        'Vakten din er byttet med ' || COALESCE(v_target_name, 'kollega'),
        jsonb_build_object('swap_id', NEW.id, 'other_name', v_target_name, 'date', v_date)
      );
    END IF;
    -- Notify target
    IF v_target_user_id IS NOT NULL THEN
      PERFORM dispatch_swap_notification(
        v_workspace_id, v_target_user_id,
        'shift.swap_approved',
        'Vaktbytte godkjent',
        'Vakten din er byttet med ' || COALESCE(v_requester_name, 'kollega'),
        jsonb_build_object('swap_id', NEW.id, 'other_name', v_requester_name, 'date', v_date)
      );
    END IF;

  ELSIF v_status = 'rejected' THEN
    -- Notify requester that swap was rejected
    IF v_requester_user_id IS NOT NULL THEN
      PERFORM dispatch_swap_notification(
        v_workspace_id, v_requester_user_id,
        'shift.swap_rejected',
        'Vaktbytte avslått',
        'Byttforespørselen din ble avslått',
        jsonb_build_object('swap_id', NEW.id, 'date', v_date)
      );
    END IF;

  ELSIF v_status = 'cancelled' THEN
    -- Notify target that swap was cancelled
    IF v_target_user_id IS NOT NULL THEN
      PERFORM dispatch_swap_notification(
        v_workspace_id, v_target_user_id,
        'shift.swap_cancelled',
        'Vaktbytte kansellert',
        COALESCE(v_requester_name, 'Kollega') || ' kansellerte byttforespørselen',
        jsonb_build_object('swap_id', NEW.id, 'requester_name', v_requester_name, 'date', v_date)
      );
    END IF;
  END IF;

  RETURN NEW;
END;
$$;
