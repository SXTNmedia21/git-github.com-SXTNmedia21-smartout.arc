"use client";

import { useQuery } from "@tanstack/react-query";
import { useWorkspaceOptional } from "@/lib/workspace-context";
import { createClient } from "@smartout/supabase/client";
import { dashboardKeys } from "./dashboard-keys";

export type SetupModule = {
  id: string;
  label: string;
  description: string;
  href: string;
  isComplete: boolean;
};

export type WorkspaceSetupStatus = {
  needsSetup: boolean;
  modules: SetupModule[];
};

export function useWorkspaceSetup() {
  const ctx = useWorkspaceOptional();
  const workspaceId = ctx?.workspace.workspace_id;

  return useQuery({
    queryKey: dashboardKeys.workspaceSetupStatus(workspaceId ?? "none"),
    enabled: !!workspaceId,
    staleTime: 30 * 1000,
    queryFn: async (): Promise<WorkspaceSetupStatus> => {
      const wsId = workspaceId!;
      const supabase = createClient();

      const [policies, profiles, shifts, seasons] = await Promise.all([
        supabase
          .from("policy")
          .select("*", { count: "exact", head: true })
          .eq("workspace_id", wsId),
        supabase
          .from("profile")
          .select("*", { count: "exact", head: true })
          .eq("workspace_id", wsId)
          .eq("is_active", true),
        supabase
          .from("schedule_shift")
          .select("*", { count: "exact", head: true })
          .eq("workspace_id", wsId),
        supabase
          .from("season")
          .select("*", { count: "exact", head: true })
          .eq("workspace_id", wsId)
          .eq("status", "active"),
      ]);

      const policyCount = policies.count ?? 0;
      const profileCount = profiles.count ?? 0;
      const shiftCount = shifts.count ?? 0;
      const hasActiveSeason = (seasons.count ?? 0) > 0;

      const modules: SetupModule[] = [
        {
          id: "governance",
          label: "Retningslinjer og handbok",
          description: "Sett opp retningslinjer, prosedyrer og personalhandbok",
          href: "/dashboard/governance",
          isComplete: policyCount >= 3,
        },
        {
          id: "people",
          label: "Inviter ansatte",
          description: "Legg til teamet ditt",
          href: "/dashboard/people",
          isComplete: profileCount > 1,
        },
        {
          id: "schedule",
          label: "Lag forste vaktplan",
          description: "Planlegg vakter for neste uke",
          href: "/dashboard/schedule",
          isComplete: shiftCount > 0,
        },
        {
          id: "season",
          label: "Aktiver sesong",
          description: "Sett budsjettmal og start sesongen",
          href: "/dashboard/year-wheel",
          isComplete: hasActiveSeason,
        },
      ];

      return {
        needsSetup: modules.some((m) => !m.isComplete),
        modules,
      };
    },
  });
}
