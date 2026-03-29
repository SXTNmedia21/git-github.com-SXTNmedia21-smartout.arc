-- Fix manage policies missing WITH CHECK clause
-- profile_legal_function, profile_access, profile_position
-- Without WITH CHECK, INSERT/UPDATE could bypass workspace+admin scope guard on writes.

DROP POLICY IF EXISTS "manage_profile_legal_functions" ON public.profile_legal_function;
CREATE POLICY "manage_profile_legal_functions" ON public.profile_legal_function
  FOR ALL USING (profile_id IN (
    SELECT profile_id FROM profile
    WHERE workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid()))
      AND is_admin_in_workspace(auth.uid(), workspace_id)
  ))
  WITH CHECK (profile_id IN (
    SELECT profile_id FROM profile
    WHERE workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid()))
      AND is_admin_in_workspace(auth.uid(), workspace_id)
  ));

DROP POLICY IF EXISTS "manage_profile_access" ON public.profile_access;
CREATE POLICY "manage_profile_access" ON public.profile_access
  FOR ALL USING (profile_id IN (
    SELECT profile_id FROM profile
    WHERE workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid()))
      AND is_admin_in_workspace(auth.uid(), workspace_id)
  ))
  WITH CHECK (profile_id IN (
    SELECT profile_id FROM profile
    WHERE workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid()))
      AND is_admin_in_workspace(auth.uid(), workspace_id)
  ));

DROP POLICY IF EXISTS "manage_profile_positions" ON public.profile_position;
CREATE POLICY "manage_profile_positions" ON public.profile_position
  FOR ALL USING (profile_id IN (
    SELECT profile_id FROM profile
    WHERE workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid()))
      AND is_admin_in_workspace(auth.uid(), workspace_id)
  ))
  WITH CHECK (profile_id IN (
    SELECT profile_id FROM profile
    WHERE workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid()))
      AND is_admin_in_workspace(auth.uid(), workspace_id)
  ));
