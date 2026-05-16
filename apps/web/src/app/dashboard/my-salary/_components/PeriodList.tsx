/**
 * PeriodList — left column of the Min Lønn page.
 *
 * Shows a scrollable list of settled payroll periods. Clicking a row
 * switches the center column to that period's payslip detail.
 */

"use client";

import { ScrollArea } from "@/components/ui/scroll-area";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { formatPeriodName, formatDateRange, formatNOK } from "../_lib/format";
import type { PayslipEntry } from "../_hooks/use-my-salary";

// UI Events:
// - action: onSelect(period.id) — switches payslip detail to the selected period
// - color-regime: status-based (exported=emerald, closed=zinc)

type PeriodListProps = {
  payslips: PayslipEntry[];
  selectedPeriodId: string | null;
  onSelect: (periodId: string) => void;
  isLoading: boolean;
};

const STATUS_LABEL: Record<string, string> = {
  exported: "Utbetalt",
  closed: "Avregnet",
};

const STATUS_COLOR: Record<string, string> = {
  exported: "border-emerald-500/30 bg-emerald-500/10 text-emerald-500",
  closed: "border-border bg-muted text-muted-foreground",
};

export function PeriodList({ payslips, selectedPeriodId, onSelect, isLoading }: PeriodListProps) {
  return (
    <Card className="flex h-full flex-col">
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Perioder</CardTitle>
      </CardHeader>
      <CardContent className="flex-1 overflow-hidden p-2">
        {isLoading ? (
          <div className="space-y-2 p-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-14 w-full rounded-lg" />
            ))}
          </div>
        ) : payslips.length === 0 ? (
          <p className="text-muted-foreground p-4 text-center text-sm">Ingen lønnsgrunnlag ennå</p>
        ) : (
          <ScrollArea className="h-full">
            <div className="space-y-1 pr-3">
              {payslips.map(({ period, calculation }) => {
                const isSelected = period.id === selectedPeriodId;
                const statusLabel = STATUS_LABEL[period.status] ?? period.status;
                const statusColor =
                  STATUS_COLOR[period.status] ?? "border-border bg-muted text-muted-foreground";

                return (
                  <button
                    key={period.id}
                    type="button"
                    onClick={() => onSelect(period.id)}
                    className={cn(
                      "flex w-full flex-col gap-1 rounded-lg p-3 text-left transition-colors",
                      isSelected ? "bg-primary/10 ring-primary/30 ring-1" : "hover:bg-muted/50",
                    )}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate text-sm font-semibold">
                        {formatPeriodName(period.start_date)}
                      </span>
                      <Badge
                        variant="outline"
                        className={cn("shrink-0 border text-[10px] font-medium", statusColor)}
                      >
                        {statusLabel}
                      </Badge>
                    </div>
                    <div className="text-muted-foreground flex items-center justify-between text-xs">
                      <span>{formatDateRange(period.start_date, period.end_date)}</span>
                      <span className="font-medium tabular-nums">
                        {calculation ? formatNOK(calculation.total_pay) : "—"}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}
