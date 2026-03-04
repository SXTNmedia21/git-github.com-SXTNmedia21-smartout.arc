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
import {
  ROLE_DISTRIBUTION,
  STATUS_BREAKDOWN,
  TENURE_DISTRIBUTION,
  DEPARTMENT_STATS,
  PIE_COLORS,
  CHART_COLORS,
  chartTheme,
} from "./report-data";

export function PeopleSection({ isDark }: { isDark: boolean }) {
  const theme = chartTheme(isDark);
  const totalEmployees = ROLE_DISTRIBUTION.reduce((s, r) => s + r.count, 0);
  const totalByStatus = STATUS_BREAKDOWN.reduce((s, r) => s + r.count, 0);

  return (
    <div className="flex flex-col gap-5">
      {/* Row 1: Role Distribution (Donut) + Status Breakdown (Bars) */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        {/* Role Distribution */}
        <div className={`rounded-2xl border p-5 ${theme.cardBorder} ${theme.cardBg}`}>
          <div className="mb-4 flex items-center gap-2">
            <Briefcase className={`h-4 w-4 ${isDark ? "text-zinc-400" : "text-zinc-500"}`} />
            <h3 className={`text-sm font-extrabold ${isDark ? "text-zinc-100" : "text-zinc-800"}`}>
              Rollefordeling
            </h3>
          </div>
          <div className="flex items-center gap-6">
            <div className="relative">
              <ResponsiveContainer width={160} height={160}>
                <PieChart>
                  <Pie
                    data={ROLE_DISTRIBUTION}
                    dataKey="count"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    innerRadius={48}
                    outerRadius={72}
                    paddingAngle={2}
                    strokeWidth={0}
                  >
                    {ROLE_DISTRIBUTION.map((_, i) => (
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
                <span className={`text-2xl font-black ${isDark ? "text-white" : "text-zinc-900"}`}>
                  {totalEmployees}
                </span>
                <span
                  className={`text-[9px] font-bold uppercase ${isDark ? "text-zinc-500" : "text-zinc-400"}`}
                >
                  Totalt
                </span>
              </div>
            </div>
            {/* Legend */}
            <div className="flex-1 space-y-1.5">
              {ROLE_DISTRIBUTION.map((role, i) => (
                <div key={role.name} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div
                      className="h-2.5 w-2.5 rounded-sm"
                      style={{ backgroundColor: PIE_COLORS[i % PIE_COLORS.length] }}
                    />
                    <span className={`text-xs ${isDark ? "text-zinc-300" : "text-zinc-600"}`}>
                      {role.name}
                    </span>
                  </div>
                  <span
                    className={`text-xs font-bold ${isDark ? "text-zinc-400" : "text-zinc-500"}`}
                  >
                    {role.count}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Status Breakdown */}
        <div className={`rounded-2xl border p-5 ${theme.cardBorder} ${theme.cardBg}`}>
          <div className="mb-4 flex items-center gap-2">
            <Users className={`h-4 w-4 ${isDark ? "text-zinc-400" : "text-zinc-500"}`} />
            <h3 className={`text-sm font-extrabold ${isDark ? "text-zinc-100" : "text-zinc-800"}`}>
              Medarbeiderstatus
            </h3>
          </div>
          <div className="space-y-3">
            {STATUS_BREAKDOWN.map((status) => {
              const percent = Math.round((status.count / totalByStatus) * 100);
              return (
                <div key={status.name}>
                  <div className="mb-1 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div
                        className="h-2.5 w-2.5 rounded-full"
                        style={{ backgroundColor: status.color }}
                      />
                      <span
                        className={`text-xs font-semibold ${isDark ? "text-zinc-200" : "text-zinc-700"}`}
                      >
                        {status.name}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span
                        className={`text-xs font-bold ${isDark ? "text-zinc-300" : "text-zinc-600"}`}
                      >
                        {status.count}
                      </span>
                      <span className={`text-[10px] ${isDark ? "text-zinc-500" : "text-zinc-400"}`}>
                        ({percent}%)
                      </span>
                    </div>
                  </div>
                  <div
                    className={`h-2 w-full overflow-hidden rounded-full ${
                      isDark ? "bg-zinc-800" : "bg-zinc-100"
                    }`}
                  >
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
          <div
            className={`mt-4 flex items-center gap-3 border-t pt-3 ${
              isDark ? "border-zinc-800" : "border-zinc-100"
            }`}
          >
            <span
              className={`text-[10px] font-semibold ${isDark ? "text-zinc-500" : "text-zinc-400"}`}
            >
              {STATUS_BREAKDOWN[0]!.count} av {totalByStatus} er aktive (
              {Math.round((STATUS_BREAKDOWN[0]!.count / totalByStatus) * 100)}%)
            </span>
          </div>
        </div>
      </div>

      {/* Row 2: Tenure Distribution + Department Headcount */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        {/* Tenure Distribution */}
        <div className={`rounded-2xl border p-5 ${theme.cardBorder} ${theme.cardBg}`}>
          <div className="mb-4 flex items-center gap-2">
            <Clock className={`h-4 w-4 ${isDark ? "text-zinc-400" : "text-zinc-500"}`} />
            <h3 className={`text-sm font-extrabold ${isDark ? "text-zinc-100" : "text-zinc-800"}`}>
              Ansiennitet
            </h3>
          </div>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart
              data={TENURE_DISTRIBUTION}
              margin={{ top: 0, right: 0, bottom: 0, left: -20 }}
            >
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
        <div className={`rounded-2xl border p-5 ${theme.cardBorder} ${theme.cardBg}`}>
          <div className="mb-4 flex items-center gap-2">
            <Building2 className={`h-4 w-4 ${isDark ? "text-zinc-400" : "text-zinc-500"}`} />
            <h3 className={`text-sm font-extrabold ${isDark ? "text-zinc-100" : "text-zinc-800"}`}>
              Avdelingsoversikt
            </h3>
          </div>
          <div className="overflow-hidden rounded-lg">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className={isDark ? "border-b border-zinc-800" : "border-b border-zinc-100"}>
                  <th className={`pb-2 font-bold ${isDark ? "text-zinc-500" : "text-zinc-400"}`}>
                    Avdeling
                  </th>
                  <th
                    className={`pb-2 text-right font-bold ${isDark ? "text-zinc-500" : "text-zinc-400"}`}
                  >
                    Ansatte
                  </th>
                  <th
                    className={`pb-2 text-right font-bold ${isDark ? "text-zinc-500" : "text-zinc-400"}`}
                  >
                    Beredskap
                  </th>
                  <th
                    className={`pb-2 text-right font-bold ${isDark ? "text-zinc-500" : "text-zinc-400"}`}
                  >
                    Opplaering
                  </th>
                </tr>
              </thead>
              <tbody>
                {DEPARTMENT_STATS.map((dept) => (
                  <tr
                    key={dept.name}
                    className={`${isDark ? "border-b border-zinc-800/50" : "border-b border-zinc-50"}`}
                  >
                    <td
                      className={`py-2.5 font-semibold ${isDark ? "text-zinc-200" : "text-zinc-700"}`}
                    >
                      <div className="flex items-center gap-2">
                        <div
                          className="h-2 w-2 rounded-full"
                          style={{ backgroundColor: dept.color }}
                        />
                        {dept.name}
                      </div>
                    </td>
                    <td
                      className={`py-2.5 text-right font-bold ${isDark ? "text-zinc-300" : "text-zinc-600"}`}
                    >
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
