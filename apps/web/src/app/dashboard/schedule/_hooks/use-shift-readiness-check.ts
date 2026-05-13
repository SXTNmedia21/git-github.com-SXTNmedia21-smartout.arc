"use client";

/**
 * Pre-fetches readiness data for all active/trainee profiles in the workspace.
 * Returns a Map<profileId, { readinessPercent, pendingProtocols }> for O(1)
 * lookup during shift DnD assignment.
 *
 * `pendingProtocols` exposes the real `protocol_id` (UUID) plus denormalized
 * step counters from `protocol_assignment`, so consumers can link to the
 * training page and render an accurate "N steg igjen" hint.
 *
 * Connected to: protocol_assignment, protocol tables
 * Used by: page.tsx handleDragEnd for readiness warnings, daily-grid for the
 *          shift-gate unlock hint.
 */

import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";

import { createClient } from "@smartout/supabase/client";
import { useWorkspace } from "@/lib/workspace-context";

export type PendingProtocol = {
  protocol_id: string;
  name: string;
  steps_remaining: number;
  test_pending: boolean;
  confirmation_pending: boolean;
};

export type ShiftReadinessEntry = {
  profileId: string;
  readinessPercent: number;
  pendingProtocols: PendingProtocol[];
};

type AssignmentRow = {
  profile_id: string;
  protocol_id: string;
  status: string;
  procedures_total: number;
  procedures_completed: number;
  tests_total: number;
  tests_passed: number;
  confirmations_total: number;
  confirmations_signed: number;
  protocol: { name: string; workspace_id: string } | null;
};

export function useShiftReadinessCheck(options?: { enabled?: boolean }) {
  const { workspace } = useWorkspace();

  const query = useQuery({
    queryKey: ["schedule", "shift-readiness", workspace.workspace_id],
    staleTime: 60_000,
    enabled: options?.enabled !== false,
    queryFn: async (): Promise<Map<string, ShiftReadinessEntry>> => {
      const supabase = createClient();

      const { data, error } = await supabase
        .from("protocol_assignment")
        .select(
          "profile_id, protocol_id, status, procedures_total, procedures_completed, tests_total, tests_passed, confirmations_total, confirmations_signed, protocol:protocol_id(name, workspace_id)",
        )
        .eq("protocol.workspace_id", workspace.workspace_id);

      if (error) throw error;

      const byProfile = new Map<
        string,
        { completed: number; total: number; pending: PendingProtocol[] }
      >();

      for (const row of (data ?? []) as unknown as AssignmentRow[]) {
        if (!row.protocol) continue;

        let entry = byProfile.get(row.profile_id);
        if (!entry) {
          entry = { completed: 0, total: 0, pending: [] };
          byProfile.set(row.profile_id, entry);
        }

        entry.total += 1;
        if (row.status === "completed") {
          entry.completed += 1;
          continue;
        }

        const proceduresRemaining = Math.max(0, row.procedures_total - row.procedures_completed);
        const testsRemaining = Math.max(0, row.tests_total - row.tests_passed);
        const confirmationsRemaining = Math.max(
          0,
          row.confirmations_total - row.confirmations_signed,
        );

        entry.pending.push({
          protocol_id: row.protocol_id,
          name: row.protocol.name,
          steps_remaining: proceduresRemaining + testsRemaining + confirmationsRemaining,
          test_pending: testsRemaining > 0,
          confirmation_pending: confirmationsRemaining > 0,
        });
      }

      const result = new Map<string, ShiftReadinessEntry>();
      for (const [profileId, entry] of byProfile) {
        result.set(profileId, {
          profileId,
          readinessPercent:
            entry.total > 0 ? Math.round((entry.completed / entry.total) * 100) : 100,
          pendingProtocols: entry.pending,
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
