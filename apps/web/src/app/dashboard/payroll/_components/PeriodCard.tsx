"use client";

import Link from "next/link";
import { format } from "date-fns";
import { nb } from "date-fns/locale";
import { AlertCircle, AlertTriangle, CheckCircle2, Clock, Lock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { PeriodSummary } from "../_hooks/use-payroll-periods";
import type { Database } from "@smartout/supabase";

type PeriodStatus = Database["payroll"]["Enums"]["period_status"];

const STATUS_CONFIG: Record<
  PeriodStatus,
  {
    label: string;
    variant: "default" | "secondary" | "outline" | "destructive";
    icon: React.FC<{ className?: string }>;
  }
> = {
  open: { label: "Åpen", variant: "secondary", icon: Clock },
  locked: { label: "Låst", variant: "default", icon: Lock },
  approved: { label: "Godkjent", variant: "default", icon: CheckCircle2 },
  exported: { label: "Eksportert", variant: "outline", icon: CheckCircle2 },
};

type Props = {
  summary: PeriodSummary;
};

/**
 * One row in the period list. Links to /dashboard/payroll/[periodId].
 * Shows period date range, status badge, deviation counts, and line count.
 */
export function PeriodCard({ summary }: Props) {
  const { period, deviationErrors, deviationWarnings, totalLines } = summary;
  const cfg = STATUS_CONFIG[period.status] ?? STATUS_CONFIG.open;
  const StatusIcon = cfg.icon;

  const startLabel = format(new Date(period.start_date), "d. MMM", { locale: nb });
  const endLabel = format(new Date(period.end_date), "d. MMM yyyy", { locale: nb });

  return (
    <Link
      href={`/dashboard/payroll/${period.id}`}
      className="hover:bg-muted/50 flex items-center justify-between rounded-lg border px-4 py-3 transition-colors"
    >
      {/* Date range */}
      <div className="min-w-0">
        <p className="text-foreground font-medium">
          {startLabel} – {endLabel}
        </p>
        <p className="text-muted-foreground text-xs">
          {totalLines} {totalLines === 1 ? "ansatt" : "ansatte"}
        </p>
      </div>

      {/* Status + deviations */}
      <div className="flex shrink-0 items-center gap-3">
        {deviationErrors > 0 && (
          <span className="flex items-center gap-1 text-xs text-red-600">
            <AlertCircle className="h-3.5 w-3.5" />
            {deviationErrors}
          </span>
        )}
        {deviationWarnings > 0 && (
          <span className="flex items-center gap-1 text-xs text-amber-500">
            <AlertTriangle className="h-3.5 w-3.5" />
            {deviationWarnings}
          </span>
        )}
        <Badge variant={cfg.variant} className="gap-1">
          <StatusIcon className="h-3 w-3" />
          {cfg.label}
        </Badge>
      </div>
    </Link>
  );
}
