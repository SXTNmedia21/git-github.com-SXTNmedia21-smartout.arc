"use client";

import { useState, useMemo, useContext, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { emit, nonEmpty } from "@smartout/telemetry";
import { DashboardContext } from "@/components/dashboard/DashboardShell";
import { useCostOverview } from "../_hooks/use-cost-overview";
import { CostSummaryCards } from "./CostSummaryCards";
import { DepartmentCostTable } from "./DepartmentCostTable";
import { CostToolsBridge } from "../_tools/cost-tools-bridge";

/**
 * Main cost dashboard view with week navigation.
 * Shows summary cards + department cost table for the selected week.
 * Default view: current week (Monday to Sunday).
 *
 * Telemetry: emits cost.overview.viewed once after workspace + actor are known.
 * workspace_id + actor_id resolved from DashboardContext per ADR-0134 R1.
 */
export function CostOverview() {
  const [weekOffset, setWeekOffset] = useState(0);

  const { workspaceData, profileId } = useContext(DashboardContext);
  const workspaceId = workspaceData?.workspace_id ?? null;

  const openedRef = useRef(false);
  useEffect(() => {
    if (!workspaceId || !profileId || openedRef.current) return;
    openedRef.current = true;
    void emit({
      event: "cost.overview.viewed",
      workspace_id: nonEmpty(workspaceId, "workspace_id"),
      actor_id: nonEmpty(profileId, "actor_id"),
      properties: {
        entity: {
          entity_type: "cost_overview",
          entity_id: workspaceId,
        },
      },
    });
  }, [workspaceId, profileId]);

  const { dateFrom, dateTo, weekLabel } = useMemo(() => {
    const now = new Date();
    // Get Monday of current week
    const dayOfWeek = now.getDay();
    const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    const monday = new Date(now);
    monday.setDate(now.getDate() + mondayOffset + weekOffset * 7);

    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);

    return {
      dateFrom: formatDate(monday),
      dateTo: formatDate(sunday),
      weekLabel: `${formatDisplayDate(monday)} – ${formatDisplayDate(sunday)}`,
    };
  }, [weekOffset]);

  const { byDepartment, totals, isLoading } = useCostOverview({
    dateFrom,
    dateTo,
  });

  return (
    <div className="space-y-6 p-4">
      {/* Page header */}
      <div className="flex flex-col gap-1">
        <h1 className="font-heading text-foreground text-2xl leading-tight tracking-tight">
          Kostnader
        </h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Her ser du planlagt og faktisk lønnskostnad per uke, fordelt på avdelinger. Negativ
          varians betyr at uka brukte mindre enn budsjettert; positiv betyr overforbruk.
        </p>
      </div>

      {/* Week navigation */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="icon"
            onClick={() => setWeekOffset((prev) => prev - 1)}
            aria-label="Forrige uke"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-muted-foreground min-w-[200px] text-center text-sm">
            {weekLabel}
          </span>
          <Button
            variant="outline"
            size="icon"
            onClick={() => setWeekOffset((prev) => prev + 1)}
            disabled={weekOffset >= 0}
            aria-label="Neste uke"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
          {weekOffset !== 0 && (
            <Button variant="ghost" size="sm" onClick={() => setWeekOffset(0)}>
              Denne uken
            </Button>
          )}
        </div>
      </div>

      {isLoading ? (
        <div className="flex h-64 items-center justify-center">
          <p className="text-muted-foreground text-sm">Laster kostnadsdata...</p>
        </div>
      ) : (
        <>
          <CostSummaryCards totals={totals} />
          <DepartmentCostTable departments={byDepartment} />
        </>
      )}

      {/* Botsson harness bridge — mounts when CostOverview mounts; auto-unregisters on unmount */}
      <CostToolsBridge
        byDepartment={byDepartment}
        totals={totals}
        dateFrom={dateFrom}
        dateTo={dateTo}
        weekLabel={weekLabel}
        navigateWeek={(relativeOffset) => setWeekOffset((prev) => prev + relativeOffset)}
      />
    </div>
  );
}

/** Format Date to YYYY-MM-DD for Supabase queries. */
function formatDate(date: Date): string {
  return date.toISOString().split("T")[0]!;
}

/** Format Date for Norwegian display (DD. MMM). */
function formatDisplayDate(date: Date): string {
  return date.toLocaleDateString("nb-NO", {
    day: "numeric",
    month: "short",
  });
}
