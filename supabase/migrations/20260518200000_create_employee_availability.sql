-- Task G (sortie 2, employee-availability-v1) — D2 source-data table 1 of 2
-- Per 2026-04-23 Council verdict ADR-0200 (three-table model).
--
-- Employees' hard availability rules:
--   - unavailable: cannot work this window (e.g. school, second job)
--   - preferred:   happy to work this window (employee-declared positive)
--   - blocked:     admin-imposed block (e.g. contractual, training leave)
--
-- Recurrence via RFC-5545 `rrule` column (null = one-off). `valid_from`/`valid_to`
-- bound the rule's effective window; `valid_to` null = indefinite.

CREATE TABLE public.employee_availability (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspace(workspace_id) ON DELETE CASCADE,
  profile_id UUID NOT NULL REFERENCES public.profile(profile_id) ON DELETE CASCADE,
  valid_from DATE NOT NULL,
  valid_to DATE,
  rrule TEXT,
  preference_type TEXT NOT NULL CHECK (preference_type IN ('unavailable','preferred','blocked')),
  reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID NOT NULL REFERENCES public.profile(profile_id)
);

CREATE INDEX idx_emp_avail_workspace_profile_from
  ON public.employee_availability(workspace_id, profile_id, valid_from);

CREATE INDEX idx_emp_avail_workspace_period
  ON public.employee_availability(workspace_id, valid_from, valid_to);

-- Keep updated_at fresh on mutation (reuses shared trigger function).
CREATE TRIGGER set_employee_availability_updated_at
  BEFORE UPDATE ON public.employee_availability
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.employee_availability ENABLE ROW LEVEL SECURITY;

-- JWT policies
-- Read: row's profile is the caller, OR row's workspace is in caller's workspaces
-- (so workspace admins and schedulers can read peers' availability).
CREATE POLICY "jwt_read_employee_availability" ON public.employee_availability
  FOR SELECT USING (
    profile_id IN (SELECT profile_id FROM public.profile WHERE user_id = auth.uid())
    OR workspace_id IN (SELECT public.get_workspace_ids_for_user(auth.uid()))
  );

-- Insert: only for self, and only into workspaces the caller belongs to.
CREATE POLICY "jwt_insert_own_availability" ON public.employee_availability
  FOR INSERT WITH CHECK (
    profile_id IN (SELECT profile_id FROM public.profile WHERE user_id = auth.uid())
    AND workspace_id IN (SELECT public.get_workspace_ids_for_user(auth.uid()))
  );

-- Update: only own rows.
CREATE POLICY "jwt_update_own_availability" ON public.employee_availability
  FOR UPDATE USING (
    profile_id IN (SELECT profile_id FROM public.profile WHERE user_id = auth.uid())
  );

-- Delete: only own rows.
CREATE POLICY "jwt_delete_own_availability" ON public.employee_availability
  FOR DELETE USING (
    profile_id IN (SELECT profile_id FROM public.profile WHERE user_id = auth.uid())
  );

-- API key policy (standard workspace scope).
CREATE POLICY "api_key_read_employee_availability" ON public.employee_availability
  FOR SELECT USING (workspace_id = get_api_workspace_id());

COMMENT ON TABLE public.employee_availability IS
  'D2 source-data: hard availability rules (unavailable/preferred/blocked) with RFC-5545 recurrence. Task G / ADR-0200.';
