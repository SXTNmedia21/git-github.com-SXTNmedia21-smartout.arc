SET search_path TO public, extensions;

-- ============================================
-- 20260412200000_seed_session_lifecycle.sql
-- Seeds the department_session_lifecycle process.
-- When shifts are published, auto-creates department sessions
-- and schedules session hooks for the day.
-- ============================================

-- ── Process ────────────────────────────────────────────────

INSERT INTO engine_process (id, name, description) VALUES
('department_session_lifecycle', 'Department Session Lifecycle',
 'Auto-creates department sessions when shifts are published. Schedules session hooks for pre_open/open/pre_close/close timing.')
ON CONFLICT (id) DO NOTHING;

-- ── Steps ──────────────────────────────────────────────────

INSERT INTO engine_step (process_id, step_order, step_group, action_type, action_payload, assignee_rule) VALUES

-- Step 1: Create/upsert department_session for each date x department
('department_session_lifecycle', 1, NULL, 'upsert_session', '{
  "description": "Create department_session rows for each published date x department combination"
}', null),

-- Step 2: Schedule session hooks (pre_open, open, pre_close, close) based on shift times
('department_session_lifecycle', 2, NULL, 'schedule_control', '{
  "description": "Schedule session hooks based on first/last shift times for each department session",
  "hooks": ["pre_open", "open", "pre_close", "close"]
}', null),

-- Step 3: Wait for session to be opened (first shift starts)
('department_session_lifecycle', 3, NULL, 'wait_for_event', '{
  "event": "session.pending_signoff",
  "timeout": "24h",
  "on_timeout": "auto_close",
  "description": "Wait for the session day to complete and move to signoff"
}', null),

-- Step 4: Update session status to closed
('department_session_lifecycle', 4, NULL, 'update_entity', '{
  "entity": "department_session",
  "set": {"status": "closed"},
  "description": "Mark session as closed after signoff"
}', null)

ON CONFLICT (process_id, step_order) DO NOTHING;

-- ── Trigger ───────────────────────────────────────────────

INSERT INTO engine_trigger (event_type, process_id, condition, is_active)
SELECT 'shift.published', 'department_session_lifecycle', null, true
WHERE NOT EXISTS (
  SELECT 1 FROM engine_trigger
  WHERE event_type = 'shift.published' AND process_id = 'department_session_lifecycle'
);
