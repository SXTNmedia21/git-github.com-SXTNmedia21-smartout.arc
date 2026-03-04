SET search_path TO public, extensions;

-- ============================================
-- 20260302000300_employee_roster.sql
-- Creates the employee_roster table for the turnus system.
-- Stores recurring weekly shift patterns per employee
-- that can be auto-filled into schedule_shift.
-- Connected to: schedule_shift (auto-fill target)
-- Connected to: profile (employee), workspace (tenant)
-- ============================================

-- ── Table ────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.employee_roster (
  employee_roster_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id         UUID NOT NULL REFERENCES public.profile(profile_id) ON DELETE CASCADE,
  workspace_id       UUID NOT NULL REFERENCES public.workspace(workspace_id) ON DELETE CASCADE,

  -- Recurring pattern: { "mon": "08:00-16:00", "tue": "08:00-16:00", ... }
  -- Keys: mon, tue, wed, thu, fri, sat, sun
  -- Values: "HH:MM-HH:MM" or null (no shift that day)
  pattern            JSONB NOT NULL,

  -- Active period for this pattern
  period_start       DATE NOT NULL,
  period_end         DATE,            -- NULL = ongoing / no end date
  is_active          BOOLEAN NOT NULL DEFAULT true,

  -- Timestamps
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── Comments ─────────────────────────────────────────────────

COMMENT ON TABLE public.employee_roster IS 'Recurring weekly shift patterns (turnus) per employee. Used to auto-fill draft shifts.';
COMMENT ON COLUMN public.employee_roster.pattern IS 'JSONB object mapping weekday keys (mon-sun) to time ranges "HH:MM-HH:MM" or null.';
COMMENT ON COLUMN public.employee_roster.period_end IS 'NULL means the pattern has no end date (ongoing).';

-- ── RLS ──────────────────────────────────────────────────────

ALTER TABLE public.employee_roster ENABLE ROW LEVEL SECURITY;

-- JWT path: any workspace member can read rosters
DROP POLICY IF EXISTS "jwt_read_employee_roster" ON public.employee_roster;
CREATE POLICY "jwt_read_employee_roster"
  ON public.employee_roster FOR SELECT
  USING (workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid())));

-- JWT path: admins can insert rosters
DROP POLICY IF EXISTS "jwt_insert_employee_roster" ON public.employee_roster;
CREATE POLICY "jwt_insert_employee_roster"
  ON public.employee_roster FOR INSERT
  WITH CHECK (is_admin_in_workspace(auth.uid(), workspace_id));

-- JWT path: admins can update rosters
DROP POLICY IF EXISTS "jwt_update_employee_roster" ON public.employee_roster;
CREATE POLICY "jwt_update_employee_roster"
  ON public.employee_roster FOR UPDATE
  USING (is_admin_in_workspace(auth.uid(), workspace_id))
  WITH CHECK (is_admin_in_workspace(auth.uid(), workspace_id));

-- JWT path: admins can delete rosters
DROP POLICY IF EXISTS "jwt_delete_employee_roster" ON public.employee_roster;
CREATE POLICY "jwt_delete_employee_roster"
  ON public.employee_roster FOR DELETE
  USING (is_admin_in_workspace(auth.uid(), workspace_id));

-- API key path: read access
DROP POLICY IF EXISTS "api_key_read_employee_roster" ON public.employee_roster;
CREATE POLICY "api_key_read_employee_roster"
  ON public.employee_roster FOR SELECT
  USING (workspace_id = get_api_workspace_id());

-- API key path: write access
DROP POLICY IF EXISTS "api_key_insert_employee_roster" ON public.employee_roster;
CREATE POLICY "api_key_insert_employee_roster"
  ON public.employee_roster FOR INSERT
  WITH CHECK (workspace_id = get_api_workspace_id());

DROP POLICY IF EXISTS "api_key_update_employee_roster" ON public.employee_roster;
CREATE POLICY "api_key_update_employee_roster"
  ON public.employee_roster FOR UPDATE
  USING (workspace_id = get_api_workspace_id())
  WITH CHECK (workspace_id = get_api_workspace_id());

DROP POLICY IF EXISTS "api_key_delete_employee_roster" ON public.employee_roster;
CREATE POLICY "api_key_delete_employee_roster"
  ON public.employee_roster FOR DELETE
  USING (workspace_id = get_api_workspace_id());

-- ── Indexes ──────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_employee_roster_workspace
  ON public.employee_roster (workspace_id);

CREATE INDEX IF NOT EXISTS idx_employee_roster_profile
  ON public.employee_roster (profile_id);

CREATE INDEX IF NOT EXISTS idx_employee_roster_active
  ON public.employee_roster (workspace_id, is_active)
  WHERE is_active = true;

-- ── Trigger ──────────────────────────────────────────────────

DROP TRIGGER IF EXISTS set_employee_roster_updated_at ON public.employee_roster;
CREATE TRIGGER set_employee_roster_updated_at
  BEFORE UPDATE ON public.employee_roster
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
