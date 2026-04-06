-- Incoming call notification trigger.
--
-- When a call session is created, notify all channel members (except caller)
-- with an "Innkommende samtale" notification so the bell rings on web
-- even if Realtime broadcast signaling doesn't reach.

CREATE OR REPLACE FUNCTION trigger_incoming_call_notification()
RETURNS trigger AS $$
DECLARE
  v_caller_name  TEXT;
  v_channel_name TEXT;
  v_recipient    RECORD;
BEGIN
  -- Resolve caller name
  SELECT p.display_name INTO v_caller_name
    FROM public.profile p
   WHERE p.profile_id = NEW.started_by;

  -- Resolve channel name
  SELECT c.name INTO v_channel_name
    FROM public.channel c
   WHERE c.id = NEW.channel_id;

  -- Notify all channel members except the caller
  FOR v_recipient IN
    SELECT cm.profile_id
      FROM public.channel_member cm
     WHERE cm.channel_id = NEW.channel_id
       AND cm.profile_id != NEW.started_by
       AND cm.left_at IS NULL
       AND cm.is_muted = FALSE
  LOOP
    INSERT INTO public.notification_outbox (
      workspace_id, recipient_id, mode, priority,
      title, body, action_url,
      metadata, allowed_channels, status, scheduled_for
    ) VALUES (
      NEW.workspace_id,
      v_recipient.profile_id,
      'community',
      2,
      coalesce(v_caller_name, 'Ukjent'),
      '',
      format('/dashboard/komm/%s', NEW.channel_id),
      jsonb_build_object(
        'event_key', 'call.incoming',
        'channel_id', NEW.channel_id,
        'channel_name', coalesce(v_channel_name, ''),
        'caller_name', coalesce(v_caller_name, ''),
        'call_session_id', NEW.id
      ),
      ARRAY['push', 'in_app']::notification_channel[],
      'pending',
      now()
    );
  END LOOP;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_incoming_call_notification
  AFTER INSERT ON channel_call_session
  FOR EACH ROW
  EXECUTE FUNCTION trigger_incoming_call_notification();

COMMENT ON TRIGGER trg_incoming_call_notification ON channel_call_session IS
  'Notifies channel members when a call starts. Priority 2 (critical) for immediate processing.';
