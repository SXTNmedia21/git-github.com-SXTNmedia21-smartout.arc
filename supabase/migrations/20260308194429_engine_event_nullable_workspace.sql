SET search_path TO public, extensions;

-- Allow pre-workspace events (signup.completed emitted before workspace exists)
ALTER TABLE engine_event ALTER COLUMN workspace_id DROP NOT NULL;

-- RLS: allow users to read their own pre-workspace events
DROP POLICY IF EXISTS "read_own_pre_workspace_events" ON engine_event;
CREATE POLICY "read_own_pre_workspace_events" ON engine_event
  FOR SELECT USING (
    workspace_id IS NULL
    AND payload->>'actor_id' = auth.uid()::text
  );

COMMENT ON COLUMN engine_event.workspace_id IS 'NULL for pre-workspace events (e.g. signup.completed). All other events must have workspace_id.';
