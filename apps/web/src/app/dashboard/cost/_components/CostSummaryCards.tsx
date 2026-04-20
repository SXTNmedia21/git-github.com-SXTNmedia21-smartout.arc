"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TrendingDown, TrendingUp } from "lucide-react";
import type { CostTotals } from "../_hooks/use-cost-overview";

/**
 * Three summary cards at the top of the cost dashboard:
 * Planlagt kostnad, Faktisk kostnad, Timer totalt.
 * Shows variance as colored indicator (positive = over budget = destructive).
 */
export function CostSummaryCards({ totals }: { totals: CostTotals }) {
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
      {/* Planned cost */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-muted-foreground text-sm font-medium">
            Planlagt kostnad
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="font-mono text-2xl font-bold">{formatNOK(totals.plannedCost)}</p>
          <p className="text-muted-foreground mt-1 text-xs">{totals.shiftCount} vakter planlagt</p>
        </CardContent>
      </Card>

      {/* Actual cost with variance */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-muted-foreground text-sm font-medium">
            Faktisk kostnad
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="font-mono text-2xl font-bold">{formatNOK(totals.actualCost)}</p>
          <VarianceIndicator variance={totals.variance} variancePercent={totals.variancePercent} />
        </CardContent>
      </Card>

      {/* Total hours */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-muted-foreground text-sm font-medium">Timer totalt</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="font-mono text-2xl font-bold">{totals.totalHours.toFixed(1)}</p>
          <p className="text-muted-foreground mt-1 text-xs">timer i perioden</p>
        </CardContent>
      </Card>
    </div>
  );
}

/**
 * Shows cost variance with color coding.
 * Under budget (negative variance) = success (green).
 * Over budget (positive variance) = destructive (red).
 */
function VarianceIndicator({
  variance,
  variancePercent,
}: {
  variance: number;
  variancePercent: number;
}) {
  if (variance === 0 && variancePercent === 0) {
    return <p className="text-muted-foreground mt-1 text-xs">Ingen avvik</p>;
  }

  const isOverBudget = variance > 0;
  const colorClass = isOverBudget ? "text-destructive" : "text-success";
  const Icon = isOverBudget ? TrendingUp : TrendingDown;

  return (
    <div className={`mt-1 flex items-center gap-1 text-xs ${colorClass}`}>
      <Icon className="h-3 w-3" />
      <span className="font-mono">
        {isOverBudget ? "+" : ""}
        {formatNOK(variance)} ({variancePercent.toFixed(1)}%)
      </span>
    </div>
  );
}

/** Format number as NOK currency string. */
function formatNOK(value: number): string {
  return new Intl.NumberFormat("nb-NO", {
    style: "currency",
    currency: "NOK",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}
