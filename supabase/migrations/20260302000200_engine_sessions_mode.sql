-- 20260302000200_engine_sessions_mode.sql
-- Adds mode column to engine_sessions to distinguish mission vs agent sessions.

ALTER TABLE engine_sessions
  ADD COLUMN mode TEXT NOT NULL DEFAULT 'mission'
    CHECK (mode IN ('mission', 'agent'));

ALTER TABLE engine_sessions
  ALTER COLUMN mission_id DROP NOT NULL;

ALTER TABLE engine_sessions
  ADD CONSTRAINT chk_mission_mode_requires_mission
    CHECK (mode = 'agent' OR mission_id IS NOT NULL);

CREATE INDEX idx_engine_sessions_agent_profile
  ON engine_sessions (workspace_id, profile_id, created_at DESC)
  WHERE mode = 'agent';
