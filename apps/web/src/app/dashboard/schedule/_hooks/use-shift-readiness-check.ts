"use client";

/**
 * Pre-fetches readiness data for all active/trainee profiles in the workspace.
 * Returns a Map<profileId, { readinessPercent, pendingProtocols }> for O(1)
 * lookup during shift DnD assignment.
 *
 * Connected to: protocol_assignment, protocol tables
 * Used by: page.tsx handleDragEnd for readiness warnings
 */

import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";

import { createClient } from "@smartout/supabase/client";
import { useWorkspace } from "@/lib/workspace-context";

export type ShiftReadinessEntry = {
  profileId: string;
  readinessPercent: number;
  pendingProtocols: string[];
};

export function useShiftReadinessCheck() {
  const { workspace } = useWorkspace();

  const query = useQuery({
    queryKey: ["schedule", "shift-readiness", workspace.workspace_id],
    staleTime: 60_000,
    queryFn: async (): Promise<Map<string, ShiftReadinessEntry>> => {
      const supabase = createClient();

      const { data, error } = await supabase
        .from("protocol_assignment")
        .select("profile_id, status, protocol:protocol_id(name, workspace_id)")
        .eq("protocol.workspace_id", workspace.workspace_id);

      if (error) throw error;

      const byProfile = new Map<
        string,
        { completed: number; total: number; pendingNames: string[] }
      >();

      for (const row of data ?? []) {
        if (!row.protocol) continue;

        let entry = byProfile.get(row.profile_id);
        if (!entry) {
          entry = { completed: 0, total: 0, pendingNames: [] };
          byProfile.set(row.profile_id, entry);
        }

        entry.total += 1;
        if (row.status === "completed") {
          entry.completed += 1;
        } else {
          const name = (row.protocol as { name: string }).name;
          entry.pendingNames.push(name);
        }
      }

      const result = new Map<string, ShiftReadinessEntry>();
      for (const [profileId, entry] of byProfile) {
        result.set(profileId, {
          profileId,
          readinessPercent:
            entry.total > 0 ? Math.round((entry.completed / entry.total) * 100) : 100,
          pendingProtocols: entry.pendingNames,
        });
      }

      return result;
    },
  });

  const readinessMap = useMemo(
    () => query.data ?? new Map<string, ShiftReadinessEntry>(),
    [query.data],
  );

  return { readinessMap, isLoading: query.isLoading };
}
