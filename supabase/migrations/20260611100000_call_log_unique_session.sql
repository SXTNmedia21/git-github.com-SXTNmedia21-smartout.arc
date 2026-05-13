-- F-WH-04: Add UNIQUE constraint on call_log.call_session_id
-- Ensures LiveKit room_finished webhook retries cannot create duplicate immutable audit rows.
-- The livekit-webhook handler is updated to use ON CONFLICT (call_session_id) DO NOTHING
-- so second delivery of the same event is a safe no-op.
--
-- Pre-migration safety: deduplicate any existing duplicates, keeping the first row (min id).
-- In practice these are extremely unlikely in production but the guard makes the migration
-- forward-safe regardless.
DELETE FROM call_log
WHERE id NOT IN (
  SELECT DISTINCT ON (call_session_id) id
  FROM call_log
  ORDER BY call_session_id, created_at ASC
);

ALTER TABLE call_log
  ADD CONSTRAINT call_log_call_session_id_key UNIQUE (call_session_id);
