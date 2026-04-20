-- Add notification dispatching to shift swap RPCs
-- When a swap is initiated, notify the target employee
-- When a swap is approved/rejected, notify both parties

-- Helper: insert a notification into the outbox
CREATE OR REPLACE FUNCTION dispatch_swap_notification(
  p_workspace_id UUID,
  p_recipient_id UUID,
  p_event_key TEXT,
  p_title TEXT,
  p_body TEXT,
  p_metadata JSONB DEFAULT '{}'
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO notification_outbox (
    workspace_id, recipient_id, mode, priority, title, body,
    action_url, metadata, allowed_channels
  ) VALUES (
    p_workspace_id,
    p_recipient_id,
    'work',
    CASE WHEN p_event_key LIKE '%approved%' THEN 1 ELSE 0 END,
    p_title,
    p_body,
    '/dashboard/schedule',
    jsonb_build_object('event_key', p_event_key, 'icon_type', 'shift', 'source', 'shift_swap') || p_metadata,
    ARRAY['push', 'in_app']
  );
END;
$$;

-- Patch initiate_shift_swap to notify recipient
CREATE OR REPLACE FUNCTION initiate_shift_swap(
  p_requester_shift_id UUID,
  p_target_profile_id UUID,
  p_target_shift_id UUID,
  p_reason TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_requester_profile_id UUID;
  v_requester_name TEXT;
  v_workspace_id UUID;
  v_target_user_id UUID;
  v_shift_date DATE;
  v_state_id UUID;
  v_process_id UUID;
BEGIN
  -- Resolve requester profile
  SELECT p.profile_id, p.display_name, p.workspace_id
  INTO v_requester_profile_id, v_requester_name, v_workspace_id
  FROM profile p
  WHERE p.user_id = auth.uid() AND p.is_active = true
  LIMIT 1;

  IF v_requester_profile_id IS NULL THEN
    RAISE EXCEPTION 'Profile not found';
  END IF;

  -- Get shift date for notification
  SELECT shift_date INTO v_shift_date
  FROM schedule_shift WHERE schedule_shift_id = p_requester_shift_id;

  -- Get target user_id for notification
  SELECT p.user_id INTO v_target_user_id
  FROM profile p WHERE p.profile_id = p_target_profile_id;

  -- Get shift_swap process
  SELECT process_id INTO v_process_id
  FROM engine_process WHERE process_key = 'shift_swap' LIMIT 1;

  IF v_process_id IS NULL THEN
    RAISE EXCEPTION 'shift_swap engine process not found';
  END IF;

  -- Create engine state
  INSERT INTO engine_state (
    process_id, process_key, workspace_id, current_step, step_status, context
  ) VALUES (
    v_process_id,
    'shift_swap',
    v_workspace_id,
    1,
    'active',
    jsonb_build_object(
      'requester_profile_id', v_requester_profile_id,
      'target_profile_id', p_target_profile_id,
      'requester_shift_id', p_requester_shift_id,
      'target_shift_id', p_target_shift_id,
      'swap_type', 'mutual_exchange',
      'reason', COALESCE(p_reason, ''),
      'status', 'pending_recipient'
    )
  )
  RETURNING state_id INTO v_state_id;

  -- Notify the target employee
  PERFORM dispatch_swap_notification(
    v_workspace_id,
    v_target_user_id,
    'shift.swap_initiated',
    'Byttforespørsel mottatt',
    v_requester_name || ' vil bytte vakt med deg (' || v_shift_date::TEXT || ')',
    jsonb_build_object('swap_id', v_state_id, 'requester_name', v_requester_name, 'date', v_shift_date)
  );

  RETURN v_state_id;
END;
$$;

-- Patch approve_shift_swap to notify both parties
-- (The existing approve function swaps employee_ids; we add notifications after)
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
  IF NEW.process_key != 'shift_swap' THEN
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

  IF v_status = 'approved' OR v_status = 'executed' THEN
    -- Notify requester
    IF v_requester_user_id IS NOT NULL THEN
      PERFORM dispatch_swap_notification(
        v_workspace_id, v_requester_user_id,
        'shift.swap_approved',
        'Vaktbytte godkjent',
        'Vakten din er byttet med ' || COALESCE(v_target_name, 'kollega'),
        jsonb_build_object('swap_id', NEW.state_id, 'other_name', v_target_name, 'date', v_date)
      );
    END IF;
    -- Notify target
    IF v_target_user_id IS NOT NULL THEN
      PERFORM dispatch_swap_notification(
        v_workspace_id, v_target_user_id,
        'shift.swap_approved',
        'Vaktbytte godkjent',
        'Vakten din er byttet med ' || COALESCE(v_requester_name, 'kollega'),
        jsonb_build_object('swap_id', NEW.state_id, 'other_name', v_requester_name, 'date', v_date)
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
        jsonb_build_object('swap_id', NEW.state_id, 'date', v_date)
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
        jsonb_build_object('swap_id', NEW.state_id, 'requester_name', v_requester_name, 'date', v_date)
      );
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- Create trigger on engine_state for swap notifications
DROP TRIGGER IF EXISTS trg_swap_notification ON engine_state;
CREATE TRIGGER trg_swap_notification
  AFTER UPDATE ON engine_state
  FOR EACH ROW
  EXECUTE FUNCTION notify_swap_result();
