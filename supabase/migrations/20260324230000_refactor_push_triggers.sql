-- Refactor push triggers: INSERT into notification_outbox instead of calling dispatch_push_notification
--
-- Before: each trigger called dispatch_push_notification() which fired a synchronous pg_net HTTP
-- request to the push-dispatch Edge Function. This was fire-and-forget with no retry, no audit trail.
--
-- After: each trigger INSERTs into notification_outbox. The outbox consumer Edge Function
-- (polled every 30s, or immediately for priority=2) handles delivery with retry and routing.
--
-- The title field stores the event_key (dot notation). The consumer resolves i18n and body
-- interpolation from the event config registry — see packages/notifications/src/eventRegistry.ts.
--
-- dispatch_push_notification() is NOT dropped — it is still used by the push-dispatch Edge Function
-- for direct calls. Only the 6 trigger function bodies are replaced here.
--
-- Trigger definitions (CREATE TRIGGER) are unchanged — same events, same tables, same WHEN clauses.


-- ── Trigger 1: Shift published ───────────────────────────────────────────────
-- Fires when a shift is inserted with is_published=true and an assigned employee.
-- Priority 1 (high) — employee needs to know about their schedule promptly.

CREATE OR REPLACE FUNCTION public.trigger_push_shift_published()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF NEW.is_published = TRUE AND NEW.employee_id IS NOT NULL THEN
    INSERT INTO notification_outbox (
      workspace_id, recipient_id, mode, priority,
      title, body, action_url, metadata, allowed_channels
    ) VALUES (
      NEW.workspace_id,
      NEW.employee_id,
      'work',
      1,
      'shift.published',
      '',
      format('/dashboard/my-schedule?date=%s', NEW.shift_date),
      jsonb_build_object(
        'event_key',     'shift.published',
        'department_id', NEW.department_id,
        'date',          NEW.shift_date,
        'start_time',    NEW.start_time,
        'shift_id',      NEW.schedule_shift_id
      ),
      ARRAY['push', 'email', 'in_app']::notification_channel[]
    );
  END IF;
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.trigger_push_shift_published IS
  'Outbox trigger: queues a shift.published notification when a new published shift is assigned to an employee.';


-- ── Trigger 2: Shift updated (time/date change) ──────────────────────────────
-- Fires when a published shift's start time, end time, or date changes.
-- IS DISTINCT FROM guards ensure we only fire on actual value changes.

CREATE OR REPLACE FUNCTION public.trigger_push_shift_updated()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF NEW.is_published = TRUE AND NEW.employee_id IS NOT NULL THEN
    IF OLD.start_time IS DISTINCT FROM NEW.start_time
       OR OLD.end_time IS DISTINCT FROM NEW.end_time
       OR OLD.shift_date IS DISTINCT FROM NEW.shift_date THEN
      INSERT INTO notification_outbox (
        workspace_id, recipient_id, mode, priority,
        title, body, action_url, metadata, allowed_channels
      ) VALUES (
        NEW.workspace_id,
        NEW.employee_id,
        'work',
        1,
        'shift.updated',
        '',
        format('/dashboard/my-schedule?date=%s', NEW.shift_date),
        jsonb_build_object(
          'event_key',     'shift.updated',
          'department_id', NEW.department_id,
          'date',          NEW.shift_date,
          'start_time',    NEW.start_time,
          'shift_id',      NEW.schedule_shift_id
        ),
        ARRAY['push', 'email', 'in_app']::notification_channel[]
      );
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.trigger_push_shift_updated IS
  'Outbox trigger: queues a shift.updated notification when a published shift time or date changes.';


-- ── Trigger 3: Task assigned ──────────────────────────────────────────────────
-- Fires when a session_task is created or updated with a new assigned_to profile.
-- Priority 0 (normal) — task assignment is informational, not time-critical.

CREATE OR REPLACE FUNCTION public.trigger_push_task_assigned()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF NEW.assigned_to IS NOT NULL THEN
    IF TG_OP = 'INSERT' OR (TG_OP = 'UPDATE' AND OLD.assigned_to IS DISTINCT FROM NEW.assigned_to) THEN
      INSERT INTO notification_outbox (
        workspace_id, recipient_id, mode, priority,
        title, body, action_url, metadata, allowed_channels
      ) VALUES (
        NEW.workspace_id,
        NEW.assigned_to,
        'work',
        0,
        'task.assigned',
        '',
        NULL,
        jsonb_build_object(
          'event_key',  'task.assigned',
          'task_id',    NEW.id,
          'session_id', NEW.session_id
        ),
        ARRAY['push', 'in_app']::notification_channel[]
      );
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.trigger_push_task_assigned IS
  'Outbox trigger: queues a task.assigned notification when a task gains an assignee.';


