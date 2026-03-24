-- Fix push notification triggers that reference profile.id instead of profile.profile_id
-- The profile table uses profile_id as its PK, not id.

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

  FOR v_manager IN
    SELECT profile_id
    FROM public.profile
    WHERE workspace_id = NEW.workspace_id
      AND role IN ('manager', 'admin', 'owner')
      AND is_active = TRUE
      AND profile_id != COALESCE(NEW.reported_by, '00000000-0000-0000-0000-000000000000'::UUID)
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

CREATE OR REPLACE FUNCTION public.trigger_push_join_request()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_admin RECORD;
  v_name TEXT;
BEGIN
  IF NEW.direction != 'inbound' THEN
    RETURN NEW;
  END IF;

  v_name := COALESCE(NEW.first_name || ' ' || NEW.last_name, NEW.email, 'Noen');

  FOR v_admin IN
    SELECT profile_id
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
