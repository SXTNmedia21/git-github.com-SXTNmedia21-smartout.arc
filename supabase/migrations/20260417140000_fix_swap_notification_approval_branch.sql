-- 20260417140000_fix_swap_notification_approval_branch.sql
-- Fix ultrareview rp6ofqyfv bug_016
--
-- notify_swap_result trigger at 20260504100006:46 gated the approval
-- notification branch on v_status='approved' AND v_old_status='pending_requester_confirm'.
-- Neither value is ever written anywhere in the codebase — approve_shift_swap
-- writes context.status='executed' (migrations 20260413123343:295 +
-- 20260413132826:135), and the state machine only uses 'pending_recipient',
-- 'pending_manager', 'executed', 'rejected', 'cancelled'.
--
-- Net effect: every approved swap flipped schedule_shift.employee_id
-- correctly but silently dropped the "Vaktbytte godkjent" push/in_app
-- notification to both requester and target. This was a user-visible
-- regression that the predecessor migration 20260504100005:161 handled
-- correctly with v_status IN ('approved','executed').
--
-- Body copied verbatim from 20260504100006 with ONE change:
-- the approval branch condition at line 46 now gates on
-- v_status='executed' AND v_old_status='pending_manager' — the exact
-- transition the state machine produces.
--
-- Rejected and cancelled branches are untouched (they use 'rejected' and
-- 'cancelled' which the state machine actually writes).

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

  -- FIXED 2026-04-17: condition matches the actual state machine.
  -- approve_shift_swap writes context.status='executed' (migration
  -- 20260413123343:295 + 20260413132826:135) transitioning from
  -- 'pending_manager'. Prior gate 'approved' AND 'pending_requester_confirm'
  -- was unreachable — neither value is ever written.
  IF v_status = 'executed' AND v_old_status = 'pending_manager' THEN
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
