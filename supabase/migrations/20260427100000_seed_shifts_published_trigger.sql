SET search_path TO public, extensions;

-- ============================================
-- 20260427100000_seed_shifts_published_trigger.sql
-- Adds engine_trigger for "shifts.published" (batch/plural variant).
-- The telemetry registry routes both "shift published" and "shifts published"
-- to engine_event. The engine-event provider converts spaces to dots, so
-- this trigger catches the batch publish path that was previously unwired.
-- ============================================

INSERT INTO engine_trigger (event_type, process_id, condition, is_active)
SELECT 'shifts.published', 'department_session_lifecycle', null, true
WHERE NOT EXISTS (
  SELECT 1 FROM engine_trigger
  WHERE event_type = 'shifts.published' AND process_id = 'department_session_lifecycle'
);