-- ── Trigger 4: Chat message ───────────────────────────────────────────────────
-- Fires on new non-system chat messages. Loops through all active, non-muted
-- conversation participants excluding the sender.
-- Priority 0 (normal) — chat is community mode.

CREATE OR REPLACE FUNCTION public.trigger_push_chat_message()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_workspace_id UUID;
  v_recipient    RECORD;
BEGIN
  -- Skip system messages (WHEN clause also guards this, but belt-and-suspenders)
  IF NEW.is_system = TRUE THEN
    RETURN NEW;
  END IF;

  -- Resolve workspace_id from the conversation (not stored on chat_message directly)
  SELECT workspace_id INTO v_workspace_id
  FROM public.chat_conversation
  WHERE id = NEW.conversation_id;

  IF v_workspace_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Queue one outbox row per recipient — the consumer dispatches per-channel
  FOR v_recipient IN
    SELECT cp.profile_id
    FROM public.chat_participant cp
    WHERE cp.conversation_id = NEW.conversation_id
      AND cp.profile_id != NEW.sender_id
      AND cp.left_at IS NULL
      AND cp.is_muted = FALSE
  LOOP
    INSERT INTO notification_outbox (
      workspace_id, recipient_id, mode, priority,
      title, body, action_url, metadata, allowed_channels
    ) VALUES (
      v_workspace_id,
      v_recipient.profile_id,
      'community',
      0,
      'chat.message',
      '',
      NULL,
      jsonb_build_object(
        'event_key',       'chat.message',
        'channel_id',      NEW.conversation_id,
        'conversation_id', NEW.conversation_id
      ),
      ARRAY['push', 'in_app']::notification_channel[]
    );
  END LOOP;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.trigger_push_chat_message IS
  'Outbox trigger: queues a chat.message notification for each non-muted participant in the conversation.';


-- ── Trigger 5: Deviation reported (managers/admins) ──────────────────────────
-- Fires when a deviation is created. Loops through all managers, admins, and owners
-- in the workspace, excluding the reporter themselves.
-- Priority 2 (urgent) — deviations may indicate safety or compliance issues.

CREATE OR REPLACE FUNCTION public.trigger_push_deviation_reported()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_manager RECORD;
BEGIN
  FOR v_manager IN
    SELECT profile_id
    FROM public.profile
    WHERE workspace_id = NEW.workspace_id
      AND role IN ('manager', 'admin', 'owner')
      AND is_active = TRUE
      AND profile_id != COALESCE(NEW.reported_by, '00000000-0000-0000-0000-000000000000'::UUID)
  LOOP
    INSERT INTO notification_outbox (
      workspace_id, recipient_id, mode, priority,
      title, body, action_url, metadata, allowed_channels
    ) VALUES (
      NEW.workspace_id,
      v_manager.profile_id,
      'work',
      2,
      'deviation.reported',
      '',
      NULL,
      jsonb_build_object(
        'event_key',    'deviation.reported',
        'deviation_id', NEW.deviation_id
      ),
      ARRAY['push', 'sms', 'email', 'in_app']::notification_channel[]
    );
  END LOOP;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.trigger_push_deviation_reported IS
  'Outbox trigger: queues an urgent deviation.reported notification for all managers/admins in the workspace.';


-- ── Trigger 6: Join request (inbound invitation) ──────────────────────────────
-- Fires when someone requests to join the workspace (direction = inbound).
-- Loops through all admins and owners to let them review the request.
-- Priority 1 (high) — pending members should not wait long for approval.

CREATE OR REPLACE FUNCTION public.trigger_push_join_request()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_admin RECORD;
BEGIN
  -- Only fire for inbound requests (WHEN clause also guards this)
  IF NEW.direction != 'inbound' THEN
    RETURN NEW;
  END IF;

  FOR v_admin IN
    SELECT profile_id
    FROM public.profile
    WHERE workspace_id = NEW.workspace_id
      AND role IN ('admin', 'owner')
      AND is_active = TRUE
  LOOP
    INSERT INTO notification_outbox (
      workspace_id, recipient_id, mode, priority,
      title, body, action_url, metadata, allowed_channels
    ) VALUES (
      NEW.workspace_id,
      v_admin.profile_id,
      'work',
      1,
      'join.request',
      '',
      NULL,
      jsonb_build_object(
        'event_key',    'join.request',
        'invitation_id', NEW.invitation_id
      ),
      ARRAY['push', 'email', 'in_app']::notification_channel[]
    );
  END LOOP;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.trigger_push_join_request IS
  'Outbox trigger: queues a join.request notification for all admins/owners when an inbound invite arrives.';
