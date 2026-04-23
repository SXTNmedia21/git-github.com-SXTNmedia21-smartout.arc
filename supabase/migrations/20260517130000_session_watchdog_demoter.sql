-- ============================================================
-- 20260517130000_session_watchdog_demoter.sql
--
-- Phase 0c — Item 3 of the daily-operation campaign closure.
--
-- Watchdog demotion for `department_session.status = 'pending_signoff'`
-- rows that have not been signed off within a configurable window
-- (default 24 h, env SESSION_PENDING_SIGNOFF_STALE_HOURS).
--
-- Architecture (per ADR-0187 — single-emit-source invariant):
--
--   1. The `session-watchdog-demoter` Edge Function performs only
--      the UPDATE (`pending_signoff` → `missed`).
--   2. `trg_session_demoted_to_missed` (this file) is the SOLE
--      emitter of the `department_session.missed` engine_event on
--      that transition. Generalization of ADR-0187 across
--      status-change events on `department_session`.
--   3. The trigger is gated via `gate_action` per ADR-0189 — a new
--      system-floor capability `session.auto_missed_transition`
--      (min_role=system) is seeded below.
--   4. The companion `activity_trail` fan-out is done by the Edge
--      Function (the registry subscriber that would do it natively
--      does not exist yet — same interim pattern as
--      journey-stuck-detector per ADR-0175).
--
-- See also:
--   * supabase/functions/session-watchdog-demoter/index.ts
--   * supabase/migrations/20260428100400_session_pending_signoff_trigger.sql
--   * supabase/migrations/20260516110000_consolidate_session_signoff_emitter.sql
--   * packages/telemetry/src/registry.ts ("session demoted_to_missed")
--   * ADR-0187, ADR-0189, L-0108
-- ============================================================

SET search_path TO public, extensions;

-- ──────────────────────────────────────────────
-- Part 1: AFTER UPDATE trigger function — sole emitter for
-- department_session.pending_signoff → missed.
-- Mirrors emit_session_pending_signoff_event() in shape.
-- ──────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.emit_session_demoted_to_missed_event()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_gate_result JSONB;
  v_gate_allow  BOOLEAN;
  v_gate_reason TEXT;
BEGIN
  IF NEW.status = 'missed' AND OLD.status = 'pending_signoff' THEN
    -- ADR-0187 + ADR-0189: gate the trigger. DB-level writers must
    -- pass through the same authority gate as application writers.
    v_gate_result := public.gate_action(
      p_workspace_id      => NEW.workspace_id,
      p_capability        => 'session.auto_missed_transition',
      p_channel           => 'system',
      p_actor_profile_id  => NULL,
      p_action_type       => 'missed',
      p_engine_process_id => NULL,
      p_engine_state_id   => NULL,
      p_approvers_present => ARRAY[]::UUID[],
      p_entity_id         => NEW.department_session_id
    );

    v_gate_allow  := COALESCE((v_gate_result->>'allow')::BOOLEAN, false);
    v_gate_reason := v_gate_result->>'reason';

    IF NOT v_gate_allow THEN
      RAISE EXCEPTION
        'session.auto_missed_transition denied by gate_action: %',
        COALESCE(v_gate_reason, 'forbidden');
    END IF;

    INSERT INTO engine_event (
      event_type,
      workspace_id,
      payload,
      idempotency_key
    ) VALUES (
      'department_session.missed',
      NEW.workspace_id,
      jsonb_build_object(
        'department_session_id', NEW.department_session_id,
        'department_id',         NEW.department_id,
        'session_date',          NEW.session_date,
        'previous_status',       OLD.status,
        'automated',             true
      ),
      'session_missed_' || NEW.department_session_id
    );
  END IF;
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.emit_session_demoted_to_missed_event() IS
  'ADR-0187 generalization: sole emitter for department_session '
  'pending_signoff → missed transitions. Gates via gate_action '
  '(session.auto_missed_transition, channel=system) per ADR-0189 '
  'before writing engine_event. Raises on denial to abort the UPDATE '
  'and preserve status integrity. Companion to '
  'emit_session_pending_signoff_event().';

DROP TRIGGER IF EXISTS trg_session_demoted_to_missed ON public.department_session;
CREATE TRIGGER trg_session_demoted_to_missed
  AFTER UPDATE OF status ON public.department_session
  FOR EACH ROW
  EXECUTE FUNCTION public.emit_session_demoted_to_missed_event();

-- ──────────────────────────────────────────────
-- Part 2: Seed session.auto_missed_transition capability.
-- Mirrors the session.auto_signoff_transition seed in
-- 20260516110000_consolidate_session_signoff_emitter.sql:
--   * min_role='system' (only trigger path / system actors pass)
--   * level='confirm' (matches session.* family)
-- ──────────────────────────────────────────────

DO $$
DECLARE
  v_updated_by uuid;
BEGIN
  SELECT user_id INTO v_updated_by
    FROM public.user_identity
   WHERE is_godmode = true
   ORDER BY created_at ASC
   LIMIT 1;

  IF v_updated_by IS NULL THEN
    RAISE NOTICE 'No godmode user found — skipping session.auto_missed_transition authority seed. Re-run after first admin is created.';
    RETURN;
  END IF;

  INSERT INTO public.engine_authority_config (
    workspace_id, capability, level, min_role,
    requires_four_eyes, observer_escalation_hours, updated_by
  )
  SELECT w.workspace_id,
         'session.auto_missed_transition',
         'confirm',
         'system',
         false,
         24,
         v_updated_by
    FROM public.workspace w
  ON CONFLICT (workspace_id, capability) DO NOTHING;
END $$;

-- ──────────────────────────────────────────────
-- Part 3: pg_cron schedule — every 15 minutes, matches
-- session-lifecycle cadence (20260428100200_session_lifecycle_cron.sql).
-- ──────────────────────────────────────────────

DO $cmd$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    -- Idempotent re-schedule: unschedule prior run if present.
    BEGIN
      PERFORM cron.unschedule('session-watchdog-demoter');
    EXCEPTION WHEN OTHERS THEN
      -- First run on this database — nothing to unschedule.
      NULL;
    END;

    PERFORM cron.schedule(
      'session-watchdog-demoter',
      '*/15 * * * *',
      $sql$SELECT net.http_post(
        url := current_setting('app.supabase_url', true) || '/functions/v1/session-watchdog-demoter',
        headers := jsonb_build_object('Authorization', 'Bearer ' || current_setting('app.watchdog_cron_secret', true))
      )$sql$
    );
  END IF;
END $cmd$;
