-- Missed call notification trigger.
--
-- When a call session ends, check for participants who were invited but
-- never joined (joined_at IS NULL). For each, insert a "Missat samtal"
-- notification into the outbox.

CREATE OR REPLACE FUNCTION trigger_missed_call_notification()
RETURNS trigger AS $$
DECLARE
  v_caller_name  TEXT;
  v_channel_name TEXT;
  v_recipient    RECORD;
BEGIN
  -- Only fire when status transitions to 'ended'
  IF NEW.status != 'ended' OR OLD.status = 'ended' THEN
    RETURN NEW;
  END IF;

  -- Resolve caller name
  SELECT p.display_name INTO v_caller_name
    FROM public.profile p
   WHERE p.profile_id = NEW.started_by;

  -- Resolve channel name
  SELECT c.name INTO v_channel_name
    FROM public.channel c
   WHERE c.id = NEW.channel_id;

  -- Find participants who never joined (missed the call)
  FOR v_recipient IN
    SELECT cp.profile_id
      FROM public.channel_call_participant cp
     WHERE cp.call_session_id = NEW.id
       AND cp.joined_at IS NULL
       AND cp.profile_id != NEW.started_by
  LOOP
    INSERT INTO public.notification_outbox (
      workspace_id, recipient_id, mode, priority,
      title, body, action_url,
      metadata, allowed_channels, status, scheduled_for
    ) VALUES (
      NEW.workspace_id,
      v_recipient.profile_id,
      'community',
      1,
      coalesce(v_caller_name, 'Ukjent'),
      '',
      format('/dashboard/komm/%s', NEW.channel_id),
      jsonb_build_object(
        'event_key', 'call.missed',
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

CREATE TRIGGER trg_missed_call_notification
  AFTER UPDATE ON channel_call_session
  FOR EACH ROW
  EXECUTE FUNCTION trigger_missed_call_notification();

COMMENT ON TRIGGER trg_missed_call_notification ON channel_call_session IS
  'Creates "Missat samtal" notification for participants who never joined a call.';
