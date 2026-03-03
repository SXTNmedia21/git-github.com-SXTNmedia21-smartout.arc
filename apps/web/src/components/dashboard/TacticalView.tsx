"use client";

import { useState, useMemo } from "react";
import {
  TrendingUp,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  AlertCircle,
  ShieldCheck,
} from "lucide-react";
import { SignalCard } from "./SignalCard";
import { DayInfoDialog } from "@/app/dashboard/schedule/_components/day-info-dialog";
import {
  useStaffingCoverage,
  getCurrentWeekStart,
  useTrainingReadiness,
  type DayCoverage,
} from "@/app/dashboard/_hooks";

// UI Events:
// - nav: onDateClick(date) — opens DayControlSheet via parent
// - action: setWeekOffset(+/-1) — week navigation
// - action: setWeekOffset(0) — "I dag" button resets to current week
// - action: setShowEventDialog(true) — opens DayInfoDialog
// - color-regime: status-based (good=emerald, warning=orange, critical=red)
// - visual: sparkline in Staffing card shows 7-day fill trend
// - visual: progressBar in Training card shows completion ratio
// - conditional: training alert strip only renders when pending > 0

interface TacticalViewProps {
  isDark: boolean;
  onDateClick?: (date: string) => void;
}

function getWeekStart(offset: number): string {
  const base = new Date(getCurrentWeekStart());
  base.setDate(base.getDate() + offset * 7);
  return base.toISOString().split("T")[0]!;
}

function getWeekNumber(dateStr: string): number {
  const d = new Date(dateStr);
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
}

function getStatusColor(fillPercent: number): string {
  if (fillPercent >= 100) return "bg-emerald-500";
  if (fillPercent >= 80) return "bg-orange-500";
  return "bg-red-500";
}

function getStatusTextColor(fillPercent: number): string {
  if (fillPercent >= 100) return "text-emerald-500";
  if (fillPercent >= 80) return "text-orange-500";
  return "text-red-500";
}

