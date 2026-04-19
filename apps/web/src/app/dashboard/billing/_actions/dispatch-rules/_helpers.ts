export type WorkspaceAdminContext = {
  user_id: string;
  company_id: string;
  workspace_ids: string[];
};

// Workspace-admin dispatch rules always scope to one of the caller's
// authorised workspace IDs — platform baseline (workspace_id NULL) is
// never creatable from the workspace UI.
export function isWorkspaceAuthorised(
  ctx: WorkspaceAdminContext,
  workspaceId: string | null | undefined,
): boolean {
  if (!workspaceId) return false;
  return ctx.workspace_ids.includes(workspaceId);
}
