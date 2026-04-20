"use client";

import { useQuery } from "@tanstack/react-query";
import { createClient } from "@smartout/supabase/client";
import { useWorkspaceOptional } from "@/lib/workspace-context";

export type CurrentDepartment = {
  departmentId: string;
  departmentName: string;
  source: "profile" | "workspace-fallback";
} | null;

/**
 * Resolves the department the viewer is scoped to for WebDayControl.
 *
 * Preference order:
 *   1. profile.department_id for the current profile (when available)
 *   2. First workspace department by created_at ASC (admin fallback)
 *   3. null → caller renders "no department configured" empty state
 */
export function useCurrentDepartment(profileId: string | null) {
  const ctx = useWorkspaceOptional();
  const wsId = ctx?.workspace.workspace_id;

  return useQuery({
    queryKey: ["day-control", "current-department", wsId, profileId],
    enabled: !!wsId,
    staleTime: 5 * 60 * 1000,
    queryFn: async (): Promise<CurrentDepartment> => {
      const supabase = createClient();

      // 1. Try profile.department_id
      if (profileId) {
        const { data: profile, error: profileErr } = await supabase
          .from("profile")
          .select("department_id, department:department_id(department_id, name)")
          .eq("profile_id", profileId)
          .maybeSingle();

        if (profileErr) throw profileErr;

        const dept = profile?.department as unknown as {
          department_id: string;
          name: string;
        } | null;
        if (dept) {
          return {
            departmentId: dept.department_id,
            departmentName: dept.name,
            source: "profile",
          };
        }
      }

      // 2. Fallback: first workspace department
      const { data: fallback, error: fbErr } = await supabase
        .from("department")
        .select("department_id, name")
        .eq("workspace_id", wsId!)
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle();

      if (fbErr) throw fbErr;
      if (!fallback) return null;

      return {
        departmentId: fallback.department_id,
        departmentName: fallback.name,
        source: "workspace-fallback",
      };
    },
  });
}
