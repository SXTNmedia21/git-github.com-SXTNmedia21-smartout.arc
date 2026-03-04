SET search_path TO public, extensions;

-- ============================================
-- 20260301300000_schedule_shift_table.sql
-- Creates the schedule_shift table and supporting enums.
-- This is the first persistent schedule table — previously
-- all shift data lived in local React state (ADR-0032).
-- Connected to: schedule-types.ts (1:1 column mapping)
-- Connected to: ADR-0036 (Shift MCP Server decision)
-- ============================================

-- ── Enums ────────────────────────────────────────────────────

-- Shift lifecycle: created → assigned → published → active → completed → unpublished
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'shift_status') THEN
    CREATE TYPE shift_status AS ENUM (
  'created',
  'assigned',
  'published',
  'active',
  'completed',
  'unpublished'
);
  END IF;
END $$;;

-- Time-of-day classification for shift cards
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'day_category') THEN
    CREATE TYPE day_category AS ENUM (
  'morning',
  'midday',
  'afternoon',
  'evening',
  'night',
  'weekend'
);
  END IF;
END $$;;

-- ── Table ────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.schedule_shift (
  schedule_shift_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id      UUID NOT NULL REFERENCES public.workspace(workspace_id) ON DELETE CASCADE,
  -- null = unassigned shift (created state)
  employee_id       UUID REFERENCES public.profile(profile_id) ON DELETE SET NULL,
  position_id       UUID REFERENCES public.position(position_id) ON DELETE SET NULL,
  team_id           UUID REFERENCES public.team(team_id) ON DELETE SET NULL,

  -- Shift definition
  shift_date        DATE NOT NULL,
  role              TEXT NOT NULL,
  start_time        TIME NOT NULL,
  end_time          TIME NOT NULL,
  work_hours        NUMERIC(4,2) NOT NULL DEFAULT 0,
  breaks            INTEGER NOT NULL DEFAULT 0, -- minutes
  day_category      public.day_category NOT NULL,
  status            public.shift_status NOT NULL DEFAULT 'created',
  is_published      BOOLEAN NOT NULL DEFAULT false,

  -- Optional metadata
  zone              TEXT,
  indicator         TEXT NOT NULL DEFAULT 'blue',
  notes             TEXT,

  -- Timestamps
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── Comments ─────────────────────────────────────────────────

COMMENT ON TABLE public.schedule_shift IS 'Individual work shifts assigned to employees within a workspace schedule.';
COMMENT ON COLUMN public.schedule_shift.employee_id IS 'Null when shift is unassigned (status = created).';
COMMENT ON COLUMN public.schedule_shift.work_hours IS 'Calculated: (end_time - start_time - breaks) in hours.';
COMMENT ON COLUMN public.schedule_shift.breaks IS 'Break duration in minutes.';
COMMENT ON COLUMN public.schedule_shift.indicator IS 'Color indicator for shift card: blue, emerald, purple, orange.';

-- ── RLS ──────────────────────────────────────────────────────

ALTER TABLE public.schedule_shift ENABLE ROW LEVEL SECURITY;

-- JWT path: any workspace member can read shifts
DROP POLICY IF EXISTS "jwt_read_schedule_shift" ON public.schedule_shift;
CREATE POLICY "jwt_read_schedule_shift"
  ON public.schedule_shift FOR SELECT
  USING (workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid())));

-- JWT path: admins can insert shifts
DROP POLICY IF EXISTS "jwt_insert_schedule_shift" ON public.schedule_shift;
CREATE POLICY "jwt_insert_schedule_shift"
  ON public.schedule_shift FOR INSERT
  WITH CHECK (is_admin_in_workspace(auth.uid(), workspace_id));

-- JWT path: admins can update shifts
DROP POLICY IF EXISTS "jwt_update_schedule_shift" ON public.schedule_shift;
CREATE POLICY "jwt_update_schedule_shift"
  ON public.schedule_shift FOR UPDATE
  USING (is_admin_in_workspace(auth.uid(), workspace_id))
  WITH CHECK (is_admin_in_workspace(auth.uid(), workspace_id));

-- JWT path: admins can delete shifts
DROP POLICY IF EXISTS "jwt_delete_schedule_shift" ON public.schedule_shift;
CREATE POLICY "jwt_delete_schedule_shift"
  ON public.schedule_shift FOR DELETE
  USING (is_admin_in_workspace(auth.uid(), workspace_id));

-- API key path: read access
DROP POLICY IF EXISTS "api_key_read_schedule_shift" ON public.schedule_shift;
CREATE POLICY "api_key_read_schedule_shift"
  ON public.schedule_shift FOR SELECT
  USING (workspace_id = get_api_workspace_id());

-- API key path: write access
DROP POLICY IF EXISTS "api_key_insert_schedule_shift" ON public.schedule_shift;
CREATE POLICY "api_key_insert_schedule_shift"
  ON public.schedule_shift FOR INSERT
  WITH CHECK (workspace_id = get_api_workspace_id());

-- API key path: update access
DROP POLICY IF EXISTS "api_key_update_schedule_shift" ON public.schedule_shift;
CREATE POLICY "api_key_update_schedule_shift"
  ON public.schedule_shift FOR UPDATE
  USING (workspace_id = get_api_workspace_id())
  WITH CHECK (workspace_id = get_api_workspace_id());

-- API key path: delete access
DROP POLICY IF EXISTS "api_key_delete_schedule_shift" ON public.schedule_shift;
CREATE POLICY "api_key_delete_schedule_shift"
  ON public.schedule_shift FOR DELETE
  USING (workspace_id = get_api_workspace_id());

-- ── Indexes ──────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_schedule_shift_workspace_date
  ON public.schedule_shift (workspace_id, shift_date);

CREATE INDEX IF NOT EXISTS idx_schedule_shift_employee_date
  ON public.schedule_shift (employee_id, shift_date);

CREATE INDEX IF NOT EXISTS idx_schedule_shift_workspace_status
  ON public.schedule_shift (workspace_id, status);

-- ── Trigger ──────────────────────────────────────────────────

DROP TRIGGER IF EXISTS set_schedule_shift_updated_at ON public.schedule_shift;
CREATE TRIGGER set_schedule_shift_updated_at
  BEFORE UPDATE ON public.schedule_shift
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
