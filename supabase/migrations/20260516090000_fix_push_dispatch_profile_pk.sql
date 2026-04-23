-- Fix push-dispatch join_request trigger to use profile.profile_id (the PK)
-- instead of the non-existent profile.id column.
--
-- Background:
--   The profile table's primary key is profile_id (there is no `id` column).
--   Migration 20260324065817_fix_push_triggers_profile_id.sql already
--   corrected deviation_reported + join_request to use profile_id.
--   Later, 20260418120000_push_dispatch_triggers.sql was authored against
--   the original (wrong) shape and re-introduced the bug in
--   trigger_push_join_request (SELECT id AS profile_id FROM public.profile).
--
-- Symptom:
--   Every push notification from the join_request trigger attempts to
--   notify admins via a UUID that is literally NULL-by-alias (the
--   non-existent `id` column). On a strict-mode Postgres this errors;
--   otherwise admins never receive the notification.
--
-- Fix:
--   Recreate trigger_push_join_request with `SELECT profile_id FROM public.profile`.
--   Companion fix in supabase/functions/push-dispatch/index.ts uses
--   .eq("profile_id", profile_id) on the Edge Function side (separate patch).

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

COMMENT ON FUNCTION public.trigger_push_join_request IS
  'Trigger: on inbound invitation, notify workspace admins/owners via push-dispatch. Fixed 2026-05-16 to use profile.profile_id (PK) after 20260418120000 regression.';
