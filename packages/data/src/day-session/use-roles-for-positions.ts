"use client";

/**
 * useRolesForPositions — role-anchored task library read (V1 STUB).
 *
 * Per Council Phase 1 verdict C-B (System Steward 2026-05-24):
 *   ROLE_TASKS concept = `session_hook` by another name.
 *   NO new `role_task` table. NO new ADR.
 *
 * The design fixture's "28 ROLE_TASKS" are rendered in the UI as
 * "fastoppgaver per posisjon" — grouped visually by the position assigned
 * to the shift covering that hook's time. Data source: `session_hook`
 * (cascade D6, time-anchored, department-scoped, repeating fixed tasks).
 *
 * V1 ships this hook as a no-op returning empty list. Manager Timeline V1
 * reads `session_hook` via `useDayTimelineEvents` (extended in P10) for any
 * hook-derived data. This stub preserves API surface for future use should
 * we ever introduce a true role-task entity (which would require an ADR per
 * cascade-integrity rule #1: no parallel D2/D6 truth sources).
 *
 * Returns empty list V1. Consumers should not depend on this for the Gantt
 * — task data comes from `useSessionTasksForDate` and session_hook reads.
 */

import { useQuery } from "@tanstack/react-query";

export type RoleRow = {
  role_id: string;
  workspace_id: string;
  code: string;
  name: string;
  area_id: string | null;
  tasks: ReadonlyArray<{
    role_task_id: string;
    title: string;
    typical_start: string;
    typical_end: string;
  }>;
};

export const roleKeys = {
  forDate: (workspaceId: string, date: string) =>
    ["role", "for-positions", workspaceId, date] as const,
};

export function useRolesForPositions(workspaceId: string | null, dateISO: string) {
  return useQuery({
    queryKey: roleKeys.forDate(workspaceId ?? "none", dateISO),
    enabled: false, // V1: no-op. Consumers fall back to session_hook reads.
    staleTime: 60_000,
    queryFn: async (): Promise<ReadonlyArray<RoleRow>> => {
      // V1 stub — see file header. No DB read. Returns empty list.
      return [];
    },
  });
}
