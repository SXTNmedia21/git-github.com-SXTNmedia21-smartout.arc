-- Guardian event log — persists all events from the Guardian event bus.
-- Used for history/replay and as fallback when WebSocket is disconnected.

CREATE TABLE IF NOT EXISTS guardian_log (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id    UUID NOT NULL REFERENCES workspace(workspace_id),
  session_id      UUID NOT NULL,
  event_type      TEXT NOT NULL,
  actor           TEXT NOT NULL,
  summary         TEXT NOT NULL,
  data            JSONB DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Session event feed (primary query)
CREATE INDEX IF NOT EXISTS idx_guardian_log_session
  ON guardian_log (session_id, created_at);

-- Workspace-wide recent events (dashboard list)
CREATE INDEX IF NOT EXISTS idx_guardian_log_workspace
  ON guardian_log (workspace_id, created_at DESC);

-- RLS
ALTER TABLE guardian_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Workspace members can view logs" ON guardian_log;
CREATE POLICY "Workspace members can view logs" ON guardian_log
  FOR SELECT
  USING (workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid())));

DROP POLICY IF EXISTS "api_key_read_guardian_log" ON guardian_log;
CREATE POLICY "api_key_read_guardian_log" ON guardian_log
  FOR SELECT
  USING (workspace_id = get_api_workspace_id());

DROP POLICY IF EXISTS "Service can manage logs" ON guardian_log;
CREATE POLICY "Service can manage logs" ON guardian_log
  FOR ALL TO service_role
  USING (true) WITH CHECK (true);
