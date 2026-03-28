-- Add duty leader to department_session
-- The person on duty receives "ring sjefen" calls from employees.
-- Defaults to opened_by but can be changed during the session.

ALTER TABLE public.department_session
  ADD COLUMN IF NOT EXISTS duty_leader_id uuid REFERENCES public.profile(profile_id);

COMMENT ON COLUMN public.department_session.duty_leader_id
  IS 'Profile on duty — receives call-leader calls. Set when session opens, can be changed during the day.';
