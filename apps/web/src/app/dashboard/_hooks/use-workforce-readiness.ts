/**
 * use-workforce-readiness.ts
 *
 * Shared hook for the workforce readiness matrix.
 * Extracted from CompetenceMatrix.tsx so both HMS training and
 * People training can import from a single source.
 *
 * Queries three tables in parallel:
 *   1. profile — active + trainee profiles with department
 *   2. protocol — active workspace protocols
 *   3. protocol_assignment — workspace-scoped (direct .eq, no join hack)
 *
 * workspace_id on protocol_assignment is confirmed present (database.types.ts:15736).
 * Do NOT copy the use-protocol-assignees.ts profile!inner workaround — that was
 * written before workspace_id was confirmed on the assignment table.
 */
"use client";

import { useQuery } from "@tanstack/react-query";
import { useWorkspace } from "@/lib/workspace-context";
import { createClient } from "@smartout/supabase/client";
import { dashboardKeys } from "./dashboard-keys";

// ── Types (exported for consumer use) ──────────────────────────────────────

export type AssignmentStatus =
  | "not_started"
  | "in_progress"
  | "completed"
  | "expired"
  | "waived"
  | "pending"
  | "not_assigned";

export type AssignmentProgress = {
  proceduresTotal: number;
  proceduresCompleted: number;
  testsTotal: number;
  testsPassed: number;
  confirmationsTotal: number;
  confirmationsSigned: number;
};

export type CellData = {
  status: AssignmentStatus;
  percent: number;
  progress: AssignmentProgress | null;
  assignedVia: string | null;
  /** null = no recurrence configured on this assignment */
  nextReviewAt: string | null;
};

export type MatrixRow = {
  profileId: string;
  profileName: string;
  departmentName: string | null;
  protocols: Record<string, CellData>;
  readinessPercent: number;
};

export type ProtocolColumn = {
  protocolId: string;
  protocolName: string;
};

// ── Hook ───────────────────────────────────────────────────────────────────

export function useWorkforceReadiness() {
  const { workspace } = useWorkspace();

  return useQuery({
    queryKey: dashboardKeys.workforceReadiness(workspace.workspace_id),
    staleTime: 3 * 60 * 1000,
    queryFn: async (): Promise<{ rows: MatrixRow[]; columns: ProtocolColumn[] }> => {
      const supabase = createClient();

      const [profilesRes, protocolsRes, assignmentsRes] = await Promise.all([
        supabase
          .from("profile")
          .select("profile_id, display_name, department:department_id(name)")
          .eq("workspace_id", workspace.workspace_id)
          .in("profile_status", ["active", "trainee"])
          .order("display_name"),
        supabase
          .from("protocol")
          .select("protocol_id, name")
          .eq("workspace_id", workspace.workspace_id)
          .eq("status", "active")
          .order("name"),
        supabase
          .from("protocol_assignment")
          .select(
            "profile_id, protocol_id, status, assigned_via, procedures_total, procedures_completed, tests_total, tests_passed, confirmations_total, confirmations_signed, next_review_at",
          )
          .eq("workspace_id", workspace.workspace_id),
      ]);

      if (profilesRes.error) throw profilesRes.error;
      if (protocolsRes.error) throw protocolsRes.error;
      if (assignmentsRes.error) throw assignmentsRes.error;

      const columns: ProtocolColumn[] = (protocolsRes.data ?? []).map((p) => ({
        protocolId: p.protocol_id,
        protocolName: p.name,
      }));

      // Build assignment lookup keyed by profile_id → protocol_id
      type AssignmentData = {
        status: string;
        assignedVia: string | null;
        proceduresTotal: number;
        proceduresCompleted: number;
        testsTotal: number;
        testsPassed: number;
        confirmationsTotal: number;
        confirmationsSigned: number;
        nextReviewAt: string | null;
      };

      const assignmentMap = new Map<string, Map<string, AssignmentData>>();
      for (const a of assignmentsRes.data ?? []) {
        if (!assignmentMap.has(a.profile_id)) assignmentMap.set(a.profile_id, new Map());
        assignmentMap.get(a.profile_id)!.set(a.protocol_id, {
          status: a.status,
          assignedVia: a.assigned_via,
          proceduresTotal: a.procedures_total ?? 0,
          proceduresCompleted: a.procedures_completed ?? 0,
          testsTotal: a.tests_total ?? 0,
          testsPassed: a.tests_passed ?? 0,
          confirmationsTotal: a.confirmations_total ?? 0,
          confirmationsSigned: a.confirmations_signed ?? 0,
          nextReviewAt: a.next_review_at ?? null,
        });
      }

      const rows: MatrixRow[] = (profilesRes.data ?? []).map((profile) => {
        const dept = profile.department as unknown as { name: string } | null;
        const assignments = assignmentMap.get(profile.profile_id) ?? new Map();

        const protocols: MatrixRow["protocols"] = {};
        let totalWeightedProgress = 0;
        let assignedCount = 0;

        for (const col of columns) {
          const assignment = assignments.get(col.protocolId);
          if (assignment) {
            assignedCount++;
            const totalSteps =
              assignment.proceduresTotal + assignment.testsTotal + assignment.confirmationsTotal;
            const completedSteps =
              assignment.proceduresCompleted +
              assignment.testsPassed +
              assignment.confirmationsSigned;
            const percent = totalSteps > 0 ? Math.round((completedSteps / totalSteps) * 100) : 0;

            totalWeightedProgress += percent;

            protocols[col.protocolId] = {
              status: assignment.status as AssignmentStatus,
              percent,
              progress: {
                proceduresTotal: assignment.proceduresTotal,
                proceduresCompleted: assignment.proceduresCompleted,
                testsTotal: assignment.testsTotal,
                testsPassed: assignment.testsPassed,
                confirmationsTotal: assignment.confirmationsTotal,
                confirmationsSigned: assignment.confirmationsSigned,
              },
              assignedVia: assignment.assignedVia,
              nextReviewAt: assignment.nextReviewAt,
            };
          } else {
            protocols[col.protocolId] = {
              status: "not_assigned",
              percent: 0,
              progress: null,
              assignedVia: null,
              nextReviewAt: null,
            };
          }
        }

        return {
          profileId: profile.profile_id,
          profileName: profile.display_name ?? "Ukjent",
          departmentName: dept?.name ?? null,
          protocols,
          readinessPercent:
            assignedCount > 0 ? Math.round(totalWeightedProgress / assignedCount) : 0,
        };
      });

      return { rows, columns };
    },
  });
}

// Backward-compat alias — HMS CompetenceMatrix.tsx imports this name.
export { useWorkforceReadiness as useCompetenceData };
