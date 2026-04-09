"use client";

import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useCostOverview } from "../_hooks/use-cost-overview";
import { CostSummaryCards } from "./CostSummaryCards";
import { DepartmentCostTable } from "./DepartmentCostTable";

/**
 * Main cost dashboard view with week navigation.
 * Shows summary cards + department cost table for the selected week.
 * Default view: current week (Monday to Sunday).
 */
export function CostOverview() {
  const [weekOffset, setWeekOffset] = useState(0);

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
      {/* Week navigation header */}
      <div className="flex items-center justify-between">
        <h1 className="text-foreground text-xl font-semibold">Lønnskostnad</h1>
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
