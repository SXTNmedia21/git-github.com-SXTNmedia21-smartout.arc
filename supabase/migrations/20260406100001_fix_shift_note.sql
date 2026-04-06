-- Fix shift_note: ensure correct FK constraints, policies, and UPDATE policy
-- without destructive DROP TABLE CASCADE (council fix for ISSUE-13, ISSUE-17)

CREATE TABLE IF NOT EXISTS public.shift_note (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shift_id      UUID NOT NULL REFERENCES schedule_shift(schedule_shift_id) ON DELETE CASCADE,
  profile_id    UUID NOT NULL REFERENCES profile(profile_id),
  workspace_id  UUID NOT NULL REFERENCES workspace(workspace_id) ON DELETE CASCADE,
  content       TEXT NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_shift_note_shift ON shift_note(shift_id);
CREATE INDEX IF NOT EXISTS idx_shift_note_workspace ON shift_note(workspace_id);

DROP TRIGGER IF EXISTS set_shift_note_updated_at ON shift_note;
CREATE TRIGGER set_shift_note_updated_at
  BEFORE UPDATE ON shift_note
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

ALTER TABLE shift_note ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "jwt_read_shift_note" ON shift_note;
CREATE POLICY "jwt_read_shift_note" ON shift_note
  FOR SELECT USING (workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid())));

DROP POLICY IF EXISTS "jwt_insert_shift_note" ON shift_note;
CREATE POLICY "jwt_insert_shift_note" ON shift_note
  FOR INSERT WITH CHECK (
    workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid()))
    AND profile_id = (SELECT p.profile_id FROM profile p WHERE p.user_id = auth.uid() LIMIT 1)
  );

DROP POLICY IF EXISTS "jwt_update_shift_note" ON shift_note;
CREATE POLICY "jwt_update_shift_note" ON shift_note
  FOR UPDATE USING (
    profile_id IN (SELECT profile_id FROM profile WHERE user_id = auth.uid())
  );

DROP POLICY IF EXISTS "api_key_read_shift_note" ON shift_note;
CREATE POLICY "api_key_read_shift_note" ON shift_note
  FOR SELECT USING (workspace_id = get_api_workspace_id());
