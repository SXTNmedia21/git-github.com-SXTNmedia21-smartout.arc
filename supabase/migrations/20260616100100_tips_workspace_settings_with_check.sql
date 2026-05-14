-- ════════════════════════════════════════════════════════════════════════════
-- 20260616100100_tips_workspace_settings_with_check.sql
-- ----------------------------------------------------------------------------
-- F-DB-14 (LOW): tips_workspace_settings UPDATE policy was missing WITH CHECK.
-- Without WITH CHECK an authenticated user could UPDATE the row and change
-- workspace_id to any arbitrary value (forge-by-body on UPDATE).
--
-- Fix: drop the existing UPDATE policy, recreate with WITH CHECK matching
-- the USING expression exactly (workspace_id membership check).
--
-- Source policy was created in 20260428220006_tips_workspace_settings.sql:
--   CREATE POLICY "jwt_update_tips_workspace_settings" ... FOR UPDATE
--   USING (workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid())));
-- ════════════════════════════════════════════════════════════════════════════

SET search_path TO public, extensions;

DROP POLICY IF EXISTS "jwt_update_tips_workspace_settings" ON public.tips_workspace_settings;
CREATE POLICY "jwt_update_tips_workspace_settings"
  ON public.tips_workspace_settings
  FOR UPDATE
  USING (workspace_id IN (SELECT public.get_workspace_ids_for_user(auth.uid())))
  WITH CHECK (workspace_id IN (SELECT public.get_workspace_ids_for_user(auth.uid())));
