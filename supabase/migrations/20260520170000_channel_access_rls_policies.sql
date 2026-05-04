-- Migration: RLS policies for channel_department_access + channel_team_access
--
-- Fixes CV-1 (HIGH): both tables had RLS=on with zero policies — complete lockout.
-- access_scope=departments/teams in UI was non-functional at DB layer.
--
-- Design choice (Approach A from the original TODO):
--   Resolve at query time using get_workspace_ids_for_user() + is_admin_in_workspace().
--   These are config/mapping tables accessed infrequently (admin setup, not hot path),
--   so Approach A is sufficient. Approach B (materialised channel_member denorm) can be
--   added later if profiling shows policy evaluation overhead.
--
-- Policy model:
--   SELECT: any workspace member can read (needed so UI can show scope config)
--   INSERT/UPDATE/DELETE: admin or owner in workspace only
--   API key: workspace-scoped read (consistent with channel_* sibling tables)
--
-- Depends on: 20260519200000_channel_access_scope.sql
-- Helper functions: is_admin_in_workspace(uid, wid), get_workspace_ids_for_user(uid),
--                   get_api_workspace_id() — all defined in earlier migrations.
-- ADR-0029: workspace_id scoping on all workspace-scoped tables.

--------------------------------------------------------------------------------
-- channel_department_access
--------------------------------------------------------------------------------

-- SELECT: any workspace member can read the department→channel mapping
CREATE POLICY "channel_dept_access_jwt_select"
  ON public.channel_department_access
  FOR SELECT
  USING (workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid())));

-- INSERT: admin/owner only
CREATE POLICY "channel_dept_access_jwt_insert"
  ON public.channel_department_access
  FOR INSERT
  WITH CHECK (is_admin_in_workspace(auth.uid(), workspace_id));

-- UPDATE: admin/owner only
CREATE POLICY "channel_dept_access_jwt_update"
  ON public.channel_department_access
  FOR UPDATE
  USING (is_admin_in_workspace(auth.uid(), workspace_id));

-- DELETE: admin/owner only
CREATE POLICY "channel_dept_access_jwt_delete"
  ON public.channel_department_access
  FOR DELETE
  USING (is_admin_in_workspace(auth.uid(), workspace_id));

-- API key: workspace-scoped read
CREATE POLICY "channel_dept_access_api_select"
  ON public.channel_department_access
  FOR SELECT
  USING (workspace_id = get_api_workspace_id());

--------------------------------------------------------------------------------
-- channel_team_access
--------------------------------------------------------------------------------

-- SELECT: any workspace member can read the team→channel mapping
CREATE POLICY "channel_team_access_jwt_select"
  ON public.channel_team_access
  FOR SELECT
  USING (workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid())));

-- INSERT: admin/owner only
CREATE POLICY "channel_team_access_jwt_insert"
  ON public.channel_team_access
  FOR INSERT
  WITH CHECK (is_admin_in_workspace(auth.uid(), workspace_id));

-- UPDATE: admin/owner only
CREATE POLICY "channel_team_access_jwt_update"
  ON public.channel_team_access
  FOR UPDATE
  USING (is_admin_in_workspace(auth.uid(), workspace_id));

-- DELETE: admin/owner only
CREATE POLICY "channel_team_access_jwt_delete"
  ON public.channel_team_access
  FOR DELETE
  USING (is_admin_in_workspace(auth.uid(), workspace_id));

-- API key: workspace-scoped read
CREATE POLICY "channel_team_access_api_select"
  ON public.channel_team_access
  FOR SELECT
  USING (workspace_id = get_api_workspace_id());
