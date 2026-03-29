-- Fix: trigger_push_deviation_reported() references "id" instead of "profile_id"
-- on the profile table. The profile PK is profile_id, not id.

CREATE OR REPLACE FUNCTION public.trigger_push_deviation_reported()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  v_manager RECORD;
  v_body TEXT;
BEGIN
  v_body := COALESCE(NEW.severity::TEXT, 'unknown') || ': ' ||
            NEW.title;

  -- Notify all managers and admins in the workspace
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
$function$;
