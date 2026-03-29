-- ============================================
-- 20260428100000_season_activation_trigger.sql
-- When a season activates (draft → active), emit an engine_event
-- that triggers department session creation for the planning window.
-- ============================================

-- ── Postgres trigger: season status → engine_event ──

CREATE OR REPLACE FUNCTION emit_season_activated_event()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'active' AND (OLD.status IS NULL OR OLD.status != 'active') THEN
    INSERT INTO engine_event (
      event_type,
      workspace_id,
      payload,
      idempotency_key
    ) VALUES (
      'season.activated',
      NEW.workspace_id,
      jsonb_build_object(
        'season_id', NEW.season_id,
        'start_date', NEW.start_date,
        'end_date', NEW.end_date,
        'name', NEW.name
      ),
      'season_activated_' || NEW.season_id
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_season_activated ON season;
CREATE TRIGGER trg_season_activated
  AFTER UPDATE OF status ON season
  FOR EACH ROW
  EXECUTE FUNCTION emit_season_activated_event();

-- ── Engine trigger: season.activated → department_session_lifecycle ──

INSERT INTO engine_trigger (event_type, process_id, condition, is_active)
SELECT 'season.activated', 'department_session_lifecycle', null, true
WHERE NOT EXISTS (
  SELECT 1 FROM engine_trigger
  WHERE event_type = 'season.activated' AND process_id = 'department_session_lifecycle'
);
