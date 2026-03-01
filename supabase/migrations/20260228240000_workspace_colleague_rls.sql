-- Allow workspace members to read user_identity data for colleagues in their workspace.
-- Required for the people page to display employee contact info (email, phone).

CREATE POLICY "Workspace members can read colleague identity"
  ON public.user_identity FOR SELECT
  USING (
    user_id IN (
      SELECT p.user_id FROM public.profile p
      WHERE p.workspace_id IN (SELECT public.get_workspace_ids_for_user(auth.uid()))
    )
  );
