SET search_path TO public, extensions;

-- Link journey PM rows to their engine_process blueprints
UPDATE journey
SET engine_process_id = 'signup_onboarding',
    trigger_event = 'signup.completed',
    step_event_type = 'onboarding.step_completed',
    entity_type = 'user_identity',
    status = 'ready_test'
WHERE slug = 'sign-up-create-workspace';

UPDATE journey
SET engine_process_id = 'workspace_setup',
    trigger_event = 'workspace.created',
    step_event_type = 'wizard.step_completed',
    entity_type = 'workspace',
    status = 'ready_test'
WHERE slug = 'configure-organization-setup-wizard';
