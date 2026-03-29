"use client";

// ============================================
// CockpitActionRail.tsx
// Shows the highest-priority actions derived
// from V1 cockpit risk and shift signals.
// Exists to keep the first screen action-first
// and reduce navigation decision overhead.
// ============================================

import { ArrowRight, CalendarClock, ListChecks, Siren, Users } from "lucide-react";
import Link from "next/link";
import type { OperationalRisk, StaffingRisk } from "@/app/dashboard/_lib/cockpit/risk-priority";
import type { LiveShiftEntry } from "@/app/dashboard/_hooks/use-live-shifts";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getSeverityToneStyles } from "./severity-styles";

type CockpitActionRailProps = {
  staffingQueue: StaffingRisk[];
  operationalQueue: OperationalRisk[];
  onDutyEntries: LiveShiftEntry[];
  isLoading: boolean;
};

type ActionItem = {
  id: string;
  label: string;
  description: string;
  ctaLabel: string;
  href: string;
  tone: "critical" | "warning" | "neutral";
  icon: typeof Siren;
};

/**
 * Builds prioritized first-screen actions from current cockpit signals.
 *
 * Why: V1 action rail must stay deterministic and based on existing read-model output.
 *
 * @param staffingQueue - Prioritized staffing risks.
 * @param operationalQueue - Prioritized operational risks.
 * @param onDutyEntries - Current on-duty entries for follow-up checks.
 * @returns Ordered, compact action list for immediate execution.
 */
function buildActions(
  staffingQueue: StaffingRisk[],
  operationalQueue: OperationalRisk[],
  onDutyEntries: LiveShiftEntry[],
): ActionItem[] {
  const lateCount = onDutyEntries.filter((entry) => entry.status === "late").length;
  const waitingCount = onDutyEntries.filter((entry) => entry.status === "waiting").length;
  const actions: ActionItem[] = [];

  if (staffingQueue.length > 0) {
    actions.push({
      id: "cover-staffing-gaps",
      label: "Cover staffing gaps",
      description: `${staffingQueue[0]!.uncoveredShifts} uncovered shift${staffingQueue[0]!.uncoveredShifts === 1 ? "" : "s"} need assignment`,
      ctaLabel: "Open schedule",
      href: "/dashboard/schedule",
      tone: staffingQueue[0]!.severity === "critical" ? "critical" : "warning",
      icon: CalendarClock,
    });
  }

  if (operationalQueue.length > 0) {
    const topOperationalRisk = operationalQueue[0]!;
    const operationalDescription =
      topOperationalRisk.blockingDeviations > 0
        ? `${topOperationalRisk.blockingDeviations} blocking deviation${topOperationalRisk.blockingDeviations === 1 ? "" : "s"} in queue`
        : topOperationalRisk.overdueTasks > 0
          ? `${topOperationalRisk.overdueTasks} overdue task${topOperationalRisk.overdueTasks === 1 ? "" : "s"} in queue`
          : `${topOperationalRisk.upcomingTasks} upcoming task${topOperationalRisk.upcomingTasks === 1 ? "" : "s"} to prepare`;

    actions.push({
      id: "clear-operational-blockers",
      label: "Manage operational queue",
      description: operationalDescription,
      ctaLabel: "Open operations",
      href: "/dashboard/operations",
      tone: topOperationalRisk.severity === "critical" ? "critical" : "warning",
      icon: Siren,
    });
  }

  if (lateCount > 0 || waitingCount > 0) {
    actions.push({
      id: "follow-up-attendance",
      label: "Follow up attendance",
      description: `${lateCount} late, ${waitingCount} waiting to clock in`,
      ctaLabel: "Check attendance",
      href: "/dashboard/schedule",
      tone: lateCount > 0 ? "critical" : "warning",
      icon: Users,
    });
  }

  if (actions.length === 0) {
    actions.push({
      id: "daily-review",
      label: "Run daily review",
      description: "No urgent blockers. Confirm checklist completion.",
      ctaLabel: "Open reconciliation",
      href: "/dashboard/reconciliation",
      tone: "neutral",
      icon: ListChecks,
    });
  }

  return actions.slice(0, 4);
}

/**
 * Renders the V1 cockpit action rail section.
 *
 * Why: First-screen value is execution speed, so actions are listed before detail views.
 *
 * @param props - Risk queues, shift state, and loading indicator.
 * @returns Sidebar action list with one-click route buttons.
 */
export function CockpitActionRail({
  staffingQueue,
  operationalQueue,
  onDutyEntries,
  isLoading,
}: CockpitActionRailProps) {
  const actions = buildActions(staffingQueue, operationalQueue, onDutyEntries);

  return (
    <section data-testid="cockpit-action-rail">
      <Card className="border-border h-full shadow-none">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold">Action rail</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2.5 pb-5">
          {isLoading ? (
            <p className="text-muted-foreground text-sm">Loading recommended actions...</p>
          ) : (
            actions.map((action) => (
              <div key={action.id} className="border-border bg-muted/20 rounded-lg border p-3">
                <div className="mb-2 flex items-center gap-2">
                  <action.icon className="text-muted-foreground h-4 w-4" />
                  <span
                    className={`inline-flex rounded-full border px-2 py-0.5 text-[11px] font-semibold ${getSeverityToneStyles(action.tone).badge}`}
                  >
                    {action.tone}
                  </span>
                </div>
                <p className="text-sm font-semibold">{action.label}</p>
                <p className="text-muted-foreground mt-1 text-xs">{action.description}</p>
                <Button
                  asChild
                  variant="outline"
                  size="sm"
                  className="mt-2 h-8 w-full justify-between text-xs font-semibold"
                >
                  <Link href={action.href}>
                    {action.ctaLabel}
                    <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                </Button>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </section>
  );
}
