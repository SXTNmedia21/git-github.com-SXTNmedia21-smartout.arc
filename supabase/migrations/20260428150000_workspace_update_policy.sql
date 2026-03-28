-- Allow admins/owners to update their own workspaces.
-- Required for: setup wizard completion (setup_guide_completed), workspace settings.

CREATE POLICY "Admins can update workspace"
  ON public.workspace
  FOR UPDATE
  USING (
    workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid()))
    AND EXISTS (
      SELECT 1 FROM public.profile
      WHERE profile.workspace_id = workspace.workspace_id
        AND profile.user_id = auth.uid()
        AND profile.role IN ('admin', 'owner')
    )
  )
  WITH CHECK (
    workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid()))
    AND EXISTS (
      SELECT 1 FROM public.profile
      WHERE profile.workspace_id = workspace.workspace_id
        AND profile.user_id = auth.uid()
        AND profile.role IN ('admin', 'owner')
    )
  );
