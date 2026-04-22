-- ============================================
-- 20260422120000_guardian_log_pg_notify.sql
-- Phase A6 (Campaign Botsson Arena) · ADR-0186
--
-- Replaces in-process guardian-bus EventEmitter with Postgres LISTEN/NOTIFY.
-- AFTER INSERT on guardian_log fires pg_notify('guardian_events', <payload>).
-- Stage-engine instances run `LISTEN guardian_events` and broadcast to their
-- own subscribed WebSocket clients.
--
-- Pattern mirrors the existing telegram_bridge pg_notify listener in
-- services/stage-engine/src/index.ts (setupPgNotifyListener).
--
-- Horizontal scaling: any instance can INSERT into guardian_log; every
-- instance that LISTENs will receive the notification and broadcast to its
-- own WS clients. No cross-instance state required.
--
-- pg_notify payload size limit is 8 KB. The trigger keeps the payload
-- compact — event_type, actor, summary, plus the full data JSONB. If a
-- single event exceeds the limit the NOTIFY is dropped silently (the row
-- still commits), which is the acceptable degradation for this use-case.
-- ============================================

SET search_path TO public, extensions;

CREATE OR REPLACE FUNCTION notify_guardian_event()
RETURNS TRIGGER AS $$
DECLARE
  payload JSON;
BEGIN
  payload := json_build_object(
    'id',           NEW.id,
    'workspace_id', NEW.workspace_id,
    'session_id',   NEW.session_id,
    'event_type',   NEW.event_type,
    'actor',        NEW.actor,
    'summary',      NEW.summary,
    'data',         NEW.data,
    'created_at',   NEW.created_at
  );

  PERFORM pg_notify('guardian_events', payload::text);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION notify_guardian_event IS
  'ADR-0186: fires pg_notify(''guardian_events'') for every guardian_log row. Consumed by stage-engine pg-notify-bus for WebSocket broadcast.';

DROP TRIGGER IF EXISTS guardian_log_notify ON guardian_log;
CREATE TRIGGER guardian_log_notify
  AFTER INSERT ON guardian_log
  FOR EACH ROW EXECUTE FUNCTION notify_guardian_event();
