SET search_path TO public, extensions;

-- ============================================
-- 20260406150100_guardian_signal_push_trigger.sql
--
-- Two things:
-- 1. pg_cron schedule for journey-stuck-detector (hourly). Skipped silently
--    in environments without pg_cron (e.g. Supabase Local) — verified in
--    Task 0 finding 0.4. In those environments the function is invoked
--    manually for testing.
-- 2. Trigger on guardian_signal INSERT that fires dispatch_push_notification
--    when domain = 'journey_health' and entity_type = 'profile'. This is the
--    rescue delivery edge of the Journey Harness PoC.
--
-- See: docs/superpowers/specs/2026-04-06-journey-harness-poc-instruction.md
-- ============================================

-- ── pg_cron schedule for stuck detection ───────────────────
-- Mirrors the wrapping pattern used by 20260428100100_daily_session_replenish_cron.sql.

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.schedule(
      'journey-stuck-detector-hourly',
      '0 * * * *',
      $cron$
        SELECT net.http_post(
          url := current_setting('app.supabase_url', true) || '/functions/v1/journey-stuck-detector',
          headers := jsonb_build_object(
            'Content-Type', 'application/json',
            'Authorization', 'Bearer ' || current_setting('app.service_role_key', true)
          ),
          body := '{}'::jsonb
        );
      $cron$
    );
  ELSE
    RAISE NOTICE 'pg_cron not enabled — journey-stuck-detector must be invoked manually';
  END IF;
END $$;

-- ── Trigger: guardian_signal INSERT → push notification ────
-- When a journey_health signal lands, route it through the existing
-- dispatch_push_notification helper (signature verified in Task 0 finding
-- 0.3). The rescue title/body are hardcoded in Norwegian for the PoC; an
-- i18n debt note is logged in the HANDOFF for follow-up work.

CREATE OR REPLACE FUNCTION public.trigger_journey_health_push()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Only fire for journey_health signals targeting a specific profile.
  -- Other domains (readiness, workspace_maturity, agent_behavior) have
  -- their own dispatch paths and must not be intercepted here.
  IF NEW.domain = 'journey_health' AND NEW.entity_type = 'profile' AND NEW.entity_id IS NOT NULL THEN
    PERFORM dispatch_push_notification(
      'journey_rescue',
      NEW.entity_id,
      NEW.workspace_id,
      'Sjekk vaktene dine 📋',
      'Du har åpnet vaktlisten — trykk på en vakt for å se detaljer som tid, avdeling og hvem du jobber med.',
      jsonb_build_object(
        'journey_id', 'journey_03_check_shifts',
        'deep_link', '/dashboard/my-schedule',
        'rescue_gate', 'gate_2'
      )
    );
  END IF;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.trigger_journey_health_push IS
  'PoC: Fires push notification when a guardian_signal with domain=journey_health is inserted. Rescue content is hardcoded for Journey 03 — i18n debt logged for follow-up.';

DROP TRIGGER IF EXISTS guardian_signal_journey_health_push ON public.guardian_signal;
CREATE TRIGGER guardian_signal_journey_health_push
  AFTER INSERT ON public.guardian_signal
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_journey_health_push();
