-- Push dispatch triggers — fire push notifications via Edge Function
--
-- Each trigger calls the push-dispatch Edge Function via pg_net (http_post).
-- pg_net is fire-and-forget: failures drop silently (acceptable for V1).
-- The Edge Function handles Expo Push API delivery and SMS fallback.
--
-- Auth: PUSH_DISPATCH_SECRET bearer token passed via current_setting().
-- Must be set in Supabase project settings or vault.

-- ── Helper: build push-dispatch HTTP request ──────────────────────────
-- Centralizes the pg_net call so trigger functions stay clean.

CREATE OR REPLACE FUNCTION public.dispatch_push_notification(
  p_event TEXT,
  p_profile_id UUID,
  p_workspace_id UUID,
  p_title TEXT,
  p_body TEXT,
  p_data JSONB DEFAULT '{}'::JSONB
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_base_url TEXT;
  v_secret TEXT;
  v_payload JSONB;
BEGIN
  v_base_url := current_setting('app.supabase_url', true);
  v_secret := current_setting('app.push_dispatch_secret', true);

  -- Skip if not configured (local dev without push setup)
  IF v_base_url IS NULL OR v_secret IS NULL THEN
    RAISE NOTICE 'push-dispatch: missing config, skipping (event=%, profile=%)', p_event, p_profile_id;
    RETURN;
  END IF;

  v_payload := jsonb_build_object(
    'event', p_event,
    'profile_id', p_profile_id,
    'workspace_id', p_workspace_id,
    'payload', jsonb_build_object(
      'title', p_title,
      'body', p_body,
      'data', p_data
    )
  );

  -- Fire-and-forget via pg_net
  PERFORM net.http_post(
    url := v_base_url || '/functions/v1/push-dispatch',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || v_secret
    ),
    body := v_payload
  );
END;
$$;

COMMENT ON FUNCTION public.dispatch_push_notification IS
  'Helper: sends a push notification via push-dispatch Edge Function. Fire-and-forget via pg_net.';


-- ── Trigger 1: Shift published ───────────────────────────────────────
-- Fires when a shift is inserted with is_published = true and has an employee assigned.

CREATE OR REPLACE FUNCTION public.trigger_push_shift_published()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Only fire for published shifts with an assigned employee
  IF NEW.is_published = TRUE AND NEW.employee_id IS NOT NULL THEN
    PERFORM dispatch_push_notification(
      'shift_published',
      NEW.employee_id,
      NEW.workspace_id,
      'Ny vakt',
      TO_CHAR(NEW.shift_date, 'Dy DD. Mon') || ', ' ||
        TO_CHAR(NEW.start_time::TIME, 'HH24:MI') || '–' ||
        TO_CHAR(NEW.end_time::TIME, 'HH24:MI'),
      jsonb_build_object('shift_id', NEW.schedule_shift_id)
    );
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_push_shift_published
  AFTER INSERT ON public.schedule_shift
  FOR EACH ROW
  WHEN (NEW.is_published = TRUE AND NEW.employee_id IS NOT NULL)
  EXECUTE FUNCTION public.trigger_push_shift_published();


-- ── Trigger 2: Shift updated (time change) ──────────────────────────
-- Fires when a published shift's start/end time or date changes.

CREATE OR REPLACE FUNCTION public.trigger_push_shift_updated()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Only notify if the shift is published and has an employee
  IF NEW.is_published = TRUE AND NEW.employee_id IS NOT NULL THEN
    -- Only fire if time or date actually changed
    IF OLD.start_time IS DISTINCT FROM NEW.start_time
       OR OLD.end_time IS DISTINCT FROM NEW.end_time
       OR OLD.shift_date IS DISTINCT FROM NEW.shift_date THEN
      PERFORM dispatch_push_notification(
        'shift_updated',
        NEW.employee_id,
        NEW.workspace_id,
        'Vakt endret',
        TO_CHAR(NEW.shift_date, 'Dy DD. Mon') || ', ' ||
          TO_CHAR(NEW.start_time::TIME, 'HH24:MI') || '–' ||
          TO_CHAR(NEW.end_time::TIME, 'HH24:MI'),
        jsonb_build_object('shift_id', NEW.schedule_shift_id)
      );
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_push_shift_updated
  AFTER UPDATE ON public.schedule_shift
  FOR EACH ROW
  WHEN (NEW.is_published = TRUE AND NEW.employee_id IS NOT NULL)
  EXECUTE FUNCTION public.trigger_push_shift_updated();


-- ── Trigger 3: Task assigned ─────────────────────────────────────────
-- Fires when a session_task is created or updated with an assigned_to profile.

