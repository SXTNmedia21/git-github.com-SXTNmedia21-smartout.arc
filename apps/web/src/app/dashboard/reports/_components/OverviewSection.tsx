// ============================================
// OverviewSection.tsx
// Default tab: KPI strip + 7-day trend chart +
// department comparison + quick insights.
// Follows GuardianView card + glow pattern.
// ============================================

"use client";

import {
  Users,
  ShieldCheck,
  CalendarCheck,
  GraduationCap,
  TrendingUp,
  TrendingDown,
  Lightbulb,
} from "lucide-react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { CHART_COLORS, chartTheme } from "./report-data";
import type { ReportInsightCard } from "./report-insight-types";
import { OverviewDeepInsights } from "./OverviewDeepInsights";
import { useReportOverview } from "../_hooks/use-report-overview";

// ── Color Config ────────────────────────────────────────────────────────

const COLOR_MAP = {
  purple: {
    icon: (d: boolean) => (d ? "text-purple-400" : "text-purple-600"),
    bg: (d: boolean) => (d ? "bg-purple-500/10" : "bg-purple-50"),
    border: (d: boolean) => (d ? "border-purple-500/20" : "border-purple-200"),
  },
  emerald: {
    icon: (d: boolean) => (d ? "text-emerald-400" : "text-emerald-600"),
    bg: (d: boolean) => (d ? "bg-emerald-500/10" : "bg-emerald-50"),
    border: (d: boolean) => (d ? "border-emerald-500/20" : "border-emerald-200"),
  },
  blue: {
    icon: (d: boolean) => (d ? "text-blue-400" : "text-blue-600"),
    bg: (d: boolean) => (d ? "bg-blue-500/10" : "bg-blue-50"),
    border: (d: boolean) => (d ? "border-blue-500/20" : "border-blue-200"),
  },
  orange: {
    icon: (d: boolean) => (d ? "text-orange-400" : "text-orange-600"),
    bg: (d: boolean) => (d ? "bg-orange-500/10" : "bg-orange-50"),
    border: (d: boolean) => (d ? "border-orange-500/20" : "border-orange-200"),
  },
} as const;

const KPI_ICONS = [Users, ShieldCheck, CalendarCheck, GraduationCap];

// ── Main Component ──────────────────────────────────────────────────────

type OverviewSectionProps = {
  isDark: boolean;
  onOpenInsight: (insight: ReportInsightCard) => void;
};

