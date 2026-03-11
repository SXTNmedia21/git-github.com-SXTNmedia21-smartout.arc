-- emma_task: Scheduled tasks created by Emma (or user) with optional due dates.
-- The cron function emma-task-trigger checks this table every 10 minutes.

CREATE TABLE IF NOT EXISTS emma_task (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id    UUID NOT NULL REFERENCES workspace(workspace_id) ON DELETE CASCADE,
  profile_id      UUID NOT NULL REFERENCES profile(profile_id) ON DELETE CASCADE,
  title           TEXT NOT NULL,
  description     TEXT DEFAULT '',
  due_at          TIMESTAMPTZ,           -- NULL = no deadline
  status          TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'triggered', 'done', 'dismissed')),
  context         JSONB DEFAULT '{}',    -- page, mission, extra data for Emma
  mission         TEXT,                   -- what Emma should do when triggered
  triggered_at    TIMESTAMPTZ,           -- when the cron picked it up
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX idx_emma_task_due ON emma_task (status, due_at) WHERE status = 'pending' AND due_at IS NOT NULL;
CREATE INDEX idx_emma_task_workspace ON emma_task (workspace_id, profile_id, status);

-- Updated_at trigger
CREATE TRIGGER set_emma_task_updated_at
  BEFORE UPDATE ON emma_task
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- RLS
ALTER TABLE emma_task ENABLE ROW LEVEL SECURITY;

CREATE POLICY "emma_task_jwt_read" ON emma_task
  FOR SELECT USING (workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid())));

CREATE POLICY "emma_task_jwt_write" ON emma_task
  FOR ALL USING (workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid())));

COMMENT ON TABLE emma_task IS 'Scheduled tasks with due dates. Cron triggers Emma when tasks come due.';
