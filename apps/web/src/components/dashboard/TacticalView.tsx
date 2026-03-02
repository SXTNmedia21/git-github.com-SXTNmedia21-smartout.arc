"use client";

import { useState } from "react";
import {
  Calendar,
  TrendingUp,
  Percent,
  Clock,
  AlertCircle,
  CheckCircle2,
  ShieldCheck,
  ChevronLeft,
  ChevronRight,
  Plus,
} from "lucide-react";
import { SignalCard } from "./SignalCard";
import { DayInfoDialog } from "@/app/dashboard/schedule/_components/day-info-dialog";
import {
  useStaffingCoverage,
  getCurrentWeekStart,
  useTrainingReadiness,
  type DayCoverage,
} from "@/app/dashboard/_hooks";

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

export function TacticalView({ isDark, onDateClick }: TacticalViewProps) {
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
      {/* Top Signal Cards */}
      <div className="grid flex-shrink-0 grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
        <SignalCard
          isDark={isDark}
          label="Staffing Coverage"
          value={overallFill !== null ? `${overallFill}%` : "--"}
          target="target 100%"
          status={staffingStatus}
          icon={<TrendingUp className="h-4 w-4" />}
        />
        <SignalCard
          isDark={isDark}
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
        />
        <SignalCard
          isDark={isDark}
          label="Cost of Sales %"
          value="--"
          status="good"
          icon={<Percent className="h-4 w-4" />}
          isPlaceholder
        />
        <SignalCard
          isDark={isDark}
          label="Absence (MTD)"
          value="--"
          status="good"
          icon={<Clock className="h-4 w-4" />}
          isPlaceholder
        />
      </div>

      <div className="grid min-h-0 min-w-0 flex-1 grid-cols-1 gap-3 overflow-hidden lg:grid-cols-3">
        {/* Main Weekly Schedule Overview */}
        <div
          className={`flex min-h-0 min-w-0 flex-col overflow-hidden rounded-2xl border p-4 shadow-sm lg:col-span-2 ${isDark ? "border-zinc-800 bg-[#0c0c0e]" : "border-zinc-200 bg-white"}`}
        >
          <div className="mb-4 flex min-w-0 items-center justify-between">
            <div className="flex min-w-0 items-center gap-2">
              <button
                onClick={() => setWeekOffset((o) => o - 1)}
                className={`rounded-lg border p-1.5 transition-colors ${isDark ? "border-zinc-700 text-zinc-400 hover:bg-zinc-800" : "border-zinc-200 text-zinc-500 hover:bg-zinc-50"}`}
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <h2
                className={`truncate text-xl font-extrabold ${isDark ? "text-zinc-100" : "text-zinc-800"}`}
              >
                Staffing Coverage (Week {weekNum})
              </h2>
              <button
                onClick={() => setWeekOffset((o) => o + 1)}
                className={`rounded-lg border p-1.5 transition-colors ${isDark ? "border-zinc-700 text-zinc-400 hover:bg-zinc-800" : "border-zinc-200 text-zinc-500 hover:bg-zinc-50"}`}
              >
                <ChevronRight className="h-4 w-4" />
              </button>
              {weekOffset !== 0 && (
                <button
                  onClick={() => setWeekOffset(0)}
                  className={`rounded-lg px-2 py-1 text-xs font-semibold ${isDark ? "text-zinc-400 hover:text-zinc-200" : "text-zinc-500 hover:text-zinc-700"}`}
                >
                  Today
                </button>
              )}
            </div>
          </div>

          <div className="flex min-h-0 flex-1 flex-col justify-around">
            {coverageLoading ? (
              Array.from({ length: 7 }).map((_, i) => (
                <div key={i} className="flex items-center gap-4">
                  <span
                    className={`w-10 text-sm font-bold ${isDark ? "text-zinc-600" : "text-zinc-300"}`}
                  >
                    ---
                  </span>
                  <div
                    className={`h-6 flex-1 animate-pulse rounded-lg ${isDark ? "bg-zinc-800/50" : "bg-zinc-100"}`}
                  />
                </div>
              ))
            ) : coverage && coverage.length > 0 ? (
              coverage.map((d: DayCoverage) => {
                const fill = `${d.fillPercent}%`;
                const barColor =
                  d.fillPercent >= 100
                    ? isDark
                      ? "bg-emerald-500/80"
                      : "bg-emerald-500"
                    : d.fillPercent >= 80
                      ? isDark
                        ? "bg-orange-500/80"
                        : "bg-orange-500"
                      : isDark
                        ? "bg-red-500/80"
                        : "bg-red-500";
                const gapCount = d.totalShifts - d.assignedShifts;
                return (
                  <button
                    key={d.date}
                    onClick={() => onDateClick?.(d.date)}
                    className={`group flex w-full items-center gap-4 rounded-lg px-1 transition-colors ${isDark ? "hover:bg-white/5" : "hover:bg-zinc-50"}`}
                  >
                    <span
                      className={`w-10 text-left text-sm font-bold ${isDark ? "text-zinc-400" : "text-zinc-500"}`}
                    >
                      {d.dayLabel}
                    </span>
                    <div
                      className={`relative h-6 min-w-0 flex-1 overflow-hidden rounded-lg ${isDark ? "bg-zinc-800/50" : "bg-zinc-100"}`}
                    >
                      <div
                        className={`h-full ${barColor} transition-all duration-1000 ease-out`}
                        style={{ width: fill }}
                      />
                    </div>
                    <div className="flex w-32 shrink-0 items-center justify-end gap-2">
                      {gapCount > 0 && (
                        <span
                          className={`text-xs font-semibold ${isDark ? "text-orange-400" : "text-orange-500"}`}
                        >
                          {gapCount} Open
                        </span>
                      )}
                      {d.totalShifts === 0 ? (
                        <span className={`text-xs ${isDark ? "text-zinc-600" : "text-zinc-400"}`}>
                          No shifts
                        </span>
                      ) : d.fillPercent >= 100 ? (
                        <CheckCircle2
                          className={`h-4 w-4 ${isDark ? "text-emerald-500" : "text-emerald-500"}`}
                        />
                      ) : (
                        <AlertCircle
                          className={`h-4 w-4 ${isDark ? "text-orange-500" : "text-orange-500"}`}
                        />
                      )}
                    </div>
                  </button>
                );
              })
            ) : (
              <div className="flex flex-1 items-center justify-center">
                <p className={`text-sm ${isDark ? "text-zinc-500" : "text-zinc-400"}`}>
                  No shifts scheduled this week
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Sidebar Widgets */}
        <div className="flex h-full min-h-0 min-w-0 flex-col gap-3">
          {/* Team Health / Compliance */}
          <div
            className={`flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border p-4 shadow-sm ${isDark ? "border-zinc-800 bg-[#0c0c0e]" : "border-zinc-200 bg-white"}`}
          >
            <h3
              className={`mb-3 flex items-center gap-2 text-sm font-bold tracking-widest uppercase ${isDark ? "text-zinc-400" : "text-zinc-500"}`}
            >
              <ShieldCheck className="h-4 w-4 text-orange-500" />
              Training & Compliance
            </h3>
            <div className="flex min-h-0 flex-1 flex-col justify-around gap-3 overflow-hidden">
              {training && training.pending > 0 ? (
                <div
                  className={`rounded-lg border p-3 ${isDark ? "border-orange-500/20 bg-orange-500/5" : "border-orange-200 bg-orange-50"}`}
                >
                  <div className="flex items-start gap-3">
                    <AlertCircle
                      className={`mt-0.5 h-4 w-4 ${isDark ? "text-orange-400" : "text-orange-500"}`}
                    />
                    <div>
                      <h4
                        className={`text-sm font-bold ${isDark ? "text-orange-400" : "text-orange-700"}`}
                      >
                        {training.pending} Pending Protocols
                      </h4>
                      <p
                        className={`mt-1 text-xs ${isDark ? "text-orange-300/70" : "text-orange-600/80"}`}
                      >
                        {training.completed} of {training.totalAssignments} protocol assignments
                        completed ({training.readinessPercent}%).
                      </p>
                    </div>
                  </div>
                </div>
              ) : (
                <div
                  className={`rounded-lg border p-3 ${isDark ? "border-emerald-500/20 bg-emerald-500/5" : "border-emerald-200 bg-emerald-50"}`}
                >
                  <div className="flex items-center gap-3">
                    <CheckCircle2
                      className={`h-4 w-4 ${isDark ? "text-emerald-400" : "text-emerald-500"}`}
                    />
                    <h4
                      className={`text-sm font-bold ${isDark ? "text-emerald-400" : "text-emerald-700"}`}
                    >
                      All protocols up to date
                    </h4>
                  </div>
                </div>
              )}

              <div
                className={`flex items-center justify-between rounded-lg border p-3 ${isDark ? "border-zinc-800 bg-zinc-900" : "border-zinc-200 bg-zinc-50"}`}
              >
                <div>
                  <h4 className={`text-sm font-bold ${isDark ? "text-zinc-300" : "text-zinc-700"}`}>
                    Readiness Score
                  </h4>
                  <p className={`mt-0.5 text-xs ${isDark ? "text-zinc-500" : "text-zinc-500"}`}>
                    Protocol completion
                  </p>
                </div>
                <div className="text-right">
                  <div className={`text-xl font-black ${isDark ? "text-white" : "text-zinc-900"}`}>
                    {training ? `${training.readinessPercent}%` : "--"}
                  </div>
                  <div className="text-[10px] font-bold text-emerald-500">Target 100%</div>
                </div>
              </div>
            </div>
          </div>

          {/* Upcoming Events (mock - kept as placeholder) */}
          <div
            className={`flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border p-4 shadow-sm ${isDark ? "border-zinc-800 bg-[#0c0c0e]" : "border-zinc-200 bg-white"}`}
          >
            <div className="mb-3 flex items-center justify-between">
              <h3
                className={`flex items-center gap-2 text-sm font-bold tracking-widest uppercase ${isDark ? "text-zinc-400" : "text-zinc-500"}`}
              >
                <Calendar className="h-4 w-4 text-blue-500" />
                Upcoming Events (Impact)
              </h3>
              <button
                onClick={() => setShowEventDialog(true)}
                className={`rounded-lg p-1 transition-colors ${isDark ? "hover:bg-white/5" : "hover:bg-zinc-100"}`}
                title="Add event"
              >
                <Plus className={`h-3.5 w-3.5 ${isDark ? "text-zinc-400" : "text-zinc-500"}`} />
              </button>
            </div>
            <div className="flex min-h-0 flex-1 flex-col justify-around gap-4 overflow-hidden">
              <div
                className={`flex flex-1 items-center justify-center rounded-lg border-2 border-dashed ${isDark ? "border-zinc-800" : "border-zinc-200"}`}
              >
                <p
                  className={`text-center text-xs font-semibold ${isDark ? "text-zinc-600" : "text-zinc-400"}`}
                >
                  Coming soon — connect events to see staffing impact
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <DayInfoDialog
        dateId={weekStart}
        open={showEventDialog}
        onOpenChange={setShowEventDialog}
      />
    </div>
  );
}
