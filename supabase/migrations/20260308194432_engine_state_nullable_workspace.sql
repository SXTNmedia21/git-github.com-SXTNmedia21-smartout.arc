SET search_path TO public, extensions;

-- Allow pre-workspace engine_states (signup_onboarding starts before workspace exists)
ALTER TABLE engine_state ALTER COLUMN workspace_id DROP NOT NULL;

-- Also allow nullable workspace_id on engine_trigger (global triggers)
ALTER TABLE engine_trigger ALTER COLUMN workspace_id DROP NOT NULL;

-- Update RLS: allow service_role to manage states with NULL workspace_id
-- (existing policies use workspace_id IN get_workspace_ids_for_user — NULL states
-- are only visible via service_role, which bypasses RLS)

COMMENT ON COLUMN engine_state.workspace_id IS 'NULL for pre-workspace processes (e.g. signup_onboarding). Set when workspace is created.';
