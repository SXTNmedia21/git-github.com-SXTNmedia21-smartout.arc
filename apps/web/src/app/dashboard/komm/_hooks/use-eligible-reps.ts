"use client";

/**
 * useEligibleReps — list of profiles that can be assigned as a helpdesk
 * responsible rep (ADR-0165, preserves the legacy desks/page filter).
 *
 * Server-side Server Actions re-validate eligibility on every mutation, so
 * this hook is purely a UX filter — admins only see candidates the backend
 * would accept, not every workspace member.
 */

import { useQuery } from "@tanstack/react-query";
import { createClient } from "@smartout/supabase/client";
import { useWorkspace } from "@/lib/workspace-context";
import type { ResponsibleRep } from "../_components/ResponsibleRepCombobox";

type ProfileLite = {
  profile_id: string;
  display_name: string | null;
  avatar_url: string | null;
  role: string;
};

export function useEligibleReps(enabled: boolean) {
  const { workspace } = useWorkspace();
  const workspaceId = workspace.workspace_id;

  return useQuery({
    queryKey: ["eligible-reps", workspaceId],
    enabled,
    staleTime: 60_000,
    queryFn: async (): Promise<ResponsibleRep[]> => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("profile")
        .select("profile_id, display_name, avatar_url, role")
        .eq("workspace_id", workspaceId)
        .eq("is_active", true)
        .in("role", ["manager", "admin", "owner"])
        .order("display_name", { ascending: true });
      if (error) throw error;

      return ((data ?? []) as ProfileLite[]).map((r) => ({
        profile_id: r.profile_id,
        display_name: r.display_name ?? "ukjent",
        avatar_url: r.avatar_url,
        role: r.role,
      }));
    },
  });
}
