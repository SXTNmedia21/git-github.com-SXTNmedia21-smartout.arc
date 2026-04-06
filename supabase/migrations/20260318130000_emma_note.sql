-- Emma Notes — persistent notepad entries with full lifecycle
-- Supports: daily notes, task migration, assignment to other profiles, tagging

CREATE TABLE IF NOT EXISTS emma_note (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspace(workspace_id) ON DELETE CASCADE,
  profile_id uuid NOT NULL REFERENCES profile(profile_id) ON DELETE CASCADE,
  topic text NOT NULL DEFAULT 'Notat',
  content text NOT NULL DEFAULT '',
  tags text[] NOT NULL DEFAULT '{}',
  screen text NOT NULL DEFAULT 'Botsson',
  context text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'archived', 'converted')),
  -- For task migration: if this note was converted to a task
  converted_task_id uuid REFERENCES emma_task(id) ON DELETE SET NULL,
  -- For assignment: who this note was assigned/shared to
  assigned_to uuid REFERENCES profile(profile_id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Timestamp trigger
CREATE TRIGGER set_emma_note_updated_at
  BEFORE UPDATE ON emma_note
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_at();

-- RLS
ALTER TABLE emma_note ENABLE ROW LEVEL SECURITY;

-- Users can read/write their own notes within their workspace
CREATE POLICY "emma_note_select_own" ON emma_note
  FOR SELECT USING (
    workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid()))
  );

CREATE POLICY "emma_note_insert_own" ON emma_note
  FOR INSERT WITH CHECK (
    workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid()))
    AND profile_id = (SELECT profile_id FROM profile WHERE user_id = auth.uid() AND workspace_id = emma_note.workspace_id LIMIT 1)
  );

CREATE POLICY "emma_note_update_own" ON emma_note
  FOR UPDATE USING (
    profile_id = (SELECT profile_id FROM profile WHERE user_id = auth.uid() LIMIT 1)
  );

-- Indexes
CREATE INDEX idx_emma_note_profile_status
  ON emma_note (profile_id, status)
  WHERE status = 'active';

CREATE INDEX idx_emma_note_workspace
  ON emma_note (workspace_id, created_at DESC);
