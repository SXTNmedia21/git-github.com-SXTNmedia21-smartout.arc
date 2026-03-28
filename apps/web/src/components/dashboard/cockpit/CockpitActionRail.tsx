"use client";

// ============================================
// CockpitActionRail.tsx
// Shows the highest-priority actions derived
// from V1 cockpit risk and shift signals.
// Exists to keep the first screen action-first
// and reduce navigation decision overhead.
// ============================================

import { ArrowRight, CalendarClock, ListChecks, Siren, Users } from "lucide-react";
import type { OperationalRisk, StaffingRisk } from "@/app/dashboard/_lib/cockpit/risk-priority";
import type { LiveShiftEntry } from "@/app/dashboard/_hooks/use-live-shifts";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

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
  href: string;
  tone: "critical" | "warning" | "neutral";
  icon: typeof Siren;
};

/**
 * Maps action tone to visual token classes.
 *
 * Why: The action rail should make urgency visible without noisy styling.
 *
 * @param tone - Urgency tone for one action row.
 * @returns Tailwind classes for the tone chip.
 */
function getToneClasses(tone: ActionItem["tone"]): string {
  if (tone === "critical") {
    return "border-red-500/30 bg-red-500/10 text-red-500";
  }
  if (tone === "warning") {
    return "border-orange-500/30 bg-orange-500/10 text-orange-500";
  }
  return "border-border bg-muted/50 text-muted-foreground";
}

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
      href: "/dashboard/schedule",
      tone: staffingQueue[0]!.severity === "critical" ? "critical" : "warning",
      icon: CalendarClock,
    });
  }

  if (operationalQueue.length > 0) {
    actions.push({
      id: "clear-operational-blockers",
      label: "Clear operational blockers",
      description: `${operationalQueue[0]!.blockingDeviations} blocking deviation${operationalQueue[0]!.blockingDeviations === 1 ? "" : "s"} in queue`,
      href: "/dashboard/operations",
      tone: operationalQueue[0]!.severity === "critical" ? "critical" : "warning",
      icon: Siren,
    });
  }

  if (lateCount > 0 || waitingCount > 0) {
    actions.push({
      id: "follow-up-attendance",
      label: "Follow up attendance",
      description: `${lateCount} late, ${waitingCount} waiting to clock in`,
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
                    className={`inline-flex rounded-full border px-2 py-0.5 text-[11px] font-semibold ${getToneClasses(action.tone)}`}
                  >
                    {action.tone}
                  </span>
                </div>
                <p className="text-sm font-semibold">{action.label}</p>
                <p className="text-muted-foreground mt-1 text-xs">{action.description}</p>
                <Button asChild variant="ghost" className="mt-2 h-7 px-0 text-xs font-semibold">
                  <a href={action.href}>
                    Open
                    <ArrowRight className="h-3.5 w-3.5" />
                  </a>
                </Button>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </section>
  );
}
