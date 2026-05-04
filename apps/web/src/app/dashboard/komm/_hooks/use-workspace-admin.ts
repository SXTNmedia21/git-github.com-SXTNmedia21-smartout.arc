"use client";

/**
 * useWorkspaceAdmin — client-side admin flag for the current user in the
 * active workspace.
 *
 * Mirrors the server-side check in helpdesk-channel-actions.ts:
 * company_member.role IN ('owner', 'admin') AND workspace.company_id
 * resolves for the current user. This is a UX-only signal — the SkrankeTab
 * admin surface is blocked server-side regardless; the hook just hides the
 * tab for non-admins so they're not teased with an edit path they can't use.
 */

import { useQuery } from "@tanstack/react-query";
import { createClient } from "@smartout/supabase/client";
import { useWorkspace } from "@/lib/workspace-context";

export function useWorkspaceAdmin() {
  const { workspace } = useWorkspace();
  const workspaceId = workspace.workspace_id;
  const companyId = workspace.company_id;

  return useQuery({
    queryKey: ["workspace-admin", workspaceId, companyId],
    enabled: Boolean(companyId),
    staleTime: 60_000,
    queryFn: async (): Promise<boolean> => {
      if (!companyId) return false;
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return false;

      const { data } = await supabase
        .from("company_member")
        .select("role")
        .eq("user_id", user.id)
        .eq("company_id", companyId)
        .maybeSingle();

      return data?.role === "owner" || data?.role === "admin";
    },
  });
}
