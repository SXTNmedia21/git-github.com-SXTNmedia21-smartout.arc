/**
 * BalancesSidebar — right column of the Min Lønn page.
 *
 * Shows the employee's absence quotas per type (Ferie, Egenmelding, etc.)
 * and the timebank balance with the 5 most recent entries.
 *
 * Color coding for quota rows:
 *   - >= 50% remaining: emerald
 *   - 20–49% remaining: amber
 *   - < 20% remaining: red
 */

"use client";

import { Clock, Calendar } from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { formatHours } from "../_lib/format";
import type { MySalaryData } from "../_hooks/use-my-salary";

// UI Events:
// - display-only: balances are read-only, no interactions

type BalancesSidebarProps = {
  data: MySalaryData | undefined;
  isLoading: boolean;
};

/** Maps remaining percentage to a color class set */
function quotaColor(remaining: number, total: number): string {
  if (total === 0) return "text-muted-foreground";
  const pct = remaining / total;
  if (pct >= 0.5) return "text-emerald-500";
  if (pct >= 0.2) return "text-amber-500";
  return "text-destructive";
}

/** Maps remaining percentage to a progress bar fill color */
function quotaBarColor(remaining: number, total: number): string {
  if (total === 0) return "bg-muted";
  const pct = remaining / total;
  if (pct >= 0.5) return "bg-emerald-500";
  if (pct >= 0.2) return "bg-amber-500";
  return "bg-destructive";
}

/** Human-readable label for a timebank entry type */
const TIMEBANK_ENTRY_LABEL: Record<string, string> = {
  accrual: "Opparbeidet",
  carry_over: "Overført",
  adjustment: "Justering",
  withdrawal: "Uttak",
  expiry: "Utløpt",
  payout: "Utbetalt",
};

/** Sign prefix for timebank entry display (credit = +, debit = -) */
const CREDIT_TYPES = ["accrual", "carry_over", "adjustment"] as const;

export function BalancesSidebar({ data, isLoading }: BalancesSidebarProps) {
  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-48 w-full rounded-lg" />
        <Skeleton className="h-40 w-full rounded-lg" />
      </div>
    );
  }

  const absenceTypes = data?.absenceTypes ?? [];
  const absenceQuotas = data?.absenceQuotas ?? [];
  const timebankBalance = data?.timebankBalance ?? 0;
  const recentEntries = (data?.timebankEntries ?? []).slice(0, 5);

  return (
    <div className="flex flex-col gap-4">
      {/* Absence balance card */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <Calendar className="text-muted-foreground h-4 w-4" />
            Fraværsbalanse
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 pt-0">
          {absenceQuotas.length === 0 ? (
            <p className="text-muted-foreground text-sm">Ingen kvoter registrert</p>
          ) : (
            absenceQuotas.map((quota) => {
              const typeName =
                absenceTypes.find((t) => t.id === quota.absence_type_id)?.name ?? "Ukjent type";

              // Compute total — entitled + adjustments + carry-overs
              const total = quota.entitled_days + quota.adjusted_days + quota.carried_over_days;
              const remaining = quota.remaining_days ?? 0;
              const used = total - remaining;
              const barWidth = total > 0 ? Math.round((remaining / total) * 100) : 0;

              return (
                <div key={quota.id} className="space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-foreground text-sm font-medium">{typeName}</span>
                    <span
                      className={cn(
                        "text-sm font-semibold tabular-nums",
                        quotaColor(remaining, total),
                      )}
                    >
                      {remaining} av {total} dager
                    </span>
                  </div>

                  {/* Progress bar: shows remaining days, not used days */}
                  <div className="bg-muted h-1.5 w-full overflow-hidden rounded-full">
                    <div
                      className={cn(
                        "h-full rounded-full transition-all",
                        quotaBarColor(remaining, total),
                      )}
                      style={{ width: `${barWidth}%` }}
                    />
                  </div>

                  <p className="text-muted-foreground text-xs">
                    {used} brukt · {remaining} gjenstår
                  </p>
                </div>
              );
            })
          )}
        </CardContent>
      </Card>

      {/* Timebank card */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <Clock className="text-muted-foreground h-4 w-4" />
            Timebank
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          {/* Balance hero */}
          <div className="mb-4 flex items-baseline gap-1">
            <span
              className={cn(
                "text-2xl font-black tabular-nums",
                timebankBalance > 0
                  ? "text-emerald-500"
                  : timebankBalance < 0
                    ? "text-destructive"
                    : "text-muted-foreground",
              )}
            >
              {timebankBalance > 0 ? "+" : ""}
              {formatHours(timebankBalance)}
            </span>
            <span className="text-muted-foreground text-xs">tilgjengelig</span>
          </div>

          {/* Recent entries */}
          {recentEntries.length === 0 ? (
            <p className="text-muted-foreground text-sm">Ingen bevegelser registrert</p>
          ) : (
            <div className="space-y-2">
              <p className="text-muted-foreground mb-1 text-xs font-medium tracking-wide uppercase">
                Siste bevegelser
              </p>
              {recentEntries.map((entry) => {
                const isCredit = CREDIT_TYPES.includes(
                  entry.entry_type as (typeof CREDIT_TYPES)[number],
                );
                const sign = isCredit ? "+" : "-";
                const label = TIMEBANK_ENTRY_LABEL[entry.entry_type] ?? entry.entry_type;

                return (
                  <div key={entry.id} className="flex items-center justify-between">
                    <div className="flex flex-col">
                      <span className="text-foreground text-xs font-medium">{label}</span>
                      <span className="text-muted-foreground text-[11px]">
                        {entry.effective_date}
                      </span>
                    </div>
                    <span
                      className={cn(
                        "text-xs font-semibold tabular-nums",
                        isCredit ? "text-emerald-500" : "text-destructive",
                      )}
                    >
                      {sign}
                      {formatHours(entry.hours)}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
