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
import { getSeverityToneStyles } from "./severity-styles";

type QueueRow = {
  id: string;
  severity: "critical" | "warning" | "info";
  summary: string;
  onPress?: () => void;
};

type CockpitRiskQueuesProps = {
  staffingQueue: StaffingRisk[];
  operationalQueue: OperationalRisk[];
  isLoading: boolean;
};

/**
 * Humanizes one staffing risk row for queue output.
 *
 * Why: Queue text should stay short and task-oriented on first screen.
 *
 * @param risk - One prioritized staffing risk.
 * @returns Action-ready summary for staffing triage.
 */
function staffingSummary(risk: StaffingRisk): string {
  const vakter = `${risk.uncoveredShifts} ${risk.uncoveredShifts === 1 ? "ubemannet vakt" : "ubemannede vakter"}`;
  const team = `${risk.affectedTeams} team`;
  return `${vakter} · ${team}`;
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
    const ord = risk.blockingDeviations === 1 ? "blokkerende avvik" : "blokkerende avvik";
    return `${risk.blockingDeviations} ${ord}`;
  }
  if (risk.overdueTasks > 0) {
    const ord = risk.overdueTasks === 1 ? "forfalt oppgave" : "forfalte oppgaver";
    return `${risk.overdueTasks} ${ord}`;
  }
  const ord = risk.upcomingTasks === 1 ? "kommende oppgave" : "kommende oppgaver";
  return `${risk.upcomingTasks} ${ord}`;
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
  rows: QueueRow[];
}) {
  return (
    <Card className="border-border h-full shadow-none">
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-semibold">
          <span className="flex items-center gap-2">
            {icon === "staffing" ? (
              <AlertTriangle className={`h-4 w-4 ${getSeverityToneStyles("warning").icon}`} />
            ) : (
              <ShieldAlert className={`h-4 w-4 ${getSeverityToneStyles("critical").icon}`} />
            )}
            {title}
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 pb-5">
        {isLoading ? (
          <p className="text-muted-foreground text-sm">Laster kø…</p>
        ) : rows.length === 0 ? (
          <p className="text-muted-foreground text-sm">{emptyText}</p>
        ) : (
          rows.map((row) => (
            <button
              type="button"
              key={row.id}
              onClick={row.onPress}
              className="border-border bg-muted/30 hover:bg-muted/60 flex w-full cursor-pointer items-start justify-between gap-2 rounded-lg border px-3 py-2.5 text-left transition-colors"
            >
              <p className="text-sm font-medium">{row.summary}</p>
              <Badge variant="outline" className={getSeverityToneStyles(row.severity).badge}>
                {row.severity === "critical"
                  ? "kritisk"
                  : row.severity === "warning"
                    ? "advarsel"
                    : "info"}
              </Badge>
            </button>
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
  onStaffingPress,
  onOperationalPress,
}: CockpitRiskQueuesProps & {
  onStaffingPress?: (riskId: string) => void;
  onOperationalPress?: (riskId: string) => void;
}) {
  return (
    <section data-testid="cockpit-risk-queues" className="grid grid-cols-1 gap-4 xl:grid-cols-2">
      <QueueCard
        title="Bemanning"
        icon="staffing"
        emptyText="Ingen bemanningshull akkurat nå."
        isLoading={isLoading}
        rows={staffingQueue.slice(0, 4).map((risk) => ({
          id: risk.id,
          severity: risk.severity,
          summary: staffingSummary(risk),
          onPress: onStaffingPress ? () => onStaffingPress(risk.id) : undefined,
        }))}
      />
      <QueueCard
        title="Drift"
        icon="operations"
        emptyText="Ingen avvik eller oppgaver å håndtere nå."
        isLoading={isLoading}
        rows={operationalQueue.slice(0, 4).map((risk) => ({
          id: risk.id,
          severity: risk.severity,
          summary: operationalSummary(risk),
          onPress: onOperationalPress ? () => onOperationalPress(risk.id) : undefined,
        }))}
      />
    </section>
  );
}
