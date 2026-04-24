// ============================================
// PeopleSection.tsx
// Employee analytics: role distribution, status,
// tenure, and department headcount.
// ============================================

"use client";

import { Users, Briefcase, Clock, Building2 } from "lucide-react";
import {
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { PIE_COLORS, CHART_COLORS, chartTheme } from "./chart-utils";
import type { ReportInsightCard } from "./report-insight-types";
import { useReportPeople } from "../_hooks/use-report-people";
import { useReportOverview } from "../_hooks/use-report-overview";

type PeopleSectionProps = {
  isDark: boolean;
  onOpenInsight: (insight: ReportInsightCard) => void;
};

export function PeopleSection({ isDark, onOpenInsight }: PeopleSectionProps) {
  const theme = chartTheme(isDark);
  const { data, isLoading } = useReportPeople();
  // Department stats live in the overview hook — reuse the same cached query
  const { data: overviewData } = useReportOverview();

  const roleDistribution = data?.roleDistribution ?? [];
  const statusBreakdown = data?.statusBreakdown ?? [];
  const tenureDistribution = data?.tenureDistribution ?? [];
  const departmentStats = overviewData?.departmentStats ?? [];

  const totalEmployees = roleDistribution.reduce((s, r) => s + r.count, 0);
  const totalByStatus = statusBreakdown.reduce((s, r) => s + r.count, 0);

  if (isLoading) {
    return (
      <div className="flex flex-col gap-5">
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
          {Array.from({ length: 2 }).map((_, i) => (
            <div
              key={i}
              className={`border-border bg-muted h-56 animate-pulse rounded-2xl border`}
            />
          ))}
        </div>
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
          {Array.from({ length: 2 }).map((_, i) => (
            <div
              key={i}
              className={`border-border bg-muted h-48 animate-pulse rounded-2xl border`}
            />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      {/* Row 1: Role Distribution (Donut) + Status Breakdown (Bars) */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        {/* Role Distribution */}
        <div
          onClick={() =>
            onOpenInsight({
              cardId: "people-role-distribution",
              title: "Rollefordeling",
              summary: "Simuler hvordan bemanningsmiks mellom roller påvirker total kapasitet.",
              factors: [
                {
                  id: "juniorShare",
                  label: "Andel juniorroller",
                  value: 28,
                  min: 0,
                  max: 100,
                  step: 1,
                  unit: "%",
                },
                {
                  id: "seniorShare",
                  label: "Andel seniorroller",
                  value: 22,
                  min: 0,
                  max: 100,
                  step: 1,
                  unit: "%",
                },
              ],
            })
          }
          className={`cursor-pointer rounded-2xl border p-5 text-left ${theme.cardBorder} ${theme.cardBg}`}
        >
          <div className="mb-4 flex items-center gap-2">
            <Briefcase className={`text-muted-foreground h-4 w-4`} />
            <h3 className={`text-foreground text-sm font-extrabold`}>Rollefordeling</h3>
          </div>
          <div className="flex items-center gap-6">
            <div className="relative">
              <ResponsiveContainer width={160} height={160}>
                <PieChart>
                  <Pie
                    data={roleDistribution}
                    dataKey="count"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    innerRadius={48}
                    outerRadius={72}
                    paddingAngle={2}
                    strokeWidth={0}
                  >
                    {roleDistribution.map((_, i) => (
                      <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      backgroundColor: theme.tooltipBg,
                      border: `1px solid ${theme.tooltipBorder}`,
                      borderRadius: 10,
                      fontSize: 12,
                      color: theme.tooltipText,
                    }}
                    formatter={(value, name) => {
                      const v = Number(value ?? 0);
                      return [`${v} (${Math.round((v / totalEmployees) * 100)}%)`, String(name)];
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
              {/* Center label */}
              <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                <span className={`text-foreground text-2xl font-black`}>{totalEmployees}</span>
                <span className={`text-muted-foreground text-[9px] font-bold uppercase`}>
                  Totalt
                </span>
              </div>
            </div>
            {/* Legend */}
            <div className="flex-1 space-y-1.5">
              {roleDistribution.map((role, i) => (
                <div key={role.name} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div
                      className="h-2.5 w-2.5 rounded-sm"
                      style={{ backgroundColor: PIE_COLORS[i % PIE_COLORS.length] }}
                    />
                    <span className={`text-muted-foreground text-xs`}>{role.name}</span>
                  </div>
                  <span className={`text-muted-foreground text-xs font-bold`}>{role.count}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Status Breakdown */}
        <div
          onClick={() =>
            onOpenInsight({
              cardId: "people-status-breakdown",
              title: "Medarbeiderstatus",
              summary: "Juster statusmiks for å se effekt på tilgjengelig kapasitet.",
              factors: [
                {
                  id: "activeTarget",
                  label: "Mål andel aktive",
                  value: 80,
                  min: 30,
                  max: 100,
                  step: 1,
                  unit: "%",
                },
                {
                  id: "traineeLimit",
                  label: "Maks trainee-andel",
                  value: 20,
                  min: 0,
                  max: 60,
                  step: 1,
                  unit: "%",
                },
              ],
            })
          }
          className={`cursor-pointer rounded-2xl border p-5 text-left ${theme.cardBorder} ${theme.cardBg}`}
        >
          <div className="mb-4 flex items-center gap-2">
            <Users className={`text-muted-foreground h-4 w-4`} />
            <h3 className={`text-foreground text-sm font-extrabold`}>Medarbeiderstatus</h3>
          </div>
          <div className="space-y-3">
            {statusBreakdown.map((status) => {
              const percent = Math.round((status.count / totalByStatus) * 100);
              return (
                <div key={status.name}>
                  <div className="mb-1 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div
                        className="h-2.5 w-2.5 rounded-full"
                        style={{ backgroundColor: status.color }}
                      />
                      <span className={`text-foreground text-xs font-semibold`}>{status.name}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`text-muted-foreground text-xs font-bold`}>
                        {status.count}
                      </span>
                      <span className={`text-muted-foreground text-[10px]`}>({percent}%)</span>
                    </div>
                  </div>
                  <div className={`bg-muted h-2 w-full overflow-hidden rounded-full`}>
                    <div
                      className="h-full rounded-full transition-all duration-1000 ease-out"
                      style={{
                        width: `${percent}%`,
                        backgroundColor: status.color,
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>

          {/* Summary footer */}
          <div className={`border-border mt-4 flex items-center gap-3 border-t pt-3`}>
            <span className={`text-muted-foreground text-[10px] font-semibold`}>
              {statusBreakdown[0]?.count ?? 0} av {totalByStatus} er aktive (
              {totalByStatus > 0
                ? Math.round(((statusBreakdown[0]?.count ?? 0) / totalByStatus) * 100)
                : 0}
              %)
            </span>
          </div>
        </div>
      </div>

      {/* Row 2: Tenure Distribution + Department Headcount */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        {/* Tenure Distribution */}
        <div
          onClick={() =>
            onOpenInsight({
              cardId: "people-tenure",
              title: "Ansiennitet",
              summary: "Juster vekting for erfaringsnivå i teamet.",
              factors: [
                {
                  id: "newHireRate",
                  label: "Nyansettelsesrate",
                  value: 12,
                  min: 0,
                  max: 50,
                  step: 1,
                  unit: "%",
                },
                {
                  id: "retentionTarget",
                  label: "Retention-mål",
                  value: 85,
                  min: 50,
                  max: 100,
                  step: 1,
                  unit: "%",
                },
              ],
            })
          }
          className={`cursor-pointer rounded-2xl border p-5 text-left ${theme.cardBorder} ${theme.cardBg}`}
        >
          <div className="mb-4 flex items-center gap-2">
            <Clock className={`text-muted-foreground h-4 w-4`} />
            <h3 className={`text-foreground text-sm font-extrabold`}>Ansiennitet</h3>
          </div>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={tenureDistribution} margin={{ top: 0, right: 0, bottom: 0, left: -20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={theme.grid} vertical={false} />
              <XAxis
                dataKey="range"
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
                formatter={(value) => [`${value ?? 0} ansatte`]}
              />
              <Bar dataKey="count" fill={CHART_COLORS.blue} radius={[6, 6, 0, 0]} name="Ansatte" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Department Headcount Table */}
        <div
          onClick={() =>
            onOpenInsight({
              cardId: "people-departments",
              title: "Avdelingsoversikt",
              summary: "Juster avdelingsfaktorer for beredskap og opplæring.",
              factors: [
                {
                  id: "deptReadinessWeight",
                  label: "Beredskapsvekt",
                  value: 1,
                  min: 0.5,
                  max: 2,
                  step: 0.1,
                  unit: "x",
                },
                {
                  id: "deptTrainingWeight",
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
          className={`cursor-pointer rounded-2xl border p-5 text-left ${theme.cardBorder} ${theme.cardBg}`}
        >
          <div className="mb-4 flex items-center gap-2">
            <Building2 className={`text-muted-foreground h-4 w-4`} />
            <h3 className={`text-foreground text-sm font-extrabold`}>Avdelingsoversikt</h3>
          </div>
          <div className="overflow-hidden rounded-lg">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className={"border-border border-b"}>
                  <th className={`text-muted-foreground pb-2 font-bold`}>Avdeling</th>
                  <th className={`text-muted-foreground pb-2 text-right font-bold`}>Ansatte</th>
                  <th className={`text-muted-foreground pb-2 text-right font-bold`}>Beredskap</th>
                  <th className={`text-muted-foreground pb-2 text-right font-bold`}>Opplaering</th>
                </tr>
              </thead>
              <tbody>
                {departmentStats.map((dept) => (
                  <tr key={dept.name} className={`border-border border-b`}>
                    <td className={`text-foreground py-2.5 font-semibold`}>
                      <div className="flex items-center gap-2">
                        <div
                          className="h-2 w-2 rounded-full"
                          style={{ backgroundColor: dept.color }}
                        />
                        {dept.name}
                      </div>
                    </td>
                    <td className={`text-muted-foreground py-2.5 text-right font-bold`}>
                      {dept.employees}
                    </td>
                    <td className="py-2.5 text-right">
                      <StatusBadge value={dept.readiness} isDark={isDark} />
                    </td>
                    <td className="py-2.5 text-right">
                      <StatusBadge value={dept.training} isDark={isDark} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

function StatusBadge({ value, isDark }: { value: number; isDark: boolean }) {
  const color =
    value >= 80
      ? isDark
        ? "text-emerald-400 bg-emerald-500/10"
        : "text-emerald-600 bg-emerald-50"
      : value >= 60
        ? isDark
          ? "text-orange-400 bg-orange-500/10"
          : "text-orange-600 bg-orange-50"
        : isDark
          ? "text-red-400 bg-red-500/10"
          : "text-red-600 bg-red-50";

  return (
    <span className={`inline-block rounded px-1.5 py-0.5 text-[10px] font-bold ${color}`}>
      {value}%
    </span>
  );
}
