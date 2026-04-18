"use server";

import { createClient } from "@smartout/supabase/server";
import { createAdminClient } from "@smartout/supabase/admin";

// Shared workspace-admin auth helpers for the dispatch-rules CRUD
// wrappers. Mirrors the company-scoped pattern from
// _actions/queries.ts + markInvoicePaidAction — billing is a
// company-admin surface, so workspaces are resolved via company_id.

export type WorkspaceAdminContext = {
  user_id: string;
  company_id: string;
  workspace_ids: string[];
};

/**
 * Resolve the caller's company + authorised workspace IDs. Only
 * company_member rows with role in ('admin', 'owner') qualify.
 *
 * Returns null when the user is not authenticated, not an admin
 * anywhere, or when the company has zero workspaces. Callers should
 * treat null as 403/unauthorised and return a generic error to the UI.
 */
export async function resolveWorkspaceAdminContext(): Promise<WorkspaceAdminContext | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const admin = createAdminClient();
  const { data: member } = await admin
    .from("company_member")
    .select("company_id, role")
    .eq("user_id", user.id)
    .eq("is_active", true)
    .in("role", ["admin", "owner"])
    .limit(1)
    .maybeSingle();
  if (!member) return null;

  const { data: workspaces } = await admin
    .from("workspace")
    .select("workspace_id")
    .eq("company_id", member.company_id);

  const workspace_ids = (workspaces ?? []).map((row) => row.workspace_id);
  if (workspace_ids.length === 0) return null;

  return { user_id: user.id, company_id: member.company_id, workspace_ids };
}

/**
 * True when the given workspace_id is in the caller's admin-scope.
 * Workspace-admin dispatch rules always scope to one of these IDs —
 * platform baseline (workspace_id NULL) is never creatable from the
 * workspace UI.
 */
export function isWorkspaceAuthorised(
  ctx: WorkspaceAdminContext,
  workspaceId: string | null | undefined,
): boolean {
  if (!workspaceId) return false;
  return ctx.workspace_ids.includes(workspaceId);
}
