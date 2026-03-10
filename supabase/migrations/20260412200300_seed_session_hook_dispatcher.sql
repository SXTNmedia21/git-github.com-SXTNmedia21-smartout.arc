SET search_path TO public, extensions;

-- ============================================
-- 20260412200300_seed_session_hook_dispatcher.sql
-- Seeds the session_hook_dispatcher process.
-- When a session hook fires (pre_open, open, pre_close, close),
-- creates a session task and notifies the assigned employee.
-- ============================================

-- ── Process ────────────────────────────────────────────────

INSERT INTO engine_process (id, name, description) VALUES
('session_hook_dispatcher', 'Session Hook Dispatcher',
 'Handles session hook events (pre_open, open, scheduled, pre_close, close). Creates session tasks from linked procedures/routines and notifies assigned employees.')
ON CONFLICT (id) DO NOTHING;

-- ── Steps ──────────────────────────────────────────────────

INSERT INTO engine_step (process_id, step_order, step_group, action_type, action_payload, assignee_rule) VALUES

-- Step 1: Create a session task from the hook's linked procedure/routine
('session_hook_dispatcher', 1, NULL, 'create_session_task', '{
  "title": "Hook task",
  "description": "Session task created from hook trigger",
  "compliance_required": true
}', 'self'),

-- Step 2: Notify assigned employee
('session_hook_dispatcher', 2, NULL, 'send_notification', '{
  "template": "session_hook_task",
  "channel": "push",
  "description": "Notify assigned employee that a session hook task is ready"
}', 'self'),

-- Step 3: Wait for task completion
('session_hook_dispatcher', 3, NULL, 'wait_for_event', '{
  "event": "session_task.completed",
  "timeout": "4h",
  "on_timeout": "escalate",
  "description": "Wait for the employee to complete the session hook task"
}', null)

ON CONFLICT (process_id, step_order) DO NOTHING;

-- ── Trigger ───────────────────────────────────────────────

INSERT INTO engine_trigger (event_type, process_id, condition, is_active)
SELECT 'session.hook_fired', 'session_hook_dispatcher', null, true
WHERE NOT EXISTS (
  SELECT 1 FROM engine_trigger
  WHERE event_type = 'session.hook_fired' AND process_id = 'session_hook_dispatcher'
);
