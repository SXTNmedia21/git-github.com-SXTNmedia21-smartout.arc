"use client";

import { format } from "date-fns";
import { nb } from "date-fns/locale";
import { ArrowLeft, Check, Lock, RefreshCw } from "lucide-react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { Period } from "../_hooks/use-payroll-period";
import type { Database } from "@smartout/supabase";

type PeriodStatus = Database["payroll"]["Enums"]["period_status"];

const STATUS_LABELS: Record<PeriodStatus, string> = {
  open: "Åpen",
  locked: "Låst",
  approved: "Godkjent",
  exported: "Eksportert",
};

const STATUS_VARIANT: Record<PeriodStatus, "default" | "secondary" | "outline" | "destructive"> = {
  open: "secondary",
  locked: "default",
  approved: "default",
  exported: "outline",
};

type Props = {
  period: Period;
  deviationErrors: number;
  isRecalculating: boolean;
  isApproving?: boolean;
  onRecalculate: () => void;
  onLock: () => void;
  onApprove?: () => void;
};

/**
 * Period detail page header.
 * Shows: back link, period date range, status badge.
 * Actions by status:
 *   - open    → Recalculate + Lock
 *   - locked  → Godkjenn (P0 GAP-SIM-B02; ADR-0099 admin gate via BFF)
 *   - approved/exported → no actions (terminal states)
 */
export function PeriodHeader({
  period,
  deviationErrors,
  isRecalculating,
  isApproving,
  onRecalculate,
  onLock,
  onApprove,
}: Props) {
  const startLabel = format(new Date(period.start_date), "d. MMMM", { locale: nb });
  const endLabel = format(new Date(period.end_date), "d. MMMM yyyy", { locale: nb });

  const isOpen = period.status === "open";
  const isLocked = period.status === "locked";
  const canLock = isOpen && deviationErrors === 0;

  return (
    <div className="flex flex-col gap-3">
      {/* Breadcrumb */}
      <Link
        href="/dashboard/payroll"
        className="text-muted-foreground hover:text-foreground flex items-center gap-1 text-sm transition-colors"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Lønnsperioder
      </Link>

      {/* Header row */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <h1 className="text-foreground text-xl font-semibold">
            {startLabel} – {endLabel}
          </h1>
          <Badge variant={STATUS_VARIANT[period.status]}>{STATUS_LABELS[period.status]}</Badge>
          {deviationErrors > 0 && (
            <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">
              {deviationErrors} feil ubehandlet
            </span>
          )}
        </div>

        {/* Actions — open: Recalculate + Lock. locked: Godkjenn (P0 GAP-SIM-B02). */}
        {isOpen && (
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={onRecalculate}
              disabled={isRecalculating}
              className="gap-2"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${isRecalculating ? "animate-spin" : ""}`} />
              {isRecalculating ? "Beregner…" : "Beregn på nytt"}
            </Button>
            <Button
              size="sm"
              onClick={onLock}
              disabled={!canLock}
              title={!canLock ? "Bekreft alle feil-avvik før låsing" : undefined}
              className="gap-2"
            >
              <Lock className="h-3.5 w-3.5" />
              Lås periode
            </Button>
          </div>
        )}
        {isLocked && onApprove && (
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              onClick={onApprove}
              disabled={isApproving}
              className="gap-2"
              title="Godkjenn periode for utbetaling (Bokf §13 — terminal state)"
            >
              <Check className="h-3.5 w-3.5" />
              {isApproving ? "Godkjenner…" : "Godkjenn periode"}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
