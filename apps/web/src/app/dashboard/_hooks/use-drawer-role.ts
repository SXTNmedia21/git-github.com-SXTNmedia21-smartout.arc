"use client";

/**
 * Hook for RoleRichCard: counts profiles with the given role in the workspace
 * and lists them. Role is a concept-card (profile_role enum), not a DB entity.
 * Valid values: employee | manager | admin | owner | system
 */

import { useQuery } from "@tanstack/react-query";
import { useWorkspaceOptional } from "@/lib/workspace-context";
import { createClient } from "@smartout/supabase/client";

export type ProfileRole = "employee" | "manager" | "admin" | "owner" | "system";

export function useDrawerRole(role: ProfileRole) {
  const ctx = useWorkspaceOptional();
  const wsId = ctx?.workspace.workspace_id;
  const supabase = createClient();

  return useQuery({
    queryKey: ["dashboard", "entity-drawer", "role", wsId ?? "none", role] as const,
    queryFn: async () => {
      const { data: profiles, count } = await supabase
        .from("profile")
        .select(
          "profile_id, display_name, status, department_id, department:department!department_id(name)",
          {
            count: "exact",
          },
        )
        .eq("workspace_id", wsId!)
        .eq("role", role)
        .eq("is_active", true)
        .order("display_name")
        .limit(20);

      return {
        profiles: (profiles ?? []).map((p) => ({
          profile_id: p.profile_id,
          display_name: p.display_name,
          status: p.status,
          department_name: (p.department as { name: string } | null)?.name ?? null,
        })),
        count: count ?? profiles?.length ?? 0,
      };
    },
    enabled: !!wsId && !!role,
    staleTime: 30_000,
  });
}

export type DrawerRoleData = ReturnType<typeof useDrawerRole>["data"];
