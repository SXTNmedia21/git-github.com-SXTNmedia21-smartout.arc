-- Task G (sortie 2, employee-availability-v1) — D2 source-data table 2 of 2
-- Per 2026-04-23 Council verdict ADR-0200 (three-table model).
--
-- Soft preferences: weekday / time-of-day shape-of-week wishes.
-- Distinct from employee_availability (hard rules) — these are ranked hints
-- the scheduler uses to improve fit when multiple valid assignments exist.
--
-- Shape fields (day_of_week, time_of_day_start/end) are nullable so a row can
-- express a day-only preference ("I'd prefer weekends"), a time-only preference
-- ("avoid late nights on any day"), or both combined.

CREATE TABLE public.employee_availability_preference (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspace(workspace_id) ON DELETE CASCADE,
  profile_id UUID NOT NULL REFERENCES public.profile(profile_id) ON DELETE CASCADE,
  valid_from DATE NOT NULL,
  valid_to DATE,
  day_of_week SMALLINT CHECK (day_of_week BETWEEN 0 AND 6),
  time_of_day_start TIME,
  time_of_day_end TIME,
  rank SMALLINT NOT NULL CHECK (rank BETWEEN 1 AND 10),
  preference_kind TEXT NOT NULL CHECK (preference_kind IN ('preferred','avoid')),
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID NOT NULL REFERENCES public.profile(profile_id)
);

CREATE INDEX idx_emp_avail_pref_workspace_profile_from
  ON public.employee_availability_preference(workspace_id, profile_id, valid_from);

CREATE INDEX idx_emp_avail_pref_workspace_period
  ON public.employee_availability_preference(workspace_id, valid_from, valid_to);

CREATE TRIGGER set_employee_availability_preference_updated_at
  BEFORE UPDATE ON public.employee_availability_preference
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.employee_availability_preference ENABLE ROW LEVEL SECURITY;

-- JWT policies — same shape as employee_availability (self + workspace read,
-- self-only write).
CREATE POLICY "jwt_read_employee_availability_preference" ON public.employee_availability_preference
  FOR SELECT USING (
    profile_id IN (SELECT profile_id FROM public.profile WHERE user_id = auth.uid())
    OR workspace_id IN (SELECT public.get_workspace_ids_for_user(auth.uid()))
  );

CREATE POLICY "jwt_insert_own_availability_preference" ON public.employee_availability_preference
  FOR INSERT WITH CHECK (
    profile_id IN (SELECT profile_id FROM public.profile WHERE user_id = auth.uid())
    AND workspace_id IN (SELECT public.get_workspace_ids_for_user(auth.uid()))
  );

CREATE POLICY "jwt_update_own_availability_preference" ON public.employee_availability_preference
  FOR UPDATE USING (
    profile_id IN (SELECT profile_id FROM public.profile WHERE user_id = auth.uid())
  );

CREATE POLICY "jwt_delete_own_availability_preference" ON public.employee_availability_preference
  FOR DELETE USING (
    profile_id IN (SELECT profile_id FROM public.profile WHERE user_id = auth.uid())
  );

-- API key policy (standard workspace scope).
CREATE POLICY "api_key_read_employee_availability_preference" ON public.employee_availability_preference
  FOR SELECT USING (workspace_id = get_api_workspace_id());

COMMENT ON TABLE public.employee_availability_preference IS
  'D2 source-data: soft ranked preferences on shape-of-week (day/time windows). Task G / ADR-0200.';
