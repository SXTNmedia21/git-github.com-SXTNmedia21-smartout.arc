-- Add priority and position columns to emma_task for task management
ALTER TABLE emma_task
  ADD COLUMN IF NOT EXISTS priority text NOT NULL DEFAULT 'medium'
    CHECK (priority IN ('high', 'medium', 'low')),
  ADD COLUMN IF NOT EXISTS position integer NOT NULL DEFAULT 0;

-- Index for ordering tasks by position within a profile
CREATE INDEX IF NOT EXISTS idx_emma_task_profile_position
  ON emma_task (profile_id, position)
  WHERE status IN ('pending', 'triggered', 'done');