export function TacticalView({ onDateClick }: TacticalViewProps) {
  const [weekOffset, setWeekOffset] = useState(0);
  const [showEventDialog, setShowEventDialog] = useState(false);
  const weekStart = getWeekStart(weekOffset);
  const weekNum = getWeekNumber(weekStart);

  const { data: coverage, isLoading: coverageLoading } = useStaffingCoverage(weekStart);
  const { data: training } = useTrainingReadiness();

  // Compute overall staffing fill %
  const overallFill =
    coverage && coverage.length > 0
      ? Math.round(
          coverage.reduce((sum: number, d: DayCoverage) => sum + d.fillPercent, 0) /
            coverage.length,
        )
      : null;

  // Today's gaps for secondary text
  const todayStr = new Date().toISOString().split("T")[0];
  const todayGaps = useMemo(() => {
    if (!coverage) return 0;
    const today = coverage.find((d: DayCoverage) => d.date === todayStr);
    return today ? today.totalShifts - today.assignedShifts : 0;
  }, [coverage, todayStr]);

  // Sparkline data: fill percentages for each day of the week
  const sparklineData = useMemo(() => {
    if (!coverage || coverage.length === 0) return undefined;
    return coverage.map((d: DayCoverage) => d.fillPercent);
  }, [coverage]);

  const staffingStatus =
    overallFill === null
      ? "good"
      : overallFill >= 90
        ? "good"
        : overallFill >= 70
          ? "warning"
          : "critical";

  const trainingStatus = !training
    ? "good"
    : training.readinessPercent >= 90
      ? "good"
      : training.readinessPercent >= 70
        ? "warning"
        : "critical";

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 flex min-h-0 min-w-0 flex-1 flex-col gap-3 overflow-y-auto pr-2 pb-2 duration-500">
      {/* Signal Cards — 2 cards, 50/50 width */}
      <div className="grid flex-shrink-0 grid-cols-1 gap-4 md:grid-cols-2">
        <SignalCard
          label="Staffing Coverage"
          value={overallFill !== null ? `${overallFill}%` : "--"}
          target="target 100%"
          status={staffingStatus}
          icon={<TrendingUp className="h-4 w-4" />}
          sparkline={sparklineData}
          secondary={
            todayGaps > 0 ? `${todayGaps} ${todayGaps === 1 ? "gap" : "gaps"} i dag` : undefined
          }
        />
        <SignalCard
          label="Training Readiness"
          value={training ? `${training.readinessPercent}%` : "--"}
          target="target 100%"
          status={trainingStatus}
          icon={<CheckCircle2 className="h-4 w-4" />}
          trend={
            training
              ? {
                  direction: training.readinessPercent >= 90 ? "up" : "down",
                  label: `${training.completed}/${training.totalAssignments}`,
                }
              : undefined
          }
          progressBar={
            training ? { value: training.completed, max: training.totalAssignments } : undefined
          }
          secondary={training && training.pending > 0 ? `${training.pending} ventende` : undefined}
        />
      </div>

      {/* Weekly Staffing — full width, 7-column compact grid */}
      <div className="border-border bg-card flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border p-4 shadow-sm">
        {/* Header with week navigation */}
        <div className="mb-4 flex min-w-0 items-center justify-between">
          <div className="flex min-w-0 items-center gap-2">
            <button
              onClick={() => setWeekOffset((o) => o - 1)}
              className="border-border text-muted-foreground hover:bg-accent rounded-lg border p-1.5 transition-colors"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <h2 className="text-foreground truncate text-xl font-extrabold">Uke {weekNum}</h2>
            <button
              onClick={() => setWeekOffset((o) => o + 1)}
              className="border-border text-muted-foreground hover:bg-accent rounded-lg border p-1.5 transition-colors"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
            {weekOffset !== 0 && (
              <button
                onClick={() => setWeekOffset(0)}
                className="text-muted-foreground hover:text-foreground rounded-lg px-2 py-1 text-xs font-semibold transition-colors"
              >
                I dag
              </button>
            )}
          </div>
        </div>

        {/* 7-column day grid */}
        <div className="flex min-h-0 flex-1 flex-col">
          {coverageLoading ? (
            <div className="grid flex-1 grid-cols-7 gap-2">
              {Array.from({ length: 7 }).map((_, i) => (
                <div
                  key={i}
                  className="bg-muted/50 flex flex-col items-center gap-2 rounded-xl p-3"
                >
                  <div className="bg-muted h-3 w-8 animate-pulse rounded" />
                  <div className="bg-muted h-16 w-full animate-pulse rounded-lg" />
                  <div className="bg-muted h-3 w-6 animate-pulse rounded" />
                </div>
              ))}
            </div>
          ) : coverage && coverage.length > 0 ? (
            <div className="grid flex-1 grid-cols-7 gap-2">
              {coverage.map((d: DayCoverage) => {
                const gapCount = d.totalShifts - d.assignedShifts;
                const isToday = d.date === todayStr;
                const hasShifts = d.totalShifts > 0;
                const fillCapped = Math.min(d.fillPercent, 100);

                return (
                  <button
                    key={d.date}
                    onClick={() => onDateClick?.(d.date)}
                    className={`group hover:bg-accent flex flex-col items-center gap-1.5 rounded-xl border p-3 transition-colors ${
                      isToday ? "border-orange-500/30 bg-orange-500/5" : "border-border bg-card"
                    }`}
                  >
                    {/* Day label */}
                    <span
                      className={`text-xs font-bold uppercase ${
                        isToday ? "text-orange-500" : "text-muted-foreground"
                      }`}
                    >
                      {d.dayLabel}
                    </span>

                    {/* Fill percentage column */}
                    {hasShifts ? (
                      <div className="flex w-full flex-1 flex-col items-center justify-end gap-1">
                        {/* Vertical fill bar */}
                        <div className="bg-muted relative h-16 w-full overflow-hidden rounded-lg">
                          <div
                            className={`absolute bottom-0 left-0 w-full rounded-lg ${getStatusColor(d.fillPercent)} transition-all duration-1000 ease-out`}
                            style={{ height: `${fillCapped}%` }}
                          />
                        </div>
                        {/* Percentage */}
                        <span className={`text-sm font-bold ${getStatusTextColor(d.fillPercent)}`}>
                          {d.fillPercent}%
                        </span>
                      </div>
                    ) : (
                      <div className="flex flex-1 flex-col items-center justify-center">
                        <span className="text-muted-foreground text-xs">--</span>
                      </div>
                    )}

                    {/* Gap count or check */}
                    <div className="flex h-4 items-center">
                      {!hasShifts ? null : gapCount > 0 ? (
                        <span className="text-xs font-semibold text-orange-500">
                          {gapCount} gap{gapCount !== 1 ? "s" : ""}
                        </span>
                      ) : (
                        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="flex flex-1 items-center justify-center">
              <p className="text-muted-foreground text-sm">Ingen skift planlagt denne uken</p>
            </div>
          )}
        </div>
      </div>

      {/* Training alert strip — only renders when pending > 0 */}
      {training && training.pending > 0 && (
        <div className="flex flex-shrink-0 items-center gap-3 rounded-xl border border-orange-500/20 bg-orange-500/5 px-4 py-3">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-orange-500" />
            <AlertCircle className="h-3.5 w-3.5 text-orange-500" />
          </div>
          <p className="text-foreground flex-1 text-sm font-semibold">
            {training.pending} ventende protokoller
            <span className="text-muted-foreground mx-1.5">&middot;</span>
            <span className="text-muted-foreground">{training.readinessPercent}% readiness</span>
          </p>
          <button
            onClick={() => setShowEventDialog(true)}
            className="text-xs font-bold text-orange-500 transition-colors hover:text-orange-400"
          >
            Vis alle &rarr;
          </button>
        </div>
      )}

      <DayInfoDialog dateId={weekStart} open={showEventDialog} onOpenChange={setShowEventDialog} />
    </div>
  );
}
