-- M5: Add announcement guard to existing channel_message notification trigger.
-- ADR-0369 (Option B): Announcements fan-out is handled by publish_announcement_atomic
-- RPC body (fn_publish_announcement_notifications). The existing AFTER INSERT trigger
-- must skip announcement rows to prevent double fan-out and ensure announcement_meta
-- sidecar exists at notification time.
--
-- The rest of the trigger body is VERBATIM from
-- supabase/migrations/20260422310100_channel_message_notification_trigger.sql.
-- EXCEPTION handler, mute filter, sender exclusion, message-type skip-list all preserved.

CREATE OR REPLACE FUNCTION public.trigger_channel_message_notification()
RETURNS trigger AS $$
DECLARE
  v_workspace_id UUID;
  v_channel_name TEXT;
  v_sender_name  TEXT;
  v_recipient    RECORD;
BEGIN
  -- ADR-0369: Announcements fan-out is handled by publish_announcement_atomic
  -- RPC body (fn_publish_announcement_notifications). Skip here to prevent
  -- double fan-out and ensure sidecar row exists at notification time.
  IF NEW.message_type = 'announcement' THEN
    RETURN NEW;
  END IF;

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
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

-- Trigger is already created in 20260422310100_channel_message_notification_trigger.sql.
-- CREATE OR REPLACE FUNCTION above replaces the function body in-place.
-- Trigger binding (trg_channel_message_notification) is unchanged.
