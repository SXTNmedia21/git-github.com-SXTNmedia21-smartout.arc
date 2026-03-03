"use client";

import { useMemo } from "react";
import { useSeasonBudget, useDayFactors, useHourFactors } from "../_hooks";
import { useOperatingHours } from "../../settings/_hooks/use-operating-hours";
import {
  calculateDayTargets,
  calculateHourTargets,
  calculateStaffingNeed,
} from "@/lib/season-calculations";
import { DollarSign, Users, Clock, TrendingUp } from "lucide-react";

function parseTimeToHour(time: string): number {
  return parseInt(time.split(":")[0] ?? "0", 10);
}

type Props = {
  seasonId: string;
  seasonBudgetId: string;
  seasonStartDate: string | null;
  seasonEndDate: string | null;
  isDark: boolean;
};

export function SeasonOverviewTab({
  seasonId,
  seasonBudgetId,
  seasonStartDate,
  seasonEndDate,
  isDark,
}: Props) {
  const { budget } = useSeasonBudget(seasonId);
  const { dayFactors } = useDayFactors(seasonBudgetId);
  const { hourFactors } = useHourFactors(seasonBudgetId);
  const { hours: operatingHours } = useOperatingHours();

  // Derive operating hours
  const opHours = useMemo(() => {
    if (operatingHours.length === 0) return { openHour: 10, closeHour: 22 };
    const openTimes = operatingHours.filter((oh) => !oh.is_closed);
    if (openTimes.length === 0) return { openHour: 10, closeHour: 22 };
    return {
      openHour: Math.min(...openTimes.map((oh) => parseTimeToHour(oh.open_time))),
      closeHour: Math.max(...openTimes.map((oh) => parseTimeToHour(oh.close_time))),
    };
  }, [operatingHours]);

  // Calculate day targets for first week
  const sampleDayTargets = useMemo(() => {
    if (!budget || !seasonStartDate || !seasonEndDate) return [];

    return calculateDayTargets({
      totalTargetRevenue: budget.total_target_revenue,
      startDate: seasonStartDate,
      endDate: seasonEndDate,
      dayFactors: dayFactors.map((df) => ({ weekday: df.weekday, factor: df.factor })),
    }).slice(0, 7); // First week as sample
  }, [budget, seasonStartDate, seasonEndDate, dayFactors]);

  // Calculate hour targets for peak day (highest day target)
  const peakDayHourTargets = useMemo(() => {
    const first = sampleDayTargets[0];
    if (!first) return [];
    const peakDay = sampleDayTargets.reduce((max, d) => (d.target > max.target ? d : max), first);

    return calculateHourTargets({
      dayTarget: peakDay.target,
      hourFactors: hourFactors.map((hf) => ({ hour: hf.hour, factor: hf.factor })),
      operatingHours: opHours,
    });
  }, [sampleDayTargets, hourFactors, opHours]);

  // Peak hour staffing
  const peakStaffing = useMemo(() => {
    const firstHour = peakDayHourTargets[0];
    if (!firstHour || !budget) return null;
    const peakHour = peakDayHourTargets.reduce(
      (max, h) => (h.target > max.target ? h : max),
      firstHour,
    );

    return {
      hour: peakHour.hour,
      ...calculateStaffingNeed({
        hourTarget: peakHour.target,
        targetLaborPercentage: budget.target_labor_percentage,
        avgHourlyWage: budget.avg_hourly_wage ?? 0,
      }),
    };
  }, [peakDayHourTargets, budget]);

  // Summary stats
  const avgDailyTarget =
    sampleDayTargets.length > 0
      ? sampleDayTargets.reduce((sum, d) => sum + d.target, 0) / sampleDayTargets.length
      : 0;

  const expectedGuests =
    budget?.base_price_per_guest && budget.base_price_per_guest > 0
      ? Math.round(
          avgDailyTarget / (budget.base_price_per_guest * (budget.season_price_factor ?? 1)),
        )
      : null;

  const cardClass = isDark
    ? "rounded-2xl border border-zinc-800 bg-[#0c0c0e] p-6"
    : "rounded-2xl border border-zinc-200 bg-white p-6";

  const metricCardClass = isDark
    ? "flex flex-col justify-between rounded-2xl border border-zinc-800/80 bg-[#121216] p-4"
    : "flex flex-col justify-between rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm";

  if (!budget) {
    return (
      <div className={cardClass}>
        <p className={`text-sm ${isDark ? "text-zinc-500" : "text-zinc-400"}`}>
          Sett opp budsjett først for å se beregninger.
        </p>
      </div>
    );
  }

  const formatNOK = (n: number) =>
    new Intl.NumberFormat("nb-NO", {
      style: "currency",
      currency: "NOK",
      maximumFractionDigits: 0,
    }).format(n);

  const WEEKDAY_SHORT = ["Man", "Tir", "Ons", "Tor", "Fre", "Lør", "Søn"];

  return (
    <div className="space-y-6">
      {/* Metric cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <div className={metricCardClass}>
          <div className="mb-2 flex items-center gap-2">
            <DollarSign className="h-4 w-4 text-emerald-500" />
            <span
              className={`text-xs font-bold tracking-wider uppercase ${isDark ? "text-zinc-500" : "text-zinc-400"}`}
            >
              Sesongmål
            </span>
          </div>
          <span className={`text-2xl font-extrabold ${isDark ? "text-white" : "text-zinc-900"}`}>
            {formatNOK(budget.total_target_revenue)}
          </span>
        </div>

        <div className={metricCardClass}>
          <div className="mb-2 flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-blue-500" />
            <span
              className={`text-xs font-bold tracking-wider uppercase ${isDark ? "text-zinc-500" : "text-zinc-400"}`}
            >
              Snitt/dag
            </span>
          </div>
          <span className={`text-2xl font-extrabold ${isDark ? "text-white" : "text-zinc-900"}`}>
            {formatNOK(avgDailyTarget)}
          </span>
        </div>

        <div className={metricCardClass}>
          <div className="mb-2 flex items-center gap-2">
            <Users className="h-4 w-4 text-purple-500" />
            <span
              className={`text-xs font-bold tracking-wider uppercase ${isDark ? "text-zinc-500" : "text-zinc-400"}`}
            >
              Topp bemanning
            </span>
          </div>
          <span className={`text-2xl font-extrabold ${isDark ? "text-white" : "text-zinc-900"}`}>
            {peakStaffing ? `${Math.ceil(peakStaffing.staffNeeded)} pers` : "\u2014"}
          </span>
          {peakStaffing && (
            <span className={`text-xs ${isDark ? "text-zinc-500" : "text-zinc-400"}`}>
              kl {peakStaffing.hour}:00
            </span>
          )}
        </div>

        <div className={metricCardClass}>
          <div className="mb-2 flex items-center gap-2">
            <Clock className="h-4 w-4 text-orange-500" />
            <span
              className={`text-xs font-bold tracking-wider uppercase ${isDark ? "text-zinc-500" : "text-zinc-400"}`}
            >
              Gjester/dag
            </span>
          </div>
          <span className={`text-2xl font-extrabold ${isDark ? "text-white" : "text-zinc-900"}`}>
            {expectedGuests ?? "\u2014"}
          </span>
        </div>
      </div>

      {/* Weekly distribution */}
      <div className={cardClass}>
        <h3 className={`mb-4 text-lg font-bold ${isDark ? "text-white" : "text-zinc-900"}`}>
          Ukentlig fordeling (første uke)
        </h3>
        <div className="flex items-end gap-2">
          {sampleDayTargets.map((d) => {
            const maxTarget = Math.max(...sampleDayTargets.map((t) => t.target));
            const heightPct = maxTarget > 0 ? (d.target / maxTarget) * 100 : 0;
            return (
              <div key={d.date} className="flex flex-1 flex-col items-center gap-1">
                <span className={`text-xs font-bold ${isDark ? "text-zinc-400" : "text-zinc-500"}`}>
                  {formatNOK(d.target)}
                </span>
                <div
                  className="w-full rounded-t-lg bg-blue-600/30 transition-all"
                  style={{ height: `${Math.max(heightPct * 1.5, 8)}px` }}
                />
                <span
                  className={`text-xs font-medium ${isDark ? "text-zinc-500" : "text-zinc-400"}`}
                >
                  {WEEKDAY_SHORT[d.weekday]}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Hourly distribution for peak day */}
      {peakDayHourTargets.length > 0 && (
        <div className={cardClass}>
          <h3 className={`mb-4 text-lg font-bold ${isDark ? "text-white" : "text-zinc-900"}`}>
            Timefordeling (toppdag)
          </h3>
          <div className="flex items-end gap-1">
            {peakDayHourTargets.map((h) => {
              const maxHourTarget = Math.max(...peakDayHourTargets.map((t) => t.target));
              const heightPct = maxHourTarget > 0 ? (h.target / maxHourTarget) * 100 : 0;
              const isPeak = h.target >= maxHourTarget * 0.8;

              return (
                <div key={h.hour} className="flex flex-1 flex-col items-center gap-1">
                  <span
                    className={`text-[10px] font-bold ${isDark ? "text-zinc-500" : "text-zinc-400"}`}
                  >
                    {formatNOK(h.target)}
                  </span>
                  <div
                    className={`w-full rounded-t-md transition-all ${isPeak ? "bg-emerald-600/40" : "bg-blue-600/20"}`}
                    style={{ height: `${Math.max(heightPct * 1.2, 4)}px` }}
                  />
                  <span
                    className={`font-mono text-[10px] ${isDark ? "text-zinc-600" : "text-zinc-400"}`}
                  >
                    {h.hour}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
