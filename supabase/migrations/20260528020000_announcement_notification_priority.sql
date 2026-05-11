-- Announcement notification priority bump
-- Branch on NEW.message_type: announcement → priority=1, mode='work';
-- all other types → priority=0, mode='community' (preserves prior behavior).
--
-- Why: announcements competing on the same priority as casual chat trains users
-- to ignore push notifications (Council verdict 2026-05-10, item A).

CREATE OR REPLACE FUNCTION trigger_channel_message_notification()
RETURNS trigger AS $$
DECLARE
  v_workspace_id UUID;
  v_channel_name TEXT;
  v_sender_name  TEXT;
  v_recipient    RECORD;
  v_priority     smallint;
  v_mode         notification_mode;
BEGIN
  -- Skip system/automated messages
  IF NEW.message_type IN ('system', 'brief', 'handoff', 'summary') THEN
    RETURN NEW;
  END IF;

  -- Branch on message_type for priority + mode
  IF NEW.message_type = 'announcement' THEN
    v_priority := 1;
    v_mode     := 'work';
  ELSE
    v_priority := 0;
    v_mode     := 'community';
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
      v_mode,
      v_priority,
      coalesce(v_sender_name, 'Ukjent'),
      LEFT(NEW.content, 120),
      format('/dashboard/komm/%s', NEW.channel_id),
      jsonb_build_object(
        'event_key', CASE WHEN NEW.message_type = 'announcement' THEN 'announcement.published' ELSE 'chat.message' END,
        'channel_id', NEW.channel_id,
        'channel_name', coalesce(v_channel_name, ''),
        'sender_name', coalesce(v_sender_name, ''),
        'message_type', NEW.message_type::text,
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

-- Trigger definition unchanged; CREATE OR REPLACE FUNCTION above replaces body only.

COMMENT ON FUNCTION trigger_channel_message_notification() IS
  'Inserts into notification_outbox for each non-muted channel member on new message. Announcements get priority=1, mode=work; other types get priority=0, mode=community.';
