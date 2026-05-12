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
    const n = staffingQueue[0]!.uncoveredShifts;
    actions.push({
      id: "cover-staffing-gaps",
      label: "Dekk bemanningshull",
      description: `${n} ${n === 1 ? "ubemannet vakt trenger bemanning" : "ubemannede vakter trenger bemanning"}`,
      ctaLabel: "Åpne vaktplan",
      href: "/dashboard/schedule",
      tone: staffingQueue[0]!.severity === "critical" ? "critical" : "warning",
      icon: CalendarClock,
    });
  }

  if (operationalQueue.length > 0) {
    const topOperationalRisk = operationalQueue[0]!;
    const operationalDescription =
      topOperationalRisk.blockingDeviations > 0
        ? `${topOperationalRisk.blockingDeviations} blokkerende avvik i kø`
        : topOperationalRisk.overdueTasks > 0
          ? `${topOperationalRisk.overdueTasks} ${topOperationalRisk.overdueTasks === 1 ? "forfalt oppgave" : "forfalte oppgaver"} i kø`
          : `${topOperationalRisk.upcomingTasks} ${topOperationalRisk.upcomingTasks === 1 ? "kommende oppgave" : "kommende oppgaver"} å forberede`;

    actions.push({
      id: "clear-operational-blockers",
      label: "Håndter driftskø",
      description: operationalDescription,
      ctaLabel: "Åpne drift",
      href: "/dashboard/operations",
      tone: topOperationalRisk.severity === "critical" ? "critical" : "warning",
      icon: Siren,
    });
  }

  if (lateCount > 0 || waitingCount > 0) {
    actions.push({
      id: "follow-up-attendance",
      label: "Følg opp oppmøte",
      description: `${lateCount} forsinket, ${waitingCount} venter på innstempling`,
      ctaLabel: "Se oppmøte",
      href: "/dashboard/schedule",
      tone: lateCount > 0 ? "critical" : "warning",
      icon: Users,
    });
  }

  // Reconciliation is always reachable from the rail — daily close is a
  // recurring routine, not a fallback. Pushed last so risk-driven actions
  // win the top slots; slice(0, 4) caps total.
  actions.push({
    id: "daily-review",
    label: "Kjør dagsavslutning",
    description:
      actions.length === 0
        ? "Ingen hasteoppgaver. Bekreft sjekklister."
        : "Bekreft sjekklister og avstem dagen.",
    ctaLabel: "Åpne avstemming",
    href: "/dashboard/reconciliation",
    tone: "neutral",
    icon: ListChecks,
  });

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
          <CardTitle className="text-base font-semibold">Handlinger</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2.5 pb-5">
          {isLoading ? (
            <p className="text-muted-foreground text-sm">Laster anbefalte handlinger…</p>
          ) : (
            actions.map((action) => (
              <div key={action.id} className="border-border bg-muted/20 rounded-lg border p-3">
                <div className="mb-2 flex items-center gap-2">
                  <action.icon className="text-muted-foreground h-4 w-4" />
                  <span
                    className={`inline-flex rounded-full border px-2 py-0.5 text-[11px] font-semibold ${getSeverityToneStyles(action.tone).badge}`}
                  >
                    {action.tone === "critical"
                      ? "kritisk"
                      : action.tone === "warning"
                        ? "advarsel"
                        : "nøytral"}
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
