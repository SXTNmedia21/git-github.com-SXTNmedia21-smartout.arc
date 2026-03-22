/**
 * PayslipDetail — center column of the Min Lønn page.
 *
 * Shows the net pay hero for the selected period and a full breakdown:
 * hours worked, base pay, supplements, overtime, gross, tax, net.
 *
 * All figures are Tier: Settled — from closed payroll periods. No disclaimers.
 * Line-item detail (supplements, overtime) loads lazily via usePayslipLines.
 */

"use client";

import { Loader2 } from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import {
  formatNOK,
  formatMinutesToHours,
  formatPeriodName,
  formatDayMonth,
  formatDateRange,
} from "../_lib/format";
import { usePayslipLines } from "../_hooks/use-payslip-lines";
import type { PayslipEntry } from "../_hooks/use-my-salary";

// UI Events:
// - display-only: all payroll figures are read-only, no mutation surfaces
// - color-regime: net pay in emerald, tax deduction in destructive

type PayslipDetailProps = {
  payslip: PayslipEntry | null;
  isLoading: boolean;
};

/** Single labeled row in the breakdown table */
function BreakdownRow({
  label,
  value,
  bold = false,
  variant = "default",
}: {
  label: string;
  value: string;
  bold?: boolean;
  variant?: "default" | "positive" | "negative";
}) {
  return (
    <div className="flex items-center justify-between py-2">
      <span
        className={cn("text-sm", bold ? "text-foreground font-semibold" : "text-muted-foreground")}
      >
        {label}
      </span>
      <span
        className={cn(
          "text-sm tabular-nums",
          bold ? "font-bold" : "font-medium",
          variant === "positive" && "text-emerald-500",
          variant === "negative" && "text-destructive",
          variant === "default" && "text-foreground",
        )}
      >
        {value}
      </span>
    </div>
  );
}

/** Supplement type badges extracted from calculation lines */
function SupplementBadges({
  lines,
}: {
  lines: { line_type: string; description: string; amount: number }[];
}) {
  const supplementLines = lines.filter((l) => l.line_type === "supplement");
  if (supplementLines.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-1 pb-2">
      {supplementLines.map((line, i) => (
        <Badge
          key={i}
          variant="outline"
          className="border-orange-500/30 bg-orange-500/10 text-[10px] text-orange-400"
        >
          {line.description}
        </Badge>
      ))}
    </div>
  );
}

export function PayslipDetail({ payslip, isLoading }: PayslipDetailProps) {
  const { period, calculation } = payslip ?? { period: null, calculation: null };

  // Load line items only when we have a calculation to show
  const { data: lines = [], isLoading: linesLoading } = usePayslipLines(calculation?.id ?? null);

  if (isLoading) {
    return (
      <Card className="h-full">
        <CardContent className="space-y-4 p-6">
          <Skeleton className="mx-auto h-8 w-32" />
          <Skeleton className="mx-auto h-12 w-48" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-4 w-5/6" />
        </CardContent>
      </Card>
    );
  }

  if (!payslip || !period) {
    return (
      <Card className="flex h-full items-center justify-center">
        <p className="text-muted-foreground text-sm">Velg en periode fra listen</p>
      </Card>
    );
  }

  if (!calculation) {
    return (
      <Card className="flex h-full items-center justify-center">
        <p className="text-muted-foreground text-sm">
          Ingen lønnsberegning for {formatPeriodName(period.start_date)}
        </p>
      </Card>
    );
  }

  // Aggregate line item amounts by type for the breakdown
  const supplementTotal = lines
    .filter((l) => l.line_type === "supplement")
    .reduce((sum, l) => sum + l.amount, 0);

  const overtimeTotal = lines
    .filter((l) => l.line_type === "overtime")
    .reduce((sum, l) => sum + l.amount, 0);

  const grossPay = calculation.base_pay + calculation.total_supplements;

  return (
    <div className="flex h-full flex-col gap-4 overflow-y-auto">
      {/* Net pay hero card */}
      <Card className="relative overflow-hidden">
        {/* Signature glow orb behind the hero amount */}
        <div className="pointer-events-none absolute -top-8 -right-8 h-40 w-40 rounded-full bg-emerald-500/10 blur-3xl" />

        <CardContent className="relative flex flex-col items-center gap-2 pt-6 pb-6">
          <p className="text-muted-foreground text-sm font-medium">
            {formatPeriodName(period.start_date)}
          </p>
          <p className="text-4xl font-black text-emerald-500 tabular-nums">
            {formatNOK(calculation.total_pay)}
          </p>
          <p className="text-muted-foreground text-xs">Utbetalt netto</p>

          <div className="mt-1 flex items-center gap-2">
            <Badge
              variant="outline"
              className="border-emerald-500/30 bg-emerald-500/10 text-[11px] font-semibold text-emerald-500"
            >
              {period.status === "exported" ? "Utbetalt" : "Avregnet"}
              {period.exported_at ? ` ${formatDayMonth(period.exported_at)}` : ""}
            </Badge>
            <span className="text-muted-foreground text-xs">
              {formatDateRange(period.start_date, period.end_date)}
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Breakdown card */}
      <Card className="flex-1">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Spesifikasjon</CardTitle>
            {linesLoading && <Loader2 className="text-muted-foreground h-4 w-4 animate-spin" />}
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          {/* Hours worked */}
          <BreakdownRow
            label="Arbeidstimer"
            value={formatMinutesToHours(calculation.net_working_minutes)}
          />

          <Separator className="my-1" />

          {/* Base pay */}
          <BreakdownRow label="Grunnlønn" value={formatNOK(calculation.base_pay)} />

          {/* Supplements — only shown when present */}
          {supplementTotal > 0 && (
            <>
              <BreakdownRow label="Tillegg" value={formatNOK(supplementTotal)} />
              <SupplementBadges lines={lines} />
            </>
          )}

          {/* Overtime — only shown when present */}
          {overtimeTotal > 0 && <BreakdownRow label="Overtid" value={formatNOK(overtimeTotal)} />}

          {/* Heavy divider before gross */}
          <Separator className="my-3" />

          <BreakdownRow label="Bruttolønn" value={formatNOK(grossPay)} bold />

          {/* Tax deduction — only shown when present */}
          {calculation.total_deductions > 0 && (
            <BreakdownRow
              label="Skattetrekk"
              value={`-${formatNOK(calculation.total_deductions)}`}
              variant="negative"
            />
          )}

          {/* Heavy divider before net */}
          <Separator className="my-3" />

          <BreakdownRow
            label="Utbetalt"
            value={formatNOK(calculation.total_pay)}
            bold
            variant="positive"
          />
        </CardContent>
      </Card>
    </div>
  );
}
