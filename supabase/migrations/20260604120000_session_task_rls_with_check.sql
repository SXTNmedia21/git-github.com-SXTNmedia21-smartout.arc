-- 20260604120000_session_task_rls_with_check.sql
-- Sortie 1 — Defense closure for session_task UPDATE.
-- Per ADR-0298 R5 + Spec §4.6: session_task UPDATE policy must include
-- WITH CHECK + actor predicate that tolerates unassigned-task pickup flow
-- (D6 cascade state machine — assigned_to flips NULL → caller during pickup).

DROP POLICY IF EXISTS "jwt_update_session_task" ON public.session_task;

CREATE POLICY "jwt_update_session_task" ON public.session_task
  FOR UPDATE
  USING (
    workspace_id IN (SELECT public.get_workspace_ids_for_user(auth.uid()))
  )
  WITH CHECK (
    workspace_id IN (SELECT public.get_workspace_ids_for_user(auth.uid()))
    AND (
      -- Assignee completes own task
      assigned_to IN (
        SELECT profile_id FROM public.profile
        WHERE user_id = auth.uid() AND is_active = true
      )
      -- OR task is unassigned (pickup flow per D6 cascade — preserves
      -- session_hook_dispatcher cron-creates-then-employee-picks-up)
      OR assigned_to IS NULL
      -- OR admin in workspace (2-arg signature per 00004_rls_policies.sql:33)
      OR public.is_admin_in_workspace(auth.uid(), workspace_id)
    )
  );
