-- Allow engine_sessions.workspace_id to be NULL.
-- During onboarding, the user has no workspace yet.
-- The workspace is created at the END of the onboarding flow.

ALTER TABLE engine_sessions ALTER COLUMN workspace_id DROP NOT NULL;
