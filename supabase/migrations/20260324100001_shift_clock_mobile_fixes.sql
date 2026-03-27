-- Fix infinite recursion in chat policies
CREATE OR REPLACE FUNCTION public.is_participant_in_conversation(conv_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.chat_participant cp
    JOIN public.profile p ON p.profile_id = cp.profile_id
    WHERE cp.conversation_id = conv_id
      AND p.user_id = auth.uid()
      AND cp.left_at IS NULL
  );
$$;

DROP POLICY IF EXISTS "jwt_read_chat_participant" ON public.chat_participant;
CREATE POLICY "jwt_read_chat_participant"
  ON public.chat_participant FOR SELECT
  USING (
    profile_id IN (SELECT p.profile_id FROM public.profile p WHERE p.user_id = auth.uid())
    OR
    public.is_participant_in_conversation(conversation_id)
  );

DROP POLICY IF EXISTS "jwt_read_chat_conversation" ON public.chat_conversation;
CREATE POLICY "jwt_read_chat_conversation"
  ON public.chat_conversation FOR SELECT
  USING (public.is_participant_in_conversation(id));

DROP POLICY IF EXISTS "jwt_read_chat_message" ON public.chat_message;
CREATE POLICY "jwt_read_chat_message"
  ON public.chat_message FOR SELECT
  USING (public.is_participant_in_conversation(conversation_id));

-- Add timesheet schema permissions (only if schema exists — created later in 20260418100001)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.schemata WHERE schema_name = 'timesheet') THEN
    EXECUTE 'GRANT USAGE ON SCHEMA timesheet TO anon, authenticated, service_role';
    EXECUTE 'GRANT ALL ON ALL TABLES IN SCHEMA timesheet TO anon, authenticated, service_role';
    EXECUTE 'GRANT ALL ON ALL ROUTINES IN SCHEMA timesheet TO anon, authenticated, service_role';
    EXECUTE 'GRANT ALL ON ALL SEQUENCES IN SCHEMA timesheet TO anon, authenticated, service_role';
  END IF;
END$$;

-- Add shift clock config and notes
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'supplement_claim_status') THEN
    CREATE TYPE public.supplement_claim_status AS ENUM ('pending', 'approved', 'rejected');
  END IF;
END$$;

CREATE TABLE IF NOT EXISTS public.shift_clock_config (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id          UUID NOT NULL REFERENCES public.workspace(workspace_id),
  department_id         UUID REFERENCES public.department(department_id),
  team_id               UUID REFERENCES public.team(team_id),
  gps_required          BOOLEAN NOT NULL DEFAULT false,
  gps_radius_meters     INT NOT NULL DEFAULT 200,
  gps_reference_lat     NUMERIC(10,7),
  gps_reference_lng     NUMERIC(10,7),
  adhoc_shifts_enabled  BOOLEAN NOT NULL DEFAULT false,
  adhoc_requires_approval BOOLEAN NOT NULL DEFAULT true,
  punch_window_minutes  INT NOT NULL DEFAULT 30,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_shift_clock_config UNIQUE (workspace_id, department_id, team_id)
);

CREATE TABLE IF NOT EXISTS public.shift_note (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shift_id      UUID NOT NULL REFERENCES public.schedule_shift(schedule_shift_id),
  profile_id    UUID NOT NULL REFERENCES public.profile(profile_id),
  workspace_id  UUID NOT NULL REFERENCES public.workspace(workspace_id),
  content       TEXT NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

DROP TRIGGER IF EXISTS set_shift_note_updated_at ON public.shift_note;
CREATE TRIGGER set_shift_note_updated_at
  BEFORE UPDATE ON public.shift_note
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Enable RLS for new tables
ALTER TABLE public.shift_clock_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shift_note ENABLE ROW LEVEL SECURITY;

-- Shift note RLS (read if in workspace, write own notes)
DROP POLICY IF EXISTS "jwt_read_shift_note" ON public.shift_note;
CREATE POLICY "jwt_read_shift_note" ON public.shift_note FOR SELECT
USING (workspace_id IN (SELECT public.get_workspace_ids_for_user(auth.uid())));

DROP POLICY IF EXISTS "jwt_insert_shift_note" ON public.shift_note;
CREATE POLICY "jwt_insert_shift_note" ON public.shift_note FOR INSERT
WITH CHECK (profile_id IN (SELECT profile_id FROM public.profile WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "jwt_update_shift_note" ON public.shift_note;
CREATE POLICY "jwt_update_shift_note" ON public.shift_note FOR UPDATE
USING (profile_id IN (SELECT profile_id FROM public.profile WHERE user_id = auth.uid()));

-- Add columns to time_entry (only if timesheet schema exists — created later in 20260418100001)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.schemata WHERE schema_name = 'timesheet') THEN
    EXECUTE 'ALTER TABLE timesheet.time_entry ADD COLUMN IF NOT EXISTS punch_out_location JSONB';
    EXECUTE 'ALTER TABLE timesheet.time_entry ADD COLUMN IF NOT EXISTS break_locations JSONB';
    EXECUTE 'ALTER TABLE timesheet.time_entry ADD COLUMN IF NOT EXISTS notes TEXT';
  END IF;
END$$;

-- Add columns to schedule_shift
ALTER TABLE public.schedule_shift ADD COLUMN IF NOT EXISTS is_adhoc BOOLEAN DEFAULT false;
ALTER TABLE public.schedule_shift ADD COLUMN IF NOT EXISTS adhoc_approved_by UUID REFERENCES public.profile(profile_id);
ALTER TABLE public.schedule_shift ADD COLUMN IF NOT EXISTS adhoc_approved_at TIMESTAMPTZ;
