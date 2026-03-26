-- Per-shift notes written by employees during their active shift
--
-- Linked to schedule_shift so notes are always tied to a specific scheduled
-- work period. Employees can only insert their own notes (profile_id check
-- prevents writing notes on behalf of others).

CREATE TABLE IF NOT EXISTS shift_note (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shift_id      UUID NOT NULL REFERENCES schedule_shift(schedule_shift_id) ON DELETE CASCADE,
  profile_id    UUID NOT NULL REFERENCES profile(profile_id),
  workspace_id  UUID NOT NULL REFERENCES workspace(workspace_id) ON DELETE CASCADE,
  content       TEXT NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

DROP TRIGGER IF EXISTS set_shift_note_updated_at ON shift_note;
CREATE TRIGGER set_shift_note_updated_at
  BEFORE UPDATE ON shift_note
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE INDEX IF NOT EXISTS idx_shift_note_shift ON shift_note(shift_id);
CREATE INDEX IF NOT EXISTS idx_shift_note_workspace ON shift_note(workspace_id);

ALTER TABLE shift_note ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "jwt_read_shift_note" ON shift_note
    FOR SELECT USING (workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid())));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "jwt_insert_shift_note" ON shift_note
    FOR INSERT WITH CHECK (
      workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid()))
      AND profile_id = (SELECT p.profile_id FROM profile p WHERE p.user_id = auth.uid() LIMIT 1)
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "api_key_read_shift_note" ON shift_note
    FOR SELECT USING (workspace_id = get_api_workspace_id());
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
