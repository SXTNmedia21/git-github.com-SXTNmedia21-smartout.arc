SET search_path TO public, extensions;

-- signup_onboarding process
-- Journey 1: Sign Up + Create Workspace
-- Triggered by: signup.completed
-- Entity: user_identity
-- Steps: 8 onboarding sections + workspace.created + notification

INSERT INTO engine_process (id, name, description, workspace_id, is_active, max_steps)
VALUES (
  'signup_onboarding',
  'Sign Up & Create Workspace',
  'Tracks user from signup through onboarding wizard to workspace creation. 10 steps: 8 sections + workspace finalize + notification.',
  NULL,
  true,
  50
) ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  updated_at = now();

DELETE FROM engine_step WHERE process_id = 'signup_onboarding';

INSERT INTO engine_step (process_id, step_order, action_type, action_payload, condition) VALUES
  ('signup_onboarding', 1, 'wait_for_event',
    '{"event": "onboarding.step_completed"}'::jsonb,
    '{"match": {"step_id": "hero"}}'::jsonb),
  ('signup_onboarding', 2, 'wait_for_event',
    '{"event": "onboarding.step_completed"}'::jsonb,
    '{"match": {"step_id": "business"}}'::jsonb),
  ('signup_onboarding', 3, 'wait_for_event',
    '{"event": "onboarding.step_completed"}'::jsonb,
    '{"match": {"step_id": "departments"}}'::jsonb),
  ('signup_onboarding', 4, 'wait_for_event',
    '{"event": "onboarding.step_completed"}'::jsonb,
    '{"match": {"step_id": "locations"}}'::jsonb),
  ('signup_onboarding', 5, 'wait_for_event',
    '{"event": "onboarding.step_completed"}'::jsonb,
    '{"match": {"step_id": "procedures"}}'::jsonb),
  ('signup_onboarding', 6, 'wait_for_event',
    '{"event": "onboarding.step_completed"}'::jsonb,
    '{"match": {"step_id": "season"}}'::jsonb),
  ('signup_onboarding', 7, 'wait_for_event',
    '{"event": "onboarding.step_completed"}'::jsonb,
    '{"match": {"step_id": "contract"}}'::jsonb),
  ('signup_onboarding', 8, 'wait_for_event',
    '{"event": "onboarding.step_completed"}'::jsonb,
    '{"match": {"step_id": "welcome"}}'::jsonb),
  ('signup_onboarding', 9, 'wait_for_event',
    '{"event": "workspace.created"}'::jsonb,
    '{"match_state": {"user_identity_id": "entity_id"}}'::jsonb),
  ('signup_onboarding', 10, 'send_notification',
    '{"template": "workspace_ready"}'::jsonb,
    NULL);

DELETE FROM engine_trigger WHERE process_id = 'signup_onboarding';

INSERT INTO engine_trigger (event_type, process_id, condition, delay_seconds, is_active, workspace_id)
VALUES ('signup.completed', 'signup_onboarding', NULL, 0, true, NULL);
