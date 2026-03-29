"use client";

import { useQuery } from "@tanstack/react-query";
import { useWorkspaceOptional } from "@/lib/workspace-context";
import { createClient } from "@smartout/supabase/client";
import { dashboardKeys } from "./dashboard-keys";

export function useDrawerProfile(profileId: string) {
  const ctx = useWorkspaceOptional();
  const wsId = ctx?.workspace.workspace_id;
  const supabase = createClient();

  return useQuery({
    queryKey: dashboardKeys.drawerProfile(wsId ?? "none", profileId),
    queryFn: async () => {
      const [profileRes, contractRes] = await Promise.all([
        supabase
          .from("profile")
          .select(
            "profile_id, display_name, role, status, is_active, department_id, job_title, avatar_url, department:department!department_id(name)",
          )
          .eq("profile_id", profileId)
          .single(),
        supabase
          .from("employment_contract")
          .select("employment_category, employment_percentage")
          .eq("profile_id", profileId)
          .eq("status", "signed")
          .maybeSingle(),
      ]);

      if (profileRes.error) throw profileRes.error;

      return {
        profile: profileRes.data,
        contract: contractRes.data,
      };
    },
    enabled: !!wsId && !!profileId,
    staleTime: 30_000,
  });
}
