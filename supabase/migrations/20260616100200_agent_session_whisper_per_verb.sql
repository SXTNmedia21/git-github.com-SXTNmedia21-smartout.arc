-- ════════════════════════════════════════════════════════════════════════════
-- 20260616100200_agent_session_whisper_per_verb.sql
-- ----------------------------------------------------------------------------
-- F-DB-15 (LOW): agent_session_whisper had a single FOR ALL policy without
-- WITH CHECK, allowing a body-supplied workspace_id forge on INSERT/UPDATE.
--
-- ADR-0185: whisper is workspace-admin-only metadata; full audit is intentional.
-- Godmode (platform-admin cross-workspace) FOR ALL policy is INTENTIONAL and
-- is left as-is — godmode trust model grants full workspace visibility by design.
--
-- Fix: split jwt_admin_rw_whisper FOR ALL into 4 per-verb policies, adding
-- WITH CHECK on INSERT and UPDATE that mirrors the USING expression.
--
-- Source policy in 20260515120300_agent_session_whisper.sql:
--   CREATE POLICY "jwt_admin_rw_whisper" ON public.agent_session_whisper
--   FOR ALL USING (
--     workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid()))
--     AND is_admin_in_workspace(auth.uid(), workspace_id)
--   );
-- ════════════════════════════════════════════════════════════════════════════

SET search_path TO public, extensions;

-- Drop the single FOR ALL policy — replace with 4 per-verb policies below.
DROP POLICY IF EXISTS "jwt_admin_rw_whisper" ON public.agent_session_whisper;

-- SELECT: workspace admin reads their whispers
CREATE POLICY "jwt_admin_select_whisper"
  ON public.agent_session_whisper
  FOR SELECT
  USING (
    workspace_id IN (SELECT public.get_workspace_ids_for_user(auth.uid()))
    AND public.is_admin_in_workspace(auth.uid(), workspace_id)
  );

-- INSERT: workspace admin creates whispers; WITH CHECK prevents forge-by-body
CREATE POLICY "jwt_admin_insert_whisper"
  ON public.agent_session_whisper
  FOR INSERT
  WITH CHECK (
    workspace_id IN (SELECT public.get_workspace_ids_for_user(auth.uid()))
    AND public.is_admin_in_workspace(auth.uid(), workspace_id)
  );

-- UPDATE: workspace admin marks whisper consumed; WITH CHECK prevents workspace_id change
CREATE POLICY "jwt_admin_update_whisper"
  ON public.agent_session_whisper
  FOR UPDATE
  USING (
    workspace_id IN (SELECT public.get_workspace_ids_for_user(auth.uid()))
    AND public.is_admin_in_workspace(auth.uid(), workspace_id)
  )
  WITH CHECK (
    workspace_id IN (SELECT public.get_workspace_ids_for_user(auth.uid()))
    AND public.is_admin_in_workspace(auth.uid(), workspace_id)
  );

-- DELETE: workspace admin can delete whispers (e.g. revoke before consumption)
CREATE POLICY "jwt_admin_delete_whisper"
  ON public.agent_session_whisper
  FOR DELETE
  USING (
    workspace_id IN (SELECT public.get_workspace_ids_for_user(auth.uid()))
    AND public.is_admin_in_workspace(auth.uid(), workspace_id)
  );

-- NOTE: godmode_rw_whisper (FOR ALL, cross-workspace) is intentional per ADR-0185
-- and is NOT modified by this migration. Godmode trust model is explicit.
