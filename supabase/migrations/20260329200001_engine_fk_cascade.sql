-- Fix FK cascade on all engine tables so workspace deletion (sandbox cleanup)
-- doesn't fail with FK violation errors.
-- All five engine tables currently use NO ACTION — replacing with CASCADE.

-- engine_sessions
ALTER TABLE engine_sessions
  DROP CONSTRAINT engine_sessions_workspace_id_fkey;
ALTER TABLE engine_sessions
  ADD CONSTRAINT engine_sessions_workspace_id_fkey
  FOREIGN KEY (workspace_id) REFERENCES workspace(workspace_id) ON DELETE CASCADE;

-- engine_memory
ALTER TABLE engine_memory
  DROP CONSTRAINT engine_memory_workspace_id_fkey;
ALTER TABLE engine_memory
  ADD CONSTRAINT engine_memory_workspace_id_fkey
  FOREIGN KEY (workspace_id) REFERENCES workspace(workspace_id) ON DELETE CASCADE;

-- engine_authority_config
ALTER TABLE engine_authority_config
  DROP CONSTRAINT engine_authority_config_workspace_id_fkey;
ALTER TABLE engine_authority_config
  ADD CONSTRAINT engine_authority_config_workspace_id_fkey
  FOREIGN KEY (workspace_id) REFERENCES workspace(workspace_id) ON DELETE CASCADE;

-- engine_inbox
ALTER TABLE engine_inbox
  DROP CONSTRAINT engine_inbox_workspace_id_fkey;
ALTER TABLE engine_inbox
  ADD CONSTRAINT engine_inbox_workspace_id_fkey
  FOREIGN KEY (workspace_id) REFERENCES workspace(workspace_id) ON DELETE CASCADE;

-- engine_missions (workspace_id is nullable — CASCADE still applies when non-NULL)
ALTER TABLE engine_missions
  DROP CONSTRAINT engine_missions_workspace_id_fkey;
ALTER TABLE engine_missions
  ADD CONSTRAINT engine_missions_workspace_id_fkey
  FOREIGN KEY (workspace_id) REFERENCES workspace(workspace_id) ON DELETE CASCADE;
