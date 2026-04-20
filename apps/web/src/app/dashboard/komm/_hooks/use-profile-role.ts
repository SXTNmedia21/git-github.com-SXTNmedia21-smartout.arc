"use client";

/**
 * useProfileRole — Fetches the current user's profile role from the profile table.
 * Used for role-gated UI (e.g. compose button visible only for managers+).
 */

import { useQuery } from "@tanstack/react-query";
import { createClient } from "@smartout/supabase/client";
import { useWorkspace } from "@/lib/workspace-context";

export type ProfileRole = "employee" | "manager" | "admin" | "owner";

const ROLE_HIERARCHY: Record<ProfileRole, number> = {
  employee: 0,
  manager: 1,
  admin: 2,
  owner: 3,
};

export function useProfileRole(profileId: string) {
  const { workspace } = useWorkspace();
  const workspaceId = workspace.workspace_id;

  const query = useQuery({
    queryKey: ["profile-role", workspaceId, profileId],
    staleTime: 60_000,
    queryFn: async (): Promise<ProfileRole> => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("profile")
        .select("role")
        .eq("profile_id", profileId)
        .eq("workspace_id", workspaceId)
        .single();

      if (error) throw error;
      return (data.role as ProfileRole) ?? "employee";
    },
  });

  const role = query.data ?? "employee";
  const isAtLeast = (minRole: ProfileRole) => ROLE_HIERARCHY[role] >= ROLE_HIERARCHY[minRole];

  return { ...query, role, isAtLeast };
}
