// ============================================
// StaffingSection.tsx
// Schedule & staffing analytics: weekly coverage,
// shift distribution, labor hours, unfilled shifts.
// ============================================

"use client";

import { CalendarCheck, Clock, AlertTriangle, BarChart3 } from "lucide-react";
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";
import {
  WEEKLY_COVERAGE,
  SHIFT_TYPES,
  LABOR_HOURS_4W,
  UNFILLED_SHIFTS,
  CHART_COLORS,
  chartTheme,
} from "./report-data";
import type { ReportInsightCard } from "./report-insight-types";

type StaffingSectionProps = {
  isDark: boolean;
  onOpenInsight: (insight: ReportInsightCard) => void;
};

export function StaffingSection({ isDark, onOpenInsight }: StaffingSectionProps) {
  const theme = chartTheme(isDark);

  return (
    <div className="flex flex-col gap-5">
      {/* Weekly Coverage Chart */}
      <div
        onClick={() =>
          onOpenInsight({
            cardId: "staffing-weekly-coverage",
            title: "Vaktdekning denne uken",
            summary: "Juster behovsfaktor og dekningsmål for å simulere ukesbehov.",
            factors: [
              {
                id: "demandFactor",
                label: "Behovsfaktor",
                value: 1,
                min: 0.5,
                max: 2,
                step: 0.1,
                unit: "x",
              },
              {
                id: "coverageTarget",
                label: "Dekningsmål",
                value: 92,
                min: 60,
                max: 100,
                step: 1,
                unit: "%",
              },
            ],
          })
        }
        className={`cursor-pointer rounded-2xl border p-5 text-left ${theme.cardBorder} ${theme.cardBg}`}
      >
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CalendarCheck className={`h-4 w-4 ${isDark ? "text-zinc-400" : "text-zinc-500"}`} />
            <h3 className={`text-sm font-extrabold ${isDark ? "text-zinc-100" : "text-zinc-800"}`}>
              Vaktdekning denne uken
            </h3>
          </div>
          <div className="flex items-center gap-4">
            <LegendDot color={CHART_COLORS.blue} label="Tildelt" isDark={isDark} />
            <LegendDot color={isDark ? "#3f3f46" : "#e4e4e7"} label="Behov" isDark={isDark} />
          </div>
        </div>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart
            data={WEEKLY_COVERAGE}
            margin={{ top: 5, right: 5, bottom: 0, left: -20 }}
            barGap={4}
          >
            <CartesianGrid strokeDasharray="3 3" stroke={theme.grid} vertical={false} />
            <XAxis
              dataKey="day"
              tick={{ fontSize: 11, fill: theme.axis }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis tick={{ fontSize: 11, fill: theme.axis }} axisLine={false} tickLine={false} />
            <Tooltip
              contentStyle={{
                backgroundColor: theme.tooltipBg,
                border: `1px solid ${theme.tooltipBorder}`,
                borderRadius: 10,
                fontSize: 12,
                color: theme.tooltipText,
              }}
              formatter={(value, name) => [
                `${value ?? 0} vakter`,
                name === "needed" ? "Behov" : "Tildelt",
              ]}
            />
            <Bar
              dataKey="needed"
              fill={isDark ? "#3f3f46" : "#e4e4e7"}
              radius={[6, 6, 0, 0]}
              name="needed"
            />
            <Bar
              dataKey="assigned"
              fill={CHART_COLORS.blue}
              radius={[6, 6, 0, 0]}
              name="assigned"
            />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Row 2: Shift Types + Labor Hours */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        {/* Shift Type Distribution */}
        <div
          onClick={() =>
            onOpenInsight({
              cardId: "staffing-shift-distribution",
              title: "Vaktfordeling",
              summary: "Finjuster vekting mellom vakttyper for bedre balanse i turnus.",
              factors: [
                {
                  id: "eveningWeight",
                  label: "Kveldsvekt",
                  value: 1.2,
                  min: 0.5,
                  max: 2,
                  step: 0.1,
                  unit: "x",
                },
                {
                  id: "splitShiftLimit",
                  label: "Maks deltevakter",
                  value: 12,
                  min: 0,
                  max: 40,
                  step: 1,
                },
              ],
            })
          }
          className={`cursor-pointer rounded-2xl border p-5 text-left ${theme.cardBorder} ${theme.cardBg}`}
        >
          <div className="mb-4 flex items-center gap-2">
            <Clock className={`h-4 w-4 ${isDark ? "text-zinc-400" : "text-zinc-500"}`} />
            <h3 className={`text-sm font-extrabold ${isDark ? "text-zinc-100" : "text-zinc-800"}`}>
              Vaktfordeling
            </h3>
          </div>
          <div className="space-y-3">
            {SHIFT_TYPES.map((shift) => {
              const maxCount = Math.max(...SHIFT_TYPES.map((s) => s.count));
              const width = (shift.count / maxCount) * 100;
              return (
                <div key={shift.type}>
                  <div className="mb-1 flex items-center justify-between">
                    <span
                      className={`text-xs font-semibold ${isDark ? "text-zinc-200" : "text-zinc-700"}`}
                    >
                      {shift.type}
                    </span>
                    <span
                      className={`text-xs font-bold ${isDark ? "text-zinc-400" : "text-zinc-500"}`}
                    >
                      {shift.count} vakter
                    </span>
                  </div>
                  <div
                    className={`h-2.5 w-full overflow-hidden rounded-full ${
                      isDark ? "bg-zinc-800" : "bg-zinc-100"
                    }`}
                  >
                    <div
                      className="h-full rounded-full transition-all duration-1000 ease-out"
                      style={{ width: `${width}%`, backgroundColor: shift.color }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
          {/* Summary */}
          <div className={`mt-4 border-t pt-3 ${isDark ? "border-zinc-800" : "border-zinc-100"}`}>
            <span
              className={`text-[10px] font-semibold ${isDark ? "text-zinc-500" : "text-zinc-400"}`}
            >
              Totalt: {SHIFT_TYPES.reduce((s, t) => s + t.count, 0)} vakter denne uken
            </span>
          </div>
        </div>

        {/* Labor Hours Trend */}
        <div
          onClick={() =>
            onOpenInsight({
              cardId: "staffing-labor-hours",
              title: "Arbeidstimer (4 uker)",
              summary: "Juster timeramme og budsjettlinje for plan/faktisk sammenligning.",
              factors: [
                {
                  id: "plannedHoursCap",
                  label: "Planlagte timer (tak)",
                  value: 640,
                  min: 450,
                  max: 900,
                  step: 5,
                  unit: "t",
                },
                {
                  id: "budgetHours",
                  label: "Budsjettert timer",
                  value: 600,
                  min: 450,
                  max: 900,
                  step: 5,
                  unit: "t",
                },
              ],
            })
          }
          className={`cursor-pointer rounded-2xl border p-5 text-left ${theme.cardBorder} ${theme.cardBg}`}
        >
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <BarChart3 className={`h-4 w-4 ${isDark ? "text-zinc-400" : "text-zinc-500"}`} />
              <h3
                className={`text-sm font-extrabold ${isDark ? "text-zinc-100" : "text-zinc-800"}`}
              >
                Arbeidstimer (4 uker)
              </h3>
            </div>
            <div className="flex items-center gap-3">
              <LegendDot color={CHART_COLORS.emerald} label="Faktisk" isDark={isDark} />
              <LegendDot color={CHART_COLORS.blue} label="Planlagt" isDark={isDark} />
            </div>
          </div>
          <ResponsiveContainer width="100%" height={180}>
            <LineChart data={LABOR_HOURS_4W} margin={{ top: 5, right: 5, bottom: 0, left: -20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={theme.grid} vertical={false} />
              <XAxis
                dataKey="week"
                tick={{ fontSize: 10, fill: theme.axis }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis tick={{ fontSize: 10, fill: theme.axis }} axisLine={false} tickLine={false} />
              <Tooltip
                contentStyle={{
                  backgroundColor: theme.tooltipBg,
                  border: `1px solid ${theme.tooltipBorder}`,
                  borderRadius: 10,
                  fontSize: 12,
                  color: theme.tooltipText,
                }}
                formatter={(value, name) => {
                  const labels: Record<string, string> = {
                    actual: "Faktisk",
                    planned: "Planlagt",
                    budget: "Budsjett",
                  };
                  return [`${value ?? 0}t`, labels[String(name)] ?? String(name)];
                }}
              />
              <ReferenceLine
                y={600}
                stroke={CHART_COLORS.amber}
                strokeDasharray="4 4"
                strokeWidth={1.5}
                label={{
                  value: "Budsjett",
                  position: "insideTopRight",
                  fill: theme.axis,
                  fontSize: 10,
                }}
              />
              <Line
                type="monotone"
                dataKey="planned"
                stroke={CHART_COLORS.blue}
                strokeWidth={2}
                dot={{ r: 3, fill: CHART_COLORS.blue, strokeWidth: 0 }}
                name="planned"
              />
              <Line
                type="monotone"
                dataKey="actual"
                stroke={CHART_COLORS.emerald}
                strokeWidth={2}
                dot={{ r: 3, fill: CHART_COLORS.emerald, strokeWidth: 0 }}
                name="actual"
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Unfilled Shifts */}
      <div
        onClick={() =>
          onOpenInsight({
            cardId: "staffing-unfilled-shifts",
            title: "Udekte vakter",
            summary: "Juster terskler for når vakter markeres som kritiske.",
            factors: [
              {
                id: "criticalUnfilledThreshold",
                label: "Kritisk terskel",
                value: 2,
                min: 1,
                max: 6,
                step: 1,
                unit: "vakter",
              },
              {
                id: "escalationHours",
                label: "Eskaleringstid",
                value: 24,
                min: 1,
                max: 72,
                step: 1,
                unit: "timer",
              },
            ],
          })
        }
        className={`cursor-pointer rounded-2xl border p-5 text-left ${theme.cardBorder} ${theme.cardBg}`}
      >
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle
              className={`h-4 w-4 ${isDark ? "text-orange-400" : "text-orange-500"}`}
            />
            <h3 className={`text-sm font-extrabold ${isDark ? "text-zinc-100" : "text-zinc-800"}`}>
              Udekte vakter
            </h3>
            <span
              className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                isDark ? "bg-orange-500/10 text-orange-400" : "bg-orange-50 text-orange-600"
              }`}
            >
              {UNFILLED_SHIFTS.length}
            </span>
          </div>
        </div>
        {UNFILLED_SHIFTS.length === 0 ? (
          <p className={`text-sm ${isDark ? "text-zinc-500" : "text-zinc-400"}`}>
            Alle vakter er dekket!
          </p>
        ) : (
          <div className="space-y-2">
            {UNFILLED_SHIFTS.map((shift, i) => (
              <div
                key={i}
                className={`flex items-center justify-between rounded-xl border p-3 ${
                  isDark ? "border-zinc-800 bg-zinc-900/50" : "border-zinc-100 bg-zinc-50/50"
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className={`rounded-lg p-2 ${isDark ? "bg-orange-500/10" : "bg-orange-50"}`}>
                    <CalendarCheck
                      className={`h-3.5 w-3.5 ${isDark ? "text-orange-400" : "text-orange-600"}`}
                    />
                  </div>
                  <div>
                    <p
                      className={`text-xs font-bold ${isDark ? "text-zinc-200" : "text-zinc-700"}`}
                    >
                      {shift.date} — {shift.shift}
                    </p>
                    <p className={`text-[10px] ${isDark ? "text-zinc-500" : "text-zinc-400"}`}>
                      {shift.department}
                    </p>
                  </div>
                </div>
                <span
                  className={`rounded px-2 py-0.5 text-[10px] font-bold ${
                    isDark ? "bg-red-500/10 text-red-400" : "bg-red-50 text-red-600"
                  }`}
                >
                  {shift.needed} mangler
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function LegendDot({ color, label, isDark }: { color: string; label: string; isDark: boolean }) {
  return (
    <div className="flex items-center gap-1.5">
      <div className="h-2 w-2 rounded-full" style={{ backgroundColor: color }} />
      <span className={`text-[10px] font-semibold ${isDark ? "text-zinc-500" : "text-zinc-400"}`}>
        {label}
      </span>
    </div>
  );
}
