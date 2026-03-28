"use client";

// ============================================
// CockpitRiskQueues.tsx
// Renders staffing and operational risk queues
// for the V1 cockpit first-screen layout.
// Exists to keep urgent blockers visible and
// rank-ordered for immediate triage.
// ============================================

import { AlertTriangle, ShieldAlert } from "lucide-react";
import type { OperationalRisk, StaffingRisk } from "@/app/dashboard/_lib/cockpit/risk-priority";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type CockpitRiskQueuesProps = {
  staffingQueue: StaffingRisk[];
  operationalQueue: OperationalRisk[];
  isLoading: boolean;
};

/**
 * Returns badge classes for risk severity tokens.
 *
 * Why: Shared risk rendering should use one deterministic visual mapping.
 *
 * @param severity - Risk severity value.
 * @returns Tailwind classes matching the severity level.
 */
function getSeverityClasses(severity: "critical" | "warning" | "info"): string {
  if (severity === "critical") {
    return "border-red-500/30 bg-red-500/10 text-red-500";
  }
  if (severity === "warning") {
    return "border-orange-500/30 bg-orange-500/10 text-orange-500";
  }
  return "border-blue-500/30 bg-blue-500/10 text-blue-500";
}

/**
 * Humanizes one staffing risk row for queue output.
 *
 * Why: Queue text should stay short and task-oriented on first screen.
 *
 * @param risk - One prioritized staffing risk.
 * @returns Action-ready summary for staffing triage.
 */
function staffingSummary(risk: StaffingRisk): string {
  return `${risk.uncoveredShifts} uncovered shift${risk.uncoveredShifts === 1 ? "" : "s"} across ${risk.affectedTeams} team${risk.affectedTeams === 1 ? "" : "s"}`;
}

/**
 * Humanizes one operational risk row for queue output.
 *
 * Why: Operators should instantly understand whether debt is blocking or growing.
 *
 * @param risk - One prioritized operational risk.
 * @returns Action-ready summary for operations triage.
 */
function operationalSummary(risk: OperationalRisk): string {
  if (risk.blockingDeviations > 0) {
    return `${risk.blockingDeviations} blocking deviation${risk.blockingDeviations === 1 ? "" : "s"}`;
  }
  return `${risk.overdueTasks} overdue task${risk.overdueTasks === 1 ? "" : "s"}`;
}

/**
 * Renders one compact queue panel for either staffing or operations.
 *
 * Why: Shared queue UI keeps visual complexity low while preserving urgency cues.
 *
 * @param props - Queue metadata and already-prioritized risk rows.
 * @returns Card with top-ranked actionable queue rows.
 */
function QueueCard({
  title,
  icon,
  emptyText,
  isLoading,
  rows,
}: {
  title: string;
  icon: "staffing" | "operations";
  emptyText: string;
  isLoading: boolean;
  rows: { id: string; severity: "critical" | "warning" | "info"; summary: string }[];
}) {
  return (
    <Card className="border-border h-full shadow-none">
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-semibold">
          <span className="flex items-center gap-2">
            {icon === "staffing" ? (
              <AlertTriangle className="h-4 w-4 text-orange-500" />
            ) : (
              <ShieldAlert className="h-4 w-4 text-red-500" />
            )}
            {title}
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 pb-5">
        {isLoading ? (
          <p className="text-muted-foreground text-sm">Loading queue...</p>
        ) : rows.length === 0 ? (
          <p className="text-muted-foreground text-sm">{emptyText}</p>
        ) : (
          rows.map((row) => (
            <div
              key={row.id}
              className="border-border bg-muted/30 flex items-start justify-between gap-2 rounded-lg border px-3 py-2.5"
            >
              <p className="text-sm font-medium">{row.summary}</p>
              <Badge variant="outline" className={getSeverityClasses(row.severity)}>
                {row.severity}
              </Badge>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}

/**
 * Renders the V1 risk-queue slice with staffing and operations side by side.
 *
 * Why: V1 cockpit needs immediate triage queues, not deep analytics.
 *
 * @param props - Prioritized risk queues and loading state.
 * @returns Dual queue section for first-screen risk handling.
 */
export function CockpitRiskQueues({
  staffingQueue,
  operationalQueue,
  isLoading,
}: CockpitRiskQueuesProps) {
  return (
    <section data-testid="cockpit-risk-queues" className="grid grid-cols-1 gap-4 xl:grid-cols-2">
      <QueueCard
        title="Staffing queue"
        icon="staffing"
        emptyText="No staffing blockers right now."
        isLoading={isLoading}
        rows={staffingQueue.slice(0, 4).map((risk) => ({
          id: risk.id,
          severity: risk.severity,
          summary: staffingSummary(risk),
        }))}
      />
      <QueueCard
        title="Operations queue"
        icon="operations"
        emptyText="No operational blockers right now."
        isLoading={isLoading}
        rows={operationalQueue.slice(0, 4).map((risk) => ({
          id: risk.id,
          severity: risk.severity,
          summary: operationalSummary(risk),
        }))}
      />
    </section>
  );
}
