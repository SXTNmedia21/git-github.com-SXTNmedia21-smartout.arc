-- Allow admins/owners to update profiles in their workspace
-- Coexists with existing "Users can update own profile" policy (OR'd by Postgres)
CREATE POLICY "Admins can update profiles in their workspace"
ON public.profile FOR UPDATE
USING (is_admin_in_workspace(auth.uid(), workspace_id))
WITH CHECK (is_admin_in_workspace(auth.uid(), workspace_id));
