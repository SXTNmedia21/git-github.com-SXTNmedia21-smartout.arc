-- Timesheet schema with time_entry table for punch clock functionality.
-- Employees punch in/out via the mobile app. Data drives shift_approval calculations.
-- Separate schema keeps timesheet concerns isolated from public tables.

-- ── Schema ──────────────────────────────────────────────────────
CREATE SCHEMA IF NOT EXISTS timesheet;

-- ── Enum ────────────────────────────────────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'time_entry_status' AND typnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'timesheet')) THEN
    CREATE TYPE timesheet.time_entry_status AS ENUM ('clocked_in', 'completed', 'edited');
  END IF;
END$$;

-- ── Table ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS timesheet.time_entry (
  time_entry_id     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shift_id          UUID NOT NULL REFERENCES public.schedule_shift(schedule_shift_id),
  profile_id        UUID NOT NULL REFERENCES public.profile(profile_id),
  workspace_id      UUID NOT NULL REFERENCES public.workspace(workspace_id),
  punch_in          TIMESTAMPTZ NOT NULL,
  punch_out         TIMESTAMPTZ,
  breaks            JSONB,              -- [{start: timestamptz, end: timestamptz}]
  punch_in_location JSONB,              -- {lat, lng} — optional geolocation at punch-in
  status            timesheet.time_entry_status NOT NULL DEFAULT 'clocked_in',
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE timesheet.time_entry IS 'Punch clock entries. One row per shift per employee. Written by mobile app via offline write queue.';
COMMENT ON COLUMN timesheet.time_entry.breaks IS 'Array of break periods: [{start: timestamptz, end: timestamptz}]';
COMMENT ON COLUMN timesheet.time_entry.punch_in_location IS 'Geolocation at punch-in: {lat, lng}. Optional.';

-- ── Indexes ─────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_time_entry_workspace_profile
  ON timesheet.time_entry (workspace_id, profile_id);

CREATE INDEX IF NOT EXISTS idx_time_entry_shift
  ON timesheet.time_entry (shift_id);

-- ── updated_at trigger ──────────────────────────────────────────
CREATE OR REPLACE FUNCTION timesheet.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_time_entry_updated_at
  BEFORE UPDATE ON timesheet.time_entry
  FOR EACH ROW EXECUTE FUNCTION timesheet.set_updated_at();

-- ── RLS ─────────────────────────────────────────────────────────
ALTER TABLE timesheet.time_entry ENABLE ROW LEVEL SECURITY;

-- JWT: users can read entries in their workspaces
CREATE POLICY "jwt_read_time_entry" ON timesheet.time_entry
  FOR SELECT
  USING (workspace_id IN (SELECT public.get_workspace_ids_for_user(auth.uid())));

-- JWT: employees can insert their own entries
CREATE POLICY "jwt_insert_own_time_entry" ON timesheet.time_entry
  FOR INSERT
  WITH CHECK (
    profile_id IN (
      SELECT profile_id FROM public.profile
      WHERE user_id = auth.uid()
    )
    AND workspace_id IN (SELECT public.get_workspace_ids_for_user(auth.uid()))
  );

-- JWT: employees can update their own entries (punch out, breaks)
CREATE POLICY "jwt_update_own_time_entry" ON timesheet.time_entry
  FOR UPDATE
  USING (
    profile_id IN (
      SELECT profile_id FROM public.profile
      WHERE user_id = auth.uid()
    )
    AND workspace_id IN (SELECT public.get_workspace_ids_for_user(auth.uid()))
  )
  WITH CHECK (
    profile_id IN (
      SELECT profile_id FROM public.profile
      WHERE user_id = auth.uid()
    )
    AND workspace_id IN (SELECT public.get_workspace_ids_for_user(auth.uid()))
  );

-- API key: workspace-scoped read
CREATE POLICY "api_key_read_time_entry" ON timesheet.time_entry
  FOR SELECT
  USING (workspace_id = public.get_api_workspace_id());

-- ── Realtime ────────────────────────────────────────────────────
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE timesheet.time_entry;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END$$;
