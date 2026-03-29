-- ============================================
-- 20260428100400_session_pending_signoff_trigger.sql
-- Emits engine_event when department_session transitions to
-- pending_signoff, which triggers the daily_close process
-- (already seeded in 20260304300000).
-- ============================================

CREATE OR REPLACE FUNCTION emit_session_pending_signoff_event()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'pending_signoff' AND OLD.status = 'active' THEN
    INSERT INTO engine_event (
      event_type,
      workspace_id,
      payload,
      idempotency_key
    ) VALUES (
      'department_session.pending_signoff',
      NEW.workspace_id,
      jsonb_build_object(
        'department_session_id', NEW.department_session_id,
        'department_id', NEW.department_id,
        'session_date', NEW.session_date
      ),
      'session_signoff_' || NEW.department_session_id
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_session_pending_signoff ON department_session;
CREATE TRIGGER trg_session_pending_signoff
  AFTER UPDATE OF status ON department_session
  FOR EACH ROW
  EXECUTE FUNCTION emit_session_pending_signoff_event();