CREATE OR REPLACE FUNCTION public.trigger_push_task_assigned()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Only fire if assigned_to is set (and changed on UPDATE)
  IF NEW.assigned_to IS NOT NULL THEN
    IF TG_OP = 'INSERT' OR (TG_OP = 'UPDATE' AND OLD.assigned_to IS DISTINCT FROM NEW.assigned_to) THEN
      PERFORM dispatch_push_notification(
        'task_assigned',
        NEW.assigned_to,
        NEW.workspace_id,
        'Ny oppgave',
        NEW.title,
        jsonb_build_object('task_id', NEW.id)
      );
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_push_task_assigned
  AFTER INSERT OR UPDATE ON public.session_task
  FOR EACH ROW
  WHEN (NEW.assigned_to IS NOT NULL)
  EXECUTE FUNCTION public.trigger_push_task_assigned();


-- ── Trigger 4: Chat message ──────────────────────────────────────────
-- Fires on new chat messages. The Edge Function should ideally check if
-- the recipient is offline, but for V1 we send all and let the mobile
-- notification handler decide whether to show it (foreground = in-app banner).

CREATE OR REPLACE FUNCTION public.trigger_push_chat_message()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_workspace_id UUID;
  v_recipient RECORD;
BEGIN
  -- Skip system messages
  IF NEW.is_system = TRUE THEN
    RETURN NEW;
  END IF;

  -- Resolve workspace from chat_conversation
  SELECT workspace_id INTO v_workspace_id
  FROM public.chat_conversation
  WHERE id = NEW.conversation_id;

  IF v_workspace_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Notify all conversation participants except the sender
  FOR v_recipient IN
    SELECT cp.profile_id
    FROM public.chat_participant cp
    WHERE cp.conversation_id = NEW.conversation_id
      AND cp.profile_id != NEW.sender_id
      AND cp.left_at IS NULL
      AND cp.is_muted = FALSE
  LOOP
    PERFORM dispatch_push_notification(
      'chat_message',
      v_recipient.profile_id,
      v_workspace_id,
      'Ny melding',
      LEFT(NEW.content, 80),
      jsonb_build_object('conversation_id', NEW.conversation_id)
    );
  END LOOP;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_push_chat_message
  AFTER INSERT ON public.chat_message
  FOR EACH ROW
  WHEN (NEW.is_system = FALSE)
  EXECUTE FUNCTION public.trigger_push_chat_message();


-- ── Trigger 5: Deviation reported (to managers) ──────────────────────
-- Notifies all managers in the workspace when a deviation is created.

CREATE OR REPLACE FUNCTION public.trigger_push_deviation_reported()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_manager RECORD;
  v_body TEXT;
BEGIN
  v_body := COALESCE(NEW.severity::TEXT, 'unknown') || ': ' ||
            NEW.title;

  -- Notify all managers and admins in the workspace
  FOR v_manager IN
    SELECT id AS profile_id
    FROM public.profile
    WHERE workspace_id = NEW.workspace_id
      AND role IN ('manager', 'admin', 'owner')
      AND is_active = TRUE
      AND id != COALESCE(NEW.reported_by, '00000000-0000-0000-0000-000000000000'::UUID)
  LOOP
    PERFORM dispatch_push_notification(
      'deviation_reported',
      v_manager.profile_id,
      NEW.workspace_id,
      'Avvik rapportert',
      v_body,
      jsonb_build_object('deviation_id', NEW.deviation_id)
    );
  END LOOP;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_push_deviation_reported
  AFTER INSERT ON public.deviation
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_push_deviation_reported();


-- ── Trigger 6: Join request (inbound invitation) ─────────────────────
-- Notifies admins when someone requests to join the workspace.

CREATE OR REPLACE FUNCTION public.trigger_push_join_request()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_admin RECORD;
  v_name TEXT;
BEGIN
  -- Only fire for inbound join requests
  IF NEW.direction != 'inbound' THEN
    RETURN NEW;
  END IF;

  v_name := COALESCE(NEW.first_name || ' ' || NEW.last_name, NEW.email, 'Noen');

  -- Notify all admins and owners in the workspace
  FOR v_admin IN
    SELECT id AS profile_id
    FROM public.profile
    WHERE workspace_id = NEW.workspace_id
      AND role IN ('admin', 'owner')
      AND is_active = TRUE
  LOOP
    PERFORM dispatch_push_notification(
      'join_request',
      v_admin.profile_id,
      NEW.workspace_id,
      'Ny forespørsel',
      v_name || ' vil bli med',
      jsonb_build_object('invitation_id', NEW.invitation_id)
    );
  END LOOP;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_push_join_request
  AFTER INSERT ON public.invitation
  FOR EACH ROW
  WHEN (NEW.direction = 'inbound')
  EXECUTE FUNCTION public.trigger_push_join_request();
