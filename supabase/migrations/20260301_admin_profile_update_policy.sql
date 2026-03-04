SET search_path TO public, extensions;

-- Allow admins/owners to update profiles in their workspace
-- Coexists with existing "Users can update own profile" policy (OR'd by Postgres)
DROP POLICY IF EXISTS "Admins can update profiles in their workspace" ON public.profile;
CREATE POLICY "Admins can update profiles in their workspace"
ON public.profile FOR UPDATE
USING (is_admin_in_workspace(auth.uid(), workspace_id))
WITH CHECK (is_admin_in_workspace(auth.uid(), workspace_id));
