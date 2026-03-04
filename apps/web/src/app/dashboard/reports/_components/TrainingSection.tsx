// ============================================
// TrainingSection.tsx
// Training & compliance analytics: protocol compliance,
// completion trends, overdue assignments.
// ============================================

"use client";

import {
  ShieldCheck,
  TrendingUp,
  Users,
  AlertTriangle,
  GraduationCap,
  Clock,
  User,
} from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import {
  PROTOCOL_COMPLIANCE,
  TRAINING_TREND_30D,
  OVERDUE_ASSIGNMENTS,
  CHART_COLORS,
  chartTheme,
} from "./report-data";

export function TrainingSection({ isDark }: { isDark: boolean }) {
  const theme = chartTheme(isDark);

  const totalAssigned = PROTOCOL_COMPLIANCE.reduce((s, p) => s + p.assigned, 0);
  const totalCompleted = PROTOCOL_COMPLIANCE.reduce((s, p) => s + p.completed, 0);
  const avgCompliance = Math.round((totalCompleted / totalAssigned) * 100);

  return (
    <div className="flex flex-col gap-5">
      {/* Summary KPIs */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <MiniKpi
          label="Gj.snitt Compliance"
          value={`${avgCompliance}%`}
          icon={ShieldCheck}
          color={avgCompliance >= 80 ? "emerald" : avgCompliance >= 60 ? "orange" : "red"}
          isDark={isDark}
        />
        <MiniKpi
          label="Totalt tildelt"
          value={`${totalAssigned}`}
          icon={Users}
          color="blue"
          isDark={isDark}
        />
        <MiniKpi
          label="Fullfort"
          value={`${totalCompleted}`}
          icon={GraduationCap}
          color="emerald"
          isDark={isDark}
        />
        <MiniKpi
          label="Forfalt"
          value={`${OVERDUE_ASSIGNMENTS.length}`}
          icon={AlertTriangle}
          color={OVERDUE_ASSIGNMENTS.length > 0 ? "orange" : "emerald"}
          isDark={isDark}
        />
      </div>

      {/* Protocol Compliance — replicates GuardianView pattern */}
      <div className={`rounded-2xl border p-5 ${theme.cardBorder} ${theme.cardBg}`}>
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShieldCheck className={`h-4 w-4 ${isDark ? "text-zinc-400" : "text-zinc-500"}`} />
            <h3 className={`text-sm font-extrabold ${isDark ? "text-zinc-100" : "text-zinc-800"}`}>
              Protokoll Compliance
            </h3>
          </div>
        </div>
        <div className="space-y-3">
          {PROTOCOL_COMPLIANCE.map((protocol) => {
            const barColor =
              protocol.compliance >= 90
                ? "bg-emerald-500"
                : protocol.compliance >= 70
                  ? "bg-orange-500"
                  : "bg-red-500";

            const textColor =
              protocol.compliance >= 90
                ? isDark
                  ? "text-emerald-400"
                  : "text-emerald-600"
                : protocol.compliance >= 70
                  ? isDark
                    ? "text-orange-400"
                    : "text-orange-600"
                  : isDark
                    ? "text-red-400"
                    : "text-red-600";

            return (
              <div key={protocol.name}>
                <div className="mb-1 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span
                      className={`text-xs font-semibold ${isDark ? "text-zinc-200" : "text-zinc-700"}`}
                    >
                      {protocol.name}
                    </span>
                    {protocol.critical && (
                      <span
                        className={`rounded px-1.5 py-0.5 text-[9px] font-bold ${
                          isDark ? "bg-red-500/10 text-red-400" : "bg-red-50 text-red-600"
                        }`}
                      >
                        Kritisk
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`text-[10px] ${isDark ? "text-zinc-500" : "text-zinc-400"}`}>
                      {protocol.completed}/{protocol.assigned}
                    </span>
                    <span className={`text-xs font-bold ${textColor}`}>{protocol.compliance}%</span>
                  </div>
                </div>
                <div
                  className={`h-1.5 w-full overflow-hidden rounded-full ${
                    isDark ? "bg-zinc-800" : "bg-zinc-100"
                  }`}
                >
                  <div
                    className={`h-full rounded-full transition-all duration-1000 ease-out ${barColor}`}
                    style={{ width: `${protocol.compliance}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
        <div
          className={`mt-4 flex items-center gap-4 border-t pt-3 ${
            isDark ? "border-zinc-800" : "border-zinc-100"
          }`}
        >
          <div className="flex items-center gap-1.5">
            <Users className={`h-3 w-3 ${isDark ? "text-zinc-500" : "text-zinc-400"}`} />
            <span
              className={`text-[10px] font-semibold ${isDark ? "text-zinc-500" : "text-zinc-400"}`}
            >
              {totalAssigned} tilordninger totalt
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <TrendingUp className={`h-3 w-3 ${isDark ? "text-emerald-500" : "text-emerald-600"}`} />
            <span
              className={`text-[10px] font-semibold ${isDark ? "text-emerald-400" : "text-emerald-600"}`}
            >
              +12% siste 30 dager
            </span>
          </div>
        </div>
      </div>

      {/* Row 2: Completion Trend + Overdue */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        {/* Completion Trend Chart */}
        <div className={`rounded-2xl border p-5 ${theme.cardBorder} ${theme.cardBg}`}>
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <GraduationCap className={`h-4 w-4 ${isDark ? "text-zinc-400" : "text-zinc-500"}`} />
              <h3
                className={`text-sm font-extrabold ${isDark ? "text-zinc-100" : "text-zinc-800"}`}
              >
                Fullforingstrender
              </h3>
            </div>
            <div className="flex items-center gap-3">
              <LegendDot color={CHART_COLORS.emerald} label="Fullfort" isDark={isDark} />
              <LegendDot color={CHART_COLORS.blue} label="Startet" isDark={isDark} />
              <LegendDot color={CHART_COLORS.rose} label="Utgatt" isDark={isDark} />
            </div>
          </div>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart
              data={TRAINING_TREND_30D}
              margin={{ top: 0, right: 0, bottom: 0, left: -20 }}
              barGap={2}
            >
              <CartesianGrid strokeDasharray="3 3" stroke={theme.grid} vertical={false} />
              <XAxis
                dataKey="date"
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
              />
              <Bar
                dataKey="completed"
                fill={CHART_COLORS.emerald}
                radius={[4, 4, 0, 0]}
                name="Fullfort"
              />
              <Bar
                dataKey="started"
                fill={CHART_COLORS.blue}
                radius={[4, 4, 0, 0]}
                name="Startet"
              />
              <Bar dataKey="expired" fill={CHART_COLORS.rose} radius={[4, 4, 0, 0]} name="Utgatt" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Overdue Assignments */}
        <div className={`rounded-2xl border p-5 ${theme.cardBorder} ${theme.cardBg}`}>
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertTriangle className={`h-4 w-4 ${isDark ? "text-red-400" : "text-red-500"}`} />
              <h3
                className={`text-sm font-extrabold ${isDark ? "text-zinc-100" : "text-zinc-800"}`}
              >
                Forfalte tilordninger
              </h3>
              <span
                className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                  isDark ? "bg-red-500/10 text-red-400" : "bg-red-50 text-red-600"
                }`}
              >
                {OVERDUE_ASSIGNMENTS.length}
              </span>
            </div>
          </div>
          <div className="space-y-2">
            {OVERDUE_ASSIGNMENTS.map((item, i) => (
              <div
                key={i}
                className={`flex items-center justify-between rounded-xl border p-3 ${
                  isDark ? "border-zinc-800 bg-zinc-900/50" : "border-zinc-100 bg-zinc-50/50"
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className={`rounded-lg p-2 ${isDark ? "bg-zinc-800" : "bg-zinc-100"}`}>
                    <User className={`h-3.5 w-3.5 ${isDark ? "text-zinc-400" : "text-zinc-500"}`} />
                  </div>
                  <div>
                    <p
                      className={`text-xs font-bold ${isDark ? "text-zinc-200" : "text-zinc-700"}`}
                    >
                      {item.employee}
                    </p>
                    <p className={`text-[10px] ${isDark ? "text-zinc-500" : "text-zinc-400"}`}>
                      {item.protocol} — {item.department}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-1.5">
                  <Clock className={`h-3 w-3 ${isDark ? "text-red-400" : "text-red-500"}`} />
                  <span
                    className={`text-[10px] font-bold ${isDark ? "text-red-400" : "text-red-600"}`}
                  >
                    {item.daysOverdue}d forfalt
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Helpers ──────────────────────────────────────────────────────────────

function MiniKpi({
  label,
  value,
  icon: Icon,
  color,
  isDark,
}: {
  label: string;
  value: string;
  icon: typeof ShieldCheck;
  color: "emerald" | "blue" | "orange" | "red";
  isDark: boolean;
}) {
  const colorMap = {
    emerald: {
      iconColor: isDark ? "text-emerald-400" : "text-emerald-600",
      bg: isDark ? "bg-emerald-500/10" : "bg-emerald-50",
      border: isDark ? "border-emerald-500/20" : "border-emerald-200",
    },
    blue: {
      iconColor: isDark ? "text-blue-400" : "text-blue-600",
      bg: isDark ? "bg-blue-500/10" : "bg-blue-50",
      border: isDark ? "border-blue-500/20" : "border-blue-200",
    },
    orange: {
      iconColor: isDark ? "text-orange-400" : "text-orange-600",
      bg: isDark ? "bg-orange-500/10" : "bg-orange-50",
      border: isDark ? "border-orange-500/20" : "border-orange-200",
    },
    red: {
      iconColor: isDark ? "text-red-400" : "text-red-600",
      bg: isDark ? "bg-red-500/10" : "bg-red-50",
      border: isDark ? "border-red-500/20" : "border-red-200",
    },
  };

  const c = colorMap[color];

  return (
    <div
      className={`relative overflow-hidden rounded-2xl border p-4 ${c.border} ${
        isDark ? "bg-[#0c0c0e]" : "bg-white"
      }`}
    >
      <div
        className={`pointer-events-none absolute -top-4 -right-4 h-12 w-12 rounded-full blur-2xl ${c.bg}`}
      />
      <div className="relative z-10">
        <div className={`mb-1.5 inline-flex rounded-lg border p-1.5 ${c.border} ${c.bg}`}>
          <Icon className={`h-3.5 w-3.5 ${c.iconColor}`} />
        </div>
        <p className={`text-lg font-black ${isDark ? "text-white" : "text-zinc-900"}`}>{value}</p>
        <p
          className={`text-[10px] font-bold tracking-wider uppercase ${isDark ? "text-zinc-500" : "text-zinc-400"}`}
        >
          {label}
        </p>
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
