"use client";

// Fetches training & compliance analytics for the Training tab.
// Queries protocol_assignment joined with protocol for compliance rows,
// groups completions by ISO week for the trend chart, and surfaces
// overdue assignments (past due_date, not completed).
// protocol_assignment has no workspace_id — we always filter via
// profile_ids from this workspace.

import { useQuery } from "@tanstack/react-query";
import { createClient } from "@smartout/supabase/client";
import { useWorkspaceOptional } from "@/lib/workspace-context";

// ── Return types (must match TrainingSection chart props exactly) ─────────

export type ProtocolComplianceItem = {
  name: string;
  compliance: number;
  assigned: number;
  completed: number;
  critical: boolean;
};

export type TrainingTrendWeek = {
  date: string;
  completed: number;
  started: number;
  expired: number;
};

export type OverdueAssignment = {
  employee: string;
  protocol: string;
  daysOverdue: number;
  department: string;
};

export type TrainingData = {
  protocolCompliance: ProtocolComplianceItem[];
  trainingTrend30d: TrainingTrendWeek[];
  overdueAssignments: OverdueAssignment[];
};

function isoWeekNumber(date: Date): number {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + 3 - ((d.getDay() + 6) % 7));
  const week1 = new Date(d.getFullYear(), 0, 4);
  return (
    1 +
    Math.round(((d.getTime() - week1.getTime()) / 86400000 - 3 + ((week1.getDay() + 6) % 7)) / 7)
  );
}

function safePercent(num: number, denom: number): number {
  if (denom === 0) return 0;
  return Math.round((num / denom) * 100);
}

// Number of days between a date string and today
function daysAgo(isoString: string): number {
  const then = new Date(isoString);
  const now = new Date();
  return Math.floor((now.getTime() - then.getTime()) / (1000 * 60 * 60 * 24));
}

export function useReportTraining() {
  const ctx = useWorkspaceOptional();
  const wsId = ctx?.workspace.workspace_id;

  return useQuery({
    queryKey: ["reports", "training", wsId],
    queryFn: async (): Promise<TrainingData> => {
      const supabase = createClient();

      // We need workspace profile IDs first to filter protocol_assignment,
      // then fetch protocols and departments for display labels.
      const [profilesResult, protocolsResult, departmentsResult] = await Promise.all([
        supabase
          .from("profile")
          .select("profile_id, display_name, department_id")
          .eq("workspace_id", wsId!),

        supabase.from("protocol").select("protocol_id, name, status").eq("workspace_id", wsId!),

        supabase
          .from("department")
          .select("department_id, name")
          .eq("workspace_id", wsId!)
          .eq("is_active", true),
      ]);

      if (profilesResult.error) throw new Error(profilesResult.error.message);

      const profiles = profilesResult.data ?? [];
      const protocols = protocolsResult.error ? [] : (protocolsResult.data ?? []);
      const departments = departmentsResult.error ? [] : (departmentsResult.data ?? []);

      // Build lookup maps for display labels
      const profileIds = profiles.map((p) => p.profile_id);
      const profileById = new Map(profiles.map((p) => [p.profile_id, p]));
      const protocolById = new Map(protocols.map((p) => [p.protocol_id, p]));
      const deptNameById = new Map(departments.map((d) => [d.department_id, d.name]));

      // Bail early with empty state if there are no profiles — avoids an
      // empty IN clause which some Supabase versions reject
      if (profileIds.length === 0) {
        return {
          protocolCompliance: [],
          trainingTrend30d: [],
          overdueAssignments: [],
        };
      }

      // Fetch all assignments for workspace profiles in one shot
      // (filtering in-DB on profile_id IN array is fine at workspace scale)
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const assignmentsResult = await supabase
        .from("protocol_assignment")
        .select("assignment_id, profile_id, protocol_id, status, assigned_at, completed_at")
        .in("profile_id", profileIds);

      if (assignmentsResult.error) {
        // protocol_assignment might not exist yet — return graceful empty state
        return {
          protocolCompliance: [],
          trainingTrend30d: [],
          overdueAssignments: [],
        };
      }

      const assignments = assignmentsResult.data ?? [];

      // ── Protocol compliance ─────────────────────────────────────────────
      // Group by protocol_id, count total and completed.
      const byProtocol = new Map<string, { total: number; completed: number }>();
      for (const a of assignments) {
        const existing = byProtocol.get(a.protocol_id) ?? { total: 0, completed: 0 };
        existing.total += 1;
        if (a.status === "completed") existing.completed += 1;
        byProtocol.set(a.protocol_id, existing);
      }

      const protocolCompliance: ProtocolComplianceItem[] = Array.from(byProtocol.entries())
        .map(([protocolId, counts]) => {
          const protocol = protocolById.get(protocolId);
          const name = protocol?.name ?? "Ukjent protokoll";
          const compliance = safePercent(counts.completed, counts.total);
          // Mark as critical if < 50% compliance
          const critical = compliance < 50;
          return {
            name,
            compliance,
            assigned: counts.total,
            completed: counts.completed,
            critical,
          };
        })
        .sort((a, b) => a.compliance - b.compliance); // worst first

      // ── Training trend — last 4 ISO weeks ─────────────────────────────
      // Bucket completed_at and assigned_at into ISO weeks.
      const weekBuckets = new Map<
        number,
        { completed: number; started: number; expired: number; label: string }
      >();

      for (const a of assignments) {
        const createdDate = new Date(a.assigned_at);
        // Only include assignments from last 30 days
        if (createdDate < thirtyDaysAgo) continue;

        const weekNum = isoWeekNumber(createdDate);
        const existing = weekBuckets.get(weekNum) ?? {
          completed: 0,
          started: 0,
          expired: 0,
          label: `Uke ${weekNum}`,
        };

        existing.started += 1;
        if (a.status === "completed") existing.completed += 1;
        if (a.status === "expired") existing.expired += 1;

        weekBuckets.set(weekNum, existing);
      }

      const trainingTrend30d: TrainingTrendWeek[] = Array.from(weekBuckets.entries())
        .sort((a, b) => a[0] - b[0])
        .slice(-4)
        .map(([, v]) => ({
          date: v.label,
          completed: v.completed,
          started: v.started,
          expired: v.expired,
        }));

      // ── Overdue assignments ────────────────────────────────────────────
      // An assignment is "overdue" if it is not completed and was assigned
      // more than 14 days ago. Sort by stalest first.
      const overdueRaw = assignments
        .filter((a) => a.status !== "completed" && daysAgo(a.assigned_at) > 14)
        .sort((a, b) => daysAgo(b.assigned_at) - daysAgo(a.assigned_at))
        .slice(0, 8);

      const overdueAssignments: OverdueAssignment[] = overdueRaw.map((a) => {
        const profile = profileById.get(a.profile_id);
        const protocol = protocolById.get(a.protocol_id);
        const deptId = profile?.department_id ?? null;
        const deptName = deptId ? (deptNameById.get(deptId) ?? "Ukjent") : "Ukjent";

        return {
          employee: profile?.display_name ?? "Ukjent",
          protocol: protocol?.name ?? "Ukjent protokoll",
          daysOverdue: daysAgo(a.assigned_at) - 14, // days past the 14d grace window
          department: deptName,
        };
      });

      return { protocolCompliance, trainingTrend30d, overdueAssignments };
    },
    enabled: !!wsId,
    staleTime: 2 * 60 * 1000,
  });
}
