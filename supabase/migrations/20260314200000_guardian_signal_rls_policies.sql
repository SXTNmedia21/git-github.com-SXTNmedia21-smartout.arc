-- Add missing API key RLS policy and JWT UPDATE policy on guardian_signal
-- Required by CLAUDE.md: workspace-scoped tables need BOTH JWT and API key auth paths

-- API key read access
CREATE POLICY "api_key_read_guardian_signal" ON guardian_signal
  FOR SELECT
  USING (workspace_id = get_api_workspace_id());

-- JWT users (admin/owner) can update signals (acknowledge, dismiss, resolve)
CREATE POLICY "Workspace members can update signals" ON guardian_signal
  FOR UPDATE
  USING (workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid())))
  WITH CHECK (workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid())));
