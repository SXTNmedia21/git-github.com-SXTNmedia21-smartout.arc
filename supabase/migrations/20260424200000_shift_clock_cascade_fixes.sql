-- Fix missing ON DELETE CASCADE on shift_clock_config and shift_note FKs.
-- Original migration (20260324100001) created tables without CASCADE.
-- Later migrations (20260422500000/500100) were no-ops due to IF NOT EXISTS.
-- Council verdict 2026-03-26: must ship before shift clock goes to production.

-- 1. shift_clock_config: add CASCADE to workspace_id, department_id, team_id
ALTER TABLE public.shift_clock_config
  DROP CONSTRAINT shift_clock_config_workspace_id_fkey,
  ADD CONSTRAINT shift_clock_config_workspace_id_fkey
    FOREIGN KEY (workspace_id) REFERENCES public.workspace(workspace_id) ON DELETE CASCADE;

ALTER TABLE public.shift_clock_config
  DROP CONSTRAINT shift_clock_config_department_id_fkey,
  ADD CONSTRAINT shift_clock_config_department_id_fkey
    FOREIGN KEY (department_id) REFERENCES public.department(department_id) ON DELETE CASCADE;

ALTER TABLE public.shift_clock_config
  DROP CONSTRAINT shift_clock_config_team_id_fkey,
  ADD CONSTRAINT shift_clock_config_team_id_fkey
    FOREIGN KEY (team_id) REFERENCES public.team(team_id) ON DELETE CASCADE;

-- 2. shift_note: add CASCADE to shift_id and workspace_id
ALTER TABLE public.shift_note
  DROP CONSTRAINT shift_note_shift_id_fkey,
  ADD CONSTRAINT shift_note_shift_id_fkey
    FOREIGN KEY (shift_id) REFERENCES public.schedule_shift(schedule_shift_id) ON DELETE CASCADE;

ALTER TABLE public.shift_note
  DROP CONSTRAINT shift_note_workspace_id_fkey,
  ADD CONSTRAINT shift_note_workspace_id_fkey
    FOREIGN KEY (workspace_id) REFERENCES public.workspace(workspace_id) ON DELETE CASCADE;

-- 3. Fix shift_note INSERT policy — add workspace_id check
DROP POLICY IF EXISTS "jwt_insert_shift_note" ON public.shift_note;
CREATE POLICY "jwt_insert_shift_note" ON public.shift_note
  FOR INSERT
  WITH CHECK (
    workspace_id IN (SELECT public.get_workspace_ids_for_user(auth.uid()))
    AND profile_id IN (
      SELECT profile_id FROM public.profile WHERE user_id = auth.uid()
    )
  );
