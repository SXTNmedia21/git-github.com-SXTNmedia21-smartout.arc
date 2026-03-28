"use client";

// ============================================
// CockpitOnDutyProgress.tsx
// Shows who is currently on duty and their
// live shift status in the V1 cockpit.
// Exists to support fast staffing follow-up
// without opening deeper schedule screens.
// ============================================

import type { LiveShiftEntry } from "@/app/dashboard/_hooks/use-live-shifts";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type CockpitOnDutyProgressProps = {
  entries: LiveShiftEntry[];
  isLoading: boolean;
};

/**
 * Maps live shift status to compact badge classes.
 *
 * Why: One mapping keeps status semantics stable across list and counters.
 *
 * @param status - Shift live status.
 * @returns Tailwind classes for status badge rendering.
 */
function getStatusClasses(status: LiveShiftEntry["status"]): string {
  if (status === "late") {
    return "border-red-500/30 bg-red-500/10 text-red-500";
  }
  if (status === "waiting") {
    return "border-orange-500/30 bg-orange-500/10 text-orange-500";
  }
  if (status === "on_break") {
    return "border-blue-500/30 bg-blue-500/10 text-blue-500";
  }
  return "border-emerald-500/30 bg-emerald-500/10 text-emerald-500";
}

/**
 * Creates deterministic status counts from on-duty entries.
 *
 * Why: Top-level status totals should derive from the same source as the list.
 *
 * @param entries - On-duty entries from the first-screen read model.
 * @returns Status totals used for compact summary pills.
 */
function summarize(entries: LiveShiftEntry[]): Record<LiveShiftEntry["status"], number> {
  return entries.reduce<Record<LiveShiftEntry["status"], number>>(
    (acc, entry) => {
      acc[entry.status] += 1;
      return acc;
    },
    {
      clocked_in: 0,
      on_break: 0,
      waiting: 0,
      late: 0,
    },
  );
}

/**
 * Renders the on-duty progress slice for the V1 cockpit.
 *
 * Why: Managers need one quick place to see who needs immediate follow-up.
 *
 * @param props - On-duty entries and loading state.
 * @returns Card with compact status totals and current on-duty rows.
 */
export function CockpitOnDutyProgress({ entries, isLoading }: CockpitOnDutyProgressProps) {
  const totals = summarize(entries);

  return (
    <section data-testid="cockpit-on-duty-progress">
      <Card className="border-border shadow-none">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold">On-duty progress</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 pb-5">
          <div className="flex flex-wrap gap-2">
            <Badge variant="outline" className="border-border text-muted-foreground">
              Clocked in: {isLoading ? "--" : totals.clocked_in}
            </Badge>
            <Badge variant="outline" className="border-border text-muted-foreground">
              On break: {isLoading ? "--" : totals.on_break}
            </Badge>
            <Badge variant="outline" className="border-border text-muted-foreground">
              Waiting: {isLoading ? "--" : totals.waiting}
            </Badge>
            <Badge variant="outline" className="border-border text-muted-foreground">
              Late: {isLoading ? "--" : totals.late}
            </Badge>
          </div>

          {isLoading ? (
            <p className="text-muted-foreground text-sm">Loading on-duty shifts...</p>
          ) : entries.length === 0 ? (
            <p className="text-muted-foreground text-sm">No active on-duty entries right now.</p>
          ) : (
            <div className="space-y-2">
              {entries.slice(0, 10).map((entry) => (
                <div
                  key={entry.shiftId}
                  className="border-border bg-muted/30 flex items-center justify-between gap-3 rounded-lg border px-3 py-2.5"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold">{entry.employeeName}</p>
                    <p className="text-muted-foreground truncate text-xs">
                      {entry.role || "No role set"}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {entry.duration ? (
                      <span className="text-muted-foreground text-xs tabular-nums">
                        {entry.duration}
                      </span>
                    ) : entry.startTime ? (
                      <span className="text-muted-foreground text-xs tabular-nums">
                        Start {entry.startTime}
                      </span>
                    ) : null}
                    <Badge variant="outline" className={getStatusClasses(entry.status)}>
                      {entry.status.replace("_", " ")}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </section>
  );
}