export function OverviewSection({ isDark, onOpenInsight }: OverviewSectionProps) {
  const theme = chartTheme(isDark);
  const { data, isLoading } = useReportOverview();

  // Use real data when available, fall back to empty arrays while loading
  const overviewKpis = data?.kpis ?? [];
  const trend7d = data?.trend7d ?? [];
  const departmentStats = data?.departmentStats ?? [];
  const topInsights = data?.insights ?? [];

  // Loading skeleton — shown only while the first fetch is in flight
  if (isLoading) {
    return (
      <div className="flex flex-col gap-5">
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className={`h-28 animate-pulse rounded-2xl border ${isDark ? "border-zinc-800 bg-zinc-900/50" : "border-zinc-200 bg-zinc-100"}`}
            />
          ))}
        </div>
        <div
          className={`h-64 animate-pulse rounded-2xl border ${isDark ? "border-zinc-800 bg-zinc-900/50" : "border-zinc-200 bg-zinc-100"}`}
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      {/* KPI Strip */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {overviewKpis.map((kpi, i) => {
          const colors = COLOR_MAP[kpi.colorKey];
          const Icon = KPI_ICONS[i]!;
          return (
            <div
              key={kpi.label}
              onClick={() =>
                onOpenInsight({
                  cardId: `overview-kpi-${kpi.label.toLowerCase().replace(/\s+/g, "-")}`,
                  title: `${kpi.label} - Innsikt`,
                  summary: "Juster KPI-drivere for scenarioanalyse av denne metrikken.",
                  factors: [
                    {
                      id: "target",
                      label: "Målnivå",
                      value: 80,
                      min: 40,
                      max: 100,
                      step: 1,
                      unit: "%",
                    },
                    {
                      id: "sensitivity",
                      label: "Sensitivitet",
                      value: 1,
                      min: 0.5,
                      max: 2,
                      step: 0.1,
                      unit: "x",
                    },
                  ],
                })
              }
              className={`relative cursor-pointer overflow-hidden rounded-2xl border p-4 ${colors.border(isDark)} ${
                isDark ? "bg-[#0c0c0e]" : "bg-white"
              }`}
            >
              <div
                className={`pointer-events-none absolute -top-6 -right-6 h-16 w-16 rounded-full blur-2xl ${colors.bg(isDark)}`}
              />
              <div className="relative z-10">
                <div
                  className={`mb-2 inline-flex rounded-lg border p-2 ${colors.border(isDark)} ${colors.bg(isDark)}`}
                >
                  <Icon className={`h-4 w-4 ${colors.icon(isDark)}`} />
                </div>
                <p className={`text-2xl font-black ${isDark ? "text-white" : "text-zinc-900"}`}>
                  {kpi.value}
                </p>
                <p
                  className={`text-[10px] font-bold tracking-wider uppercase ${
                    isDark ? "text-zinc-500" : "text-zinc-400"
                  }`}
                >
                  {kpi.label}
                </p>
                <p
                  className={`mt-1 flex items-center gap-1 text-[10px] font-semibold ${
                    kpi.direction === "up"
                      ? isDark
                        ? "text-emerald-400"
                        : "text-emerald-600"
                      : isDark
                        ? "text-red-400"
                        : "text-red-600"
                  }`}
                >
                  {kpi.direction === "up" ? (
                    <TrendingUp className="h-3 w-3" />
                  ) : (
                    <TrendingDown className="h-3 w-3" />
                  )}
                  {kpi.change}
                </p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Trend Chart + Department Comparison */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-5">
        {/* 7-Day Trend — wider */}
        <div
          onClick={() =>
            onOpenInsight({
              cardId: "overview-trend-7d",
              title: "Ytelse siste 7 dager",
              summary: "Simuler hvordan daglig trend påvirkes av terskler og trendvekting.",
              factors: [
                {
                  id: "trendWeight",
                  label: "Trendvekting",
                  value: 1.2,
                  min: 0.5,
                  max: 2,
                  step: 0.1,
                  unit: "x",
                },
                {
                  id: "alertThreshold",
                  label: "Alarmterskel",
                  value: 70,
                  min: 40,
                  max: 95,
                  step: 1,
                  unit: "%",
                },
              ],
            })
          }
          className={`col-span-1 cursor-pointer rounded-2xl border p-5 lg:col-span-3 ${theme.cardBorder} ${theme.cardBg}`}
        >
          <div className="mb-4 flex items-center justify-between">
            <h3 className={`text-sm font-extrabold ${isDark ? "text-zinc-100" : "text-zinc-800"}`}>
              Ytelse siste 7 dager
            </h3>
            <div className="flex items-center gap-4">
              <LegendDot color={CHART_COLORS.emerald} label="Beredskap" isDark={isDark} />
              <LegendDot color={CHART_COLORS.blue} label="Dekning" isDark={isDark} />
              <LegendDot color={CHART_COLORS.primary} label="Opplaering" isDark={isDark} />
            </div>
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={trend7d} margin={{ top: 5, right: 5, bottom: 0, left: -20 }}>
              <defs>
                <linearGradient id="gradBeredskap" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={CHART_COLORS.emerald} stopOpacity={0.2} />
                  <stop offset="95%" stopColor={CHART_COLORS.emerald} stopOpacity={0} />
                </linearGradient>
                <linearGradient id="gradDekning" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={CHART_COLORS.blue} stopOpacity={0.2} />
                  <stop offset="95%" stopColor={CHART_COLORS.blue} stopOpacity={0} />
                </linearGradient>
                <linearGradient id="gradOpplaering" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={CHART_COLORS.primary} stopOpacity={0.2} />
                  <stop offset="95%" stopColor={CHART_COLORS.primary} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke={theme.grid} vertical={false} />
              <XAxis
                dataKey="day"
                tick={{ fontSize: 11, fill: theme.axis }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                domain={[30, 100]}
                tick={{ fontSize: 11, fill: theme.axis }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(v: number) => `${v}%`}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: theme.tooltipBg,
                  border: `1px solid ${theme.tooltipBorder}`,
                  borderRadius: 10,
                  fontSize: 12,
                  color: theme.tooltipText,
                }}
                formatter={(value) => [`${value ?? 0}%`]}
              />
              <Area
                type="monotone"
                dataKey="beredskap"
                stroke={CHART_COLORS.emerald}
                fill="url(#gradBeredskap)"
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4, strokeWidth: 0 }}
                name="Beredskap"
              />
              <Area
                type="monotone"
                dataKey="dekning"
                stroke={CHART_COLORS.blue}
                fill="url(#gradDekning)"
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4, strokeWidth: 0 }}
                name="Dekning"
              />
              <Area
                type="monotone"
                dataKey="opplaering"
                stroke={CHART_COLORS.primary}
                fill="url(#gradOpplaering)"
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4, strokeWidth: 0 }}
                name="Opplaering"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Department Comparison — narrower */}
        <div
          onClick={() =>
            onOpenInsight({
              cardId: "overview-departments",
              title: "Avdelinger",
              summary: "Juster faktorene bak dekning, beredskap og opplæring per avdeling.",
              factors: [
                {
                  id: "coverageTarget",
                  label: "Dekningsmål",
                  value: 90,
                  min: 60,
                  max: 100,
                  step: 1,
                  unit: "%",
                },
                {
                  id: "trainingWeight",
                  label: "Opplæringsvekt",
                  value: 1,
                  min: 0.5,
                  max: 2,
                  step: 0.1,
                  unit: "x",
                },
              ],
            })
          }
          className={`col-span-1 cursor-pointer rounded-2xl border p-5 lg:col-span-2 ${theme.cardBorder} ${theme.cardBg}`}
        >
          <h3
            className={`mb-4 text-sm font-extrabold ${isDark ? "text-zinc-100" : "text-zinc-800"}`}
          >
            Avdelinger
          </h3>
          <div className="space-y-4">
            {departmentStats.map((dept) => (
              <div key={dept.name}>
                <div className="mb-1.5 flex items-center justify-between">
                  <span
                    className={`text-xs font-bold ${isDark ? "text-zinc-200" : "text-zinc-700"}`}
                  >
                    {dept.name}
                  </span>
                  <span
                    className={`text-[10px] font-semibold ${isDark ? "text-zinc-500" : "text-zinc-400"}`}
                  >
                    {dept.employees} ansatte
                  </span>
                </div>
                {/* Coverage bar */}
                <div className="mb-1 flex items-center gap-2">
                  <div
                    className={`h-2 flex-1 overflow-hidden rounded-full ${
                      isDark ? "bg-zinc-800" : "bg-zinc-100"
                    }`}
                  >
                    <div
                      className="h-full rounded-full transition-all duration-1000 ease-out"
                      style={{
                        width: `${dept.coverage}%`,
                        backgroundColor: dept.color,
                      }}
                    />
                  </div>
                  <span
                    className={`w-8 text-right text-[10px] font-bold ${
                      isDark ? "text-zinc-400" : "text-zinc-500"
                    }`}
                  >
                    {dept.coverage}%
                  </span>
                </div>
                {/* Readiness + Training mini bars */}
                <div className="flex gap-3">
                  <MiniStat label="Klar" value={dept.readiness} isDark={isDark} />
                  <MiniStat label="Oppl." value={dept.training} isDark={isDark} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Quick Insights Strip */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {topInsights.map((insight) => (
          <div
            key={insight.label}
            onClick={() =>
              onOpenInsight({
                cardId: `overview-insight-${insight.label.toLowerCase().replace(/\s+/g, "-")}`,
                title: insight.label,
                summary: insight.detail,
                factors: [
                  {
                    id: "priorityWeight",
                    label: "Prioritetsvekt",
                    value: 1,
                    min: 0.5,
                    max: 2,
                    step: 0.1,
                    unit: "x",
                  },
                  {
                    id: "impactScore",
                    label: "Påvirkningsscore",
                    value: 65,
                    min: 0,
                    max: 100,
                    step: 1,
                    unit: "%",
                  },
                ],
              })
            }
            className={`flex cursor-pointer items-start gap-3 rounded-2xl border p-4 ${theme.cardBorder} ${theme.cardBg}`}
          >
            <div
              className={`mt-0.5 rounded-lg border p-1.5 ${
                isDark ? "border-amber-500/20 bg-amber-500/10" : "border-amber-200 bg-amber-50"
              }`}
            >
              <Lightbulb
                className={`h-3.5 w-3.5 ${isDark ? "text-amber-400" : "text-amber-600"}`}
              />
            </div>
            <div className="min-w-0">
              <p
                className={`text-[10px] font-bold tracking-wider uppercase ${
                  isDark ? "text-zinc-500" : "text-zinc-400"
                }`}
              >
                {insight.label}
              </p>
              <p className={`text-sm font-bold ${isDark ? "text-zinc-100" : "text-zinc-800"}`}>
                {insight.value}
              </p>
              <p className={`text-[10px] ${isDark ? "text-zinc-500" : "text-zinc-400"}`}>
                {insight.detail}
              </p>
            </div>
          </div>
        ))}
      </div>

      <OverviewDeepInsights isDark={isDark} onOpenInsight={onOpenInsight} />
    </div>
  );
}

// ── Tiny Helpers ─────────────────────────────────────────────────────────

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

function MiniStat({ label, value, isDark }: { label: string; value: number; isDark: boolean }) {
  const color = value >= 80 ? "bg-emerald-500" : value >= 60 ? "bg-orange-500" : "bg-red-500";

  return (
    <div className="flex flex-1 items-center gap-1.5">
      <span className={`text-[9px] font-semibold ${isDark ? "text-zinc-600" : "text-zinc-400"}`}>
        {label}
      </span>
      <div
        className={`h-1 flex-1 overflow-hidden rounded-full ${
          isDark ? "bg-zinc-800" : "bg-zinc-100"
        }`}
      >
        <div className={`h-full rounded-full ${color}`} style={{ width: `${value}%` }} />
      </div>
      <span className={`text-[9px] font-bold ${isDark ? "text-zinc-500" : "text-zinc-400"}`}>
        {value}%
      </span>
    </div>
  );
}
