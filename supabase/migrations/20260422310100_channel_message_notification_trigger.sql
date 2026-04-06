-- Notification trigger for the new channel_message schema.
--
-- The old trg_push_chat_message fires on chat_message (legacy schema).
-- This trigger fires on channel_message and inserts into notification_outbox,
-- which the auto-dispatch trigger then routes through process-notifications.
-- Skips system messages (message_type != 'user') and notifies all non-muted
-- channel members except the sender.

CREATE OR REPLACE FUNCTION trigger_channel_message_notification()
RETURNS trigger AS $$
DECLARE
  v_workspace_id UUID;
  v_channel_name TEXT;
  v_sender_name  TEXT;
  v_recipient    RECORD;
BEGIN
  -- Skip system/automated messages
  IF NEW.message_type IN ('system', 'brief', 'handoff', 'summary') THEN
    RETURN NEW;
  END IF;

  -- Resolve workspace and channel name
  SELECT c.workspace_id, c.name
    INTO v_workspace_id, v_channel_name
    FROM public.channel c
   WHERE c.id = NEW.channel_id;

  IF v_workspace_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Resolve sender display name
  SELECT p.display_name INTO v_sender_name
    FROM public.profile p
   WHERE p.profile_id = NEW.sender_id;

  -- Notify all channel members except sender (skip muted, skip left)
  FOR v_recipient IN
    SELECT cm.profile_id
      FROM public.channel_member cm
     WHERE cm.channel_id = NEW.channel_id
       AND cm.profile_id != NEW.sender_id
       AND cm.left_at IS NULL
       AND cm.is_muted = FALSE
  LOOP
    INSERT INTO public.notification_outbox (
      workspace_id, recipient_id, mode, priority,
      title, body, action_url,
      metadata, allowed_channels, status, scheduled_for
    ) VALUES (
      v_workspace_id,
      v_recipient.profile_id,
      'community',
      0,
      coalesce(v_sender_name, 'Ukjent'),
      LEFT(NEW.content, 120),
      format('/dashboard/komm/%s', NEW.channel_id),
      jsonb_build_object(
        'event_key', 'chat.message',
        'channel_id', NEW.channel_id,
        'channel_name', coalesce(v_channel_name, ''),
        'sender_name', coalesce(v_sender_name, ''),
        'preview', LEFT(NEW.content, 80),
        'message_id', NEW.id
      ),
      ARRAY['push', 'in_app']::notification_channel[],
      'pending',
      now()
    );
  END LOOP;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Never block message INSERT if notification fails
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_channel_message_notification
  AFTER INSERT ON channel_message
  FOR EACH ROW
  EXECUTE FUNCTION trigger_channel_message_notification();

COMMENT ON TRIGGER trg_channel_message_notification ON channel_message IS
  'Inserts into notification_outbox for each channel member on new message. Auto-dispatch trigger handles processing.';
