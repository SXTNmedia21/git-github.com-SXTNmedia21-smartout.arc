-- ============================================
-- 20260516150000_push_dispatch_clockout_link.sql
--
-- M2 Phase F — adds a push-dispatch trigger that fires when a
-- department_session transitions active -> pending_signoff. The push
-- carries a deep-link to the clockout wizard:
--
--   smartout://clockout?sessionId=<department_session_id>&source=push
--
-- Recipient resolution: duty_leader_id ?? opened_by (per
-- apps/mobile/src/hooks/queries/use-duty-leader.ts convention).
--
-- Relationship to trg_session_pending_signoff (ADR-0187):
--   * trg_session_pending_signoff is the SOLE emitter for the state-
--     change event (engine_event). It must not change — ADR-0187.
--   * THIS trigger is a SEPARATE, UI-surface concern (notification).
--     It reads NEW / OLD directly from department_session and calls
--     dispatch_push_notification. Fire-and-forget via pg_net.
--   * Two triggers on the same UPDATE are harmless: one writes a
--     durable engine_event; the other invokes a push bridge.
--
-- Campaign: daily-operation — M2 recon-wizard-mobile Phase F
-- ADR references: ADR-0187 (sole emitter, preserved), ADR-0134
-- (telemetry contract, unchanged)
-- ============================================

SET search_path TO public, extensions;

CREATE OR REPLACE FUNCTION public.trigger_push_session_pending_signoff()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_recipient UUID;
  v_deep_link TEXT;
  v_department_name TEXT;
  v_title TEXT;
  v_body TEXT;
BEGIN
  -- Fire only on active -> pending_signoff transition.
  IF NOT (NEW.status = 'pending_signoff' AND OLD.status = 'active') THEN
    RETURN NEW;
  END IF;

  -- Recipient: duty_leader_id takes precedence, else opened_by.
  v_recipient := COALESCE(NEW.duty_leader_id, NEW.opened_by);
  IF v_recipient IS NULL THEN
    RAISE NOTICE 'push-dispatch clockout: no recipient for session %',
      NEW.department_session_id;
    RETURN NEW;
  END IF;

  -- Resolve department name for the notification body (best-effort).
  SELECT name INTO v_department_name
    FROM public.department
   WHERE department_id = NEW.department_id;

  v_title := 'Avstem dagen';
  v_body := COALESCE(v_department_name, 'Avdeling') || ' venter på avstemming.';
  v_deep_link := 'smartout://clockout?sessionId=' || NEW.department_session_id::TEXT
                 || '&source=push';

  -- Fire-and-forget. `data` keys must be string-valued per Expo Push spec.
  PERFORM public.dispatch_push_notification(
    'reconciliation_pending_signoff',
    v_recipient,
    NEW.workspace_id,
    v_title,
    v_body,
    jsonb_build_object(
      'session_id', NEW.department_session_id::TEXT,
      'deep_link', v_deep_link,
      'department_id', NEW.department_id::TEXT
    )
  );

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.trigger_push_session_pending_signoff() IS
  'M2 Phase F: pushes `reconciliation_pending_signoff` notification with clockout deep-link to duty leader on active -> pending_signoff transition. Fire-and-forget via pg_net. Separate from trg_session_pending_signoff (engine_event emitter per ADR-0187).';

DROP TRIGGER IF EXISTS trg_push_session_pending_signoff ON public.department_session;
CREATE TRIGGER trg_push_session_pending_signoff
  AFTER UPDATE OF status ON public.department_session
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_push_session_pending_signoff();
