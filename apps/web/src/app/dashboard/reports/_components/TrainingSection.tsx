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
import { CHART_COLORS, chartTheme } from "./chart-utils";
import type { ReportInsightCard } from "./report-insight-types";
import { useReportTraining } from "../_hooks/use-report-training";

type TrainingSectionProps = {
  isDark: boolean;
  onOpenInsight: (insight: ReportInsightCard) => void;
};

export function TrainingSection({ isDark, onOpenInsight }: TrainingSectionProps) {
  const theme = chartTheme(isDark);
  const { data, isLoading } = useReportTraining();

  const protocolCompliance = data?.protocolCompliance ?? [];
  const trainingTrend30d = data?.trainingTrend30d ?? [];
  const overdueAssignments = data?.overdueAssignments ?? [];

  const totalAssigned = protocolCompliance.reduce((s, p) => s + p.assigned, 0);
  const totalCompleted = protocolCompliance.reduce((s, p) => s + p.completed, 0);
  const avgCompliance = totalAssigned > 0 ? Math.round((totalCompleted / totalAssigned) * 100) : 0;

  if (isLoading) {
    return (
      <div className="flex flex-col gap-5">
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className={`border-border bg-muted h-24 animate-pulse rounded-2xl border`}
            />
          ))}
        </div>
        <div className={`border-border bg-muted h-56 animate-pulse rounded-2xl border`} />
      </div>
    );
  }

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
          onClick={() =>
            onOpenInsight({
              cardId: "training-avg-compliance",
              title: "Gj.snitt Compliance",
              summary: "Juster terskler for compliance-vurdering og kritikalitet.",
              factors: [
                {
                  id: "complianceTarget",
                  label: "Compliance-mål",
                  value: 85,
                  min: 40,
                  max: 100,
                  step: 1,
                  unit: "%",
                },
                {
                  id: "criticalWeight",
                  label: "Kritisk vekt",
                  value: 1.5,
                  min: 0.5,
                  max: 3,
                  step: 0.1,
                  unit: "x",
                },
              ],
            })
          }
        />
        <MiniKpi
          label="Totalt tildelt"
          value={`${totalAssigned}`}
          icon={Users}
          color="blue"
          isDark={isDark}
          onClick={() =>
            onOpenInsight({
              cardId: "training-total-assigned",
              title: "Totalt tildelt",
              summary: "Finjuster antall tildelinger og kapasitetsgrenser.",
              factors: [
                {
                  id: "assignmentCap",
                  label: "Maks aktive tildelinger",
                  value: 120,
                  min: 20,
                  max: 300,
                  step: 5,
                },
                {
                  id: "newAssignmentRate",
                  label: "Ny tildelingsrate",
                  value: 10,
                  min: 0,
                  max: 50,
                  step: 1,
                  unit: "%",
                },
              ],
            })
          }
        />
        <MiniKpi
          label="Fullfort"
          value={`${totalCompleted}`}
          icon={GraduationCap}
          color="emerald"
          isDark={isDark}
          onClick={() =>
            onOpenInsight({
              cardId: "training-completed",
              title: "Fullfort",
              summary: "Juster forventet fullføringsgrad og oppfølgingsintensitet.",
              factors: [
                {
                  id: "completionTarget",
                  label: "Fullføringsmål",
                  value: 90,
                  min: 40,
                  max: 100,
                  step: 1,
                  unit: "%",
                },
                {
                  id: "followupFrequency",
                  label: "Oppfølging",
                  value: 2,
                  min: 1,
                  max: 7,
                  step: 1,
                  unit: "ganger/uke",
                },
              ],
            })
          }
        />
        <MiniKpi
          label="Forfalt"
          value={`${overdueAssignments.length}`}
          icon={AlertTriangle}
          color={overdueAssignments.length > 0 ? "orange" : "emerald"}
          isDark={isDark}
          onClick={() =>
            onOpenInsight({
              cardId: "training-overdue",
              title: "Forfalt",
              summary: "Juster regler for forfall og eskalering av opplæringskrav.",
              factors: [
                {
                  id: "overdueDays",
                  label: "Forfallsgrense",
                  value: 7,
                  min: 1,
                  max: 30,
                  step: 1,
                  unit: "dager",
                },
                {
                  id: "escalationDays",
                  label: "Eskalering etter",
                  value: 3,
                  min: 1,
                  max: 14,
                  step: 1,
                  unit: "dager",
                },
              ],
            })
          }
        />
      </div>

      {/* Protocol Compliance — replicates TodoGroupSection pattern */}
      <div
        onClick={() =>
          onOpenInsight({
            cardId: "training-protocol-compliance",
            title: "Protokoll Compliance",
            summary: "Juster terskler per protokoll for varsel og prioritering.",
            factors: [
              {
                id: "criticalProtocolThreshold",
                label: "Kritisk terskel",
                value: 70,
                min: 30,
                max: 100,
                step: 1,
                unit: "%",
              },
              {
                id: "protocolWeight",
                label: "Protokollvekt",
                value: 1.2,
                min: 0.5,
                max: 2.5,
                step: 0.1,
                unit: "x",
              },
            ],
          })
        }
        className={`cursor-pointer rounded-2xl border p-5 ${theme.cardBorder} ${theme.cardBg}`}
      >
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShieldCheck className={`text-muted-foreground h-4 w-4`} />
            <h3 className={`text-foreground text-sm font-extrabold`}>Protokoll Compliance</h3>
          </div>
        </div>
        <div className="space-y-3">
          {protocolCompliance.map((protocol) => {
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
                    <span className={`text-foreground text-xs font-semibold`}>{protocol.name}</span>
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
                    <span className={`text-muted-foreground text-[10px]`}>
                      {protocol.completed}/{protocol.assigned}
                    </span>
                    <span className={`text-xs font-bold ${textColor}`}>{protocol.compliance}%</span>
                  </div>
                </div>
                <div className={`bg-muted h-1.5 w-full overflow-hidden rounded-full`}>
                  <div
                    className={`h-full rounded-full transition-all duration-1000 ease-out ${barColor}`}
                    style={{ width: `${protocol.compliance}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
        <div className={`border-border mt-4 flex items-center gap-4 border-t pt-3`}>
          <div className="flex items-center gap-1.5">
            <Users className={`text-muted-foreground h-3 w-3`} />
            <span className={`text-muted-foreground text-[10px] font-semibold`}>
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
        <div
          onClick={() =>
            onOpenInsight({
              cardId: "training-completion-trend",
              title: "Fullforingstrender",
              summary: "Juster trendfaktorer for startet/fullført/utgått.",
              factors: [
                {
                  id: "completionGrowth",
                  label: "Forventet vekst",
                  value: 8,
                  min: -20,
                  max: 40,
                  step: 1,
                  unit: "%",
                },
                {
                  id: "expiredTolerance",
                  label: "Toleranse utgått",
                  value: 5,
                  min: 0,
                  max: 30,
                  step: 1,
                  unit: "%",
                },
              ],
            })
          }
          className={`cursor-pointer rounded-2xl border p-5 ${theme.cardBorder} ${theme.cardBg}`}
        >
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <GraduationCap className={`text-muted-foreground h-4 w-4`} />
              <h3 className={`text-foreground text-sm font-extrabold`}>Fullforingstrender</h3>
            </div>
            <div className="flex items-center gap-3">
              <LegendDot color={CHART_COLORS.emerald} label="Fullfort" isDark={isDark} />
              <LegendDot color={CHART_COLORS.blue} label="Startet" isDark={isDark} />
              <LegendDot color={CHART_COLORS.rose} label="Utgatt" isDark={isDark} />
            </div>
          </div>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart
              data={trainingTrend30d}
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
        <div
          onClick={() =>
            onOpenInsight({
              cardId: "training-overdue-list",
              title: "Forfalte tilordninger",
              summary: "Juster når oppgaver anses forfalte og hvordan de prioriteres.",
              factors: [
                {
                  id: "riskWeight",
                  label: "Risikovekt",
                  value: 1.3,
                  min: 0.5,
                  max: 3,
                  step: 0.1,
                  unit: "x",
                },
                {
                  id: "dailyEscalations",
                  label: "Daglige eskaleringer",
                  value: 2,
                  min: 0,
                  max: 10,
                  step: 1,
                },
              ],
            })
          }
          className={`cursor-pointer rounded-2xl border p-5 ${theme.cardBorder} ${theme.cardBg}`}
        >
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertTriangle className={`h-4 w-4 ${isDark ? "text-red-400" : "text-red-500"}`} />
              <h3 className={`text-foreground text-sm font-extrabold`}>Forfalte tilordninger</h3>
              <span
                className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                  isDark ? "bg-red-500/10 text-red-400" : "bg-red-50 text-red-600"
                }`}
              >
                {overdueAssignments.length}
              </span>
            </div>
          </div>
          <div className="space-y-2">
            {overdueAssignments.map((item, i) => (
              <div
                key={i}
                className={`border-border bg-muted flex items-center justify-between rounded-xl border p-3`}
              >
                <div className="flex items-center gap-3">
                  <div className={`bg-muted rounded-lg p-2`}>
                    <User className={`text-muted-foreground h-3.5 w-3.5`} />
                  </div>
                  <div>
                    <p className={`text-foreground text-xs font-bold`}>{item.employee}</p>
                    <p className={`text-muted-foreground text-[10px]`}>
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
  onClick,
}: {
  label: string;
  value: string;
  icon: typeof ShieldCheck;
  color: "emerald" | "blue" | "orange" | "red";
  isDark: boolean;
  onClick: () => void;
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
      onClick={onClick}
      className={`bg-card relative cursor-pointer overflow-hidden rounded-2xl border p-4 ${c.border}`}
    >
      <div
        className={`pointer-events-none absolute -top-4 -right-4 h-12 w-12 rounded-full blur-2xl ${c.bg}`}
      />
      <div className="relative z-10">
        <div className={`mb-1.5 inline-flex rounded-lg border p-1.5 ${c.border} ${c.bg}`}>
          <Icon className={`h-3.5 w-3.5 ${c.iconColor}`} />
        </div>
        <p className={`text-foreground text-lg font-black`}>{value}</p>
        <p className={`text-muted-foreground text-[10px] font-bold tracking-wider uppercase`}>
          {label}
        </p>
      </div>
    </div>
  );
}

function LegendDot({
  color,
  label,
  isDark: _isDark,
}: {
  color: string;
  label: string;
  isDark: boolean;
}) {
  return (
    <div className="flex items-center gap-1.5">
      <div className="h-2 w-2 rounded-full" style={{ backgroundColor: color }} />
      <span className={`text-muted-foreground text-[10px] font-semibold`}>{label}</span>
    </div>
  );
}
