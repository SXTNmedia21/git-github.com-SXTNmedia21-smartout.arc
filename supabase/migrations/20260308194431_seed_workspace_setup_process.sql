SET search_path TO public, extensions;

-- workspace_setup process
-- Journey 2: Configure Workspace
-- Triggered by: workspace.created (end of Journey 1)
-- Entity: workspace

INSERT INTO engine_process (id, name, description, workspace_id, is_active, max_steps)
VALUES (
  'workspace_setup',
  'Configure Workspace',
  'Tracks admin through workspace setup wizard. 9 steps matching wizard sections.',
  NULL,
  true,
  50
) ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  updated_at = now();

DELETE FROM engine_step WHERE process_id = 'workspace_setup';

INSERT INTO engine_step (process_id, step_order, action_type, action_payload, condition) VALUES
  ('workspace_setup', 1, 'wait_for_event',
    '{"event": "wizard.step_completed"}'::jsonb,
    '{"match": {"step_id": "welcome"}}'::jsonb),
  ('workspace_setup', 2, 'wait_for_event',
    '{"event": "wizard.step_completed"}'::jsonb,
    '{"match": {"step_id": "document-drop"}}'::jsonb),
  ('workspace_setup', 3, 'wait_for_event',
    '{"event": "wizard.step_completed"}'::jsonb,
    '{"match": {"step_id": "governance"}}'::jsonb),
  ('workspace_setup', 4, 'wait_for_event',
    '{"event": "wizard.step_completed"}'::jsonb,
    '{"match": {"step_id": "payroll"}}'::jsonb),
  ('workspace_setup', 5, 'wait_for_event',
    '{"event": "wizard.step_completed"}'::jsonb,
    '{"match": {"step_id": "employment"}}'::jsonb),
  ('workspace_setup', 6, 'wait_for_event',
    '{"event": "wizard.step_completed"}'::jsonb,
    '{"match": {"step_id": "team"}}'::jsonb),
  ('workspace_setup', 7, 'wait_for_event',
    '{"event": "wizard.step_completed"}'::jsonb,
    '{"match": {"step_id": "shift-template"}}'::jsonb),
  ('workspace_setup', 8, 'wait_for_event',
    '{"event": "wizard.step_completed"}'::jsonb,
    '{"match": {"step_id": "season"}}'::jsonb),
  ('workspace_setup', 9, 'wait_for_event',
    '{"event": "wizard.step_completed"}'::jsonb,
    '{"match": {"step_id": "handbook"}}'::jsonb);

DELETE FROM engine_trigger WHERE process_id = 'workspace_setup';

INSERT INTO engine_trigger (event_type, process_id, condition, delay_seconds, is_active, workspace_id)
VALUES ('workspace.created', 'workspace_setup', NULL, 0, true, NULL);
