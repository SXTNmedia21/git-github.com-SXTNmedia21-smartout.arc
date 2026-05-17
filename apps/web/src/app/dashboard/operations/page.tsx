"use client";

// Operations dashboard — live KPI cards for today's department sessions.
// Displays task completion, stress level, HACCP temperature status, cleaning
// checklist progress, deviation severity breakdown, and revenue vs labor cost.
// Auto-refetches every 60s. All labels are i18n, all colors use CSS variables.

import { useContext, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AnimatePresence } from "framer-motion";
import { DashboardContext } from "@/components/dashboard/DashboardShell";
import {
  Percent,
  Gauge,
  Clock,
  Users,
  Activity,
  AlertCircle,
  Loader2,
  Thermometer,
  ClipboardCheck,
} from "lucide-react";
import { createClient } from "@smartout/supabase/client";
import { useTranslation } from "@smartout/i18n";
import { useOperationsData } from "./_hooks/use-operations-data";
import type { StressLabel } from "./_hooks/use-operations-data";
import { DeviationDialog } from "./_components/DeviationDialog";
import { DepartmentBreakdown } from "./_components/DepartmentBreakdown";
import { OperationsToolsBridge } from "./_tools/operations-tools-bridge";
import { formatDistanceToNow } from "date-fns";
import { nb, enUS } from "date-fns/locale";

// ─── Stress-level color maps (CSS variables, no isDark branching) ─────────

function stressColors(label: StressLabel) {
  if (label === "low") {
    return {
      color: "text-success",
      bg: "bg-success/10",
      border: "border-success/20",
      pulse: false,
    };
  }
  if (label === "medium") {
    return {
      color: "text-warning",
      bg: "bg-warning/10",
      border: "border-warning/20",
      pulse: false,
    };
  }
  return {
    color: "text-destructive",
    bg: "bg-destructive/10",
    border: "border-destructive/20",
    pulse: true,
  };
}

function completionColors(pct: number) {
  if (pct >= 75) {
    return {
      color: "text-success",
      bg: "bg-success/10",
      border: "border-success/20",
    };
  }
  if (pct >= 50) {
    return {
      color: "text-warning",
      bg: "bg-warning/10",
      border: "border-warning/20",
    };
  }
  return {
    color: "text-destructive",
    bg: "bg-destructive/10",
    border: "border-destructive/20",
  };
}

// ─── i18n key for stress label ────────────────────────────────────────────

const stressLabelKey: Record<StressLabel, string> = {
  low: "operations.stressLow",
  medium: "operations.stressMedium",
  high: "operations.stressHigh",
};

// ─── Page ──────────────────────────────────────────────────────────────────

export default function OperationsPage() {
  const { workspaceData, profileId } = useContext(DashboardContext);
  const { data, isLoading, isError } = useOperationsData();
  const { t, locale } = useTranslation("operations");
  const dateFnsLocale = locale === "nb" ? nb : enUS;

  const [showDeptBreakdown, setShowDeptBreakdown] = useState(false);

  const { data: departments } = useQuery({
    queryKey: ["departments", workspaceData?.workspace_id],
    enabled: !!workspaceData?.workspace_id,
    staleTime: 10 * 60 * 1000,
    queryFn: async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("department")
        .select("department_id, name")
        .eq("workspace_id", workspaceData!.workspace_id)
        .eq("is_active", true)
        .order("name");
      if (error) throw error;
      return (data ?? []).map((d) => ({ id: d.department_id, name: d.name }));
    },
  });

  return (
    <div className="z-10 flex-1 overflow-y-auto px-10 pt-8 pb-20">
      <OperationsToolsBridge data={data} showDeptBreakdown={showDeptBreakdown} deptMetrics={[]} />
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="font-heading text-foreground mb-2 flex items-center gap-3 text-3xl font-extrabold tracking-tight">
            {t("operations.title")}
            <span className="border-warning/20 bg-warning/10 text-warning rounded border px-2 py-1 text-xs font-bold tracking-wider uppercase">
              {t("operations.live")}
            </span>
          </h1>
          <p className="text-muted-foreground text-sm">{t("operations.subtitle")}</p>
        </div>
        {workspaceData?.workspace_id && profileId && (
          <DeviationDialog
            workspaceId={workspaceData.workspace_id}
            profileId={profileId}
            departments={departments ?? []}
          />
        )}
      </div>

      {/* ── Loading state ─────────────────────────────────────────────── */}
      {isLoading && (
        <div className="mb-8 grid grid-cols-2 gap-4 sm:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div
              key={i}
              className="border-border bg-card flex flex-col justify-between rounded-2xl border p-4 shadow-sm"
            >
              <div className="mb-3 flex items-start justify-between">
                <div className="bg-muted h-3 w-16 animate-pulse rounded" />
                <div className="bg-muted h-8 w-8 animate-pulse rounded-lg" />
              </div>
              <div>
                <div className="bg-muted mb-1.5 h-7 w-12 animate-pulse rounded" />
                <div className="bg-muted/60 h-2.5 w-24 animate-pulse rounded" />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Error state ───────────────────────────────────────────────── */}
      {isError && (
        <div className="border-destructive/20 bg-destructive/5 text-destructive mb-8 rounded-2xl border p-6 text-sm">
          <div className="flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin" />
            {t("operations.errorLoading")}
          </div>
        </div>
      )}

      {/* ── Metric cards ──────────────────────────────────────────────── */}
      {!isLoading && data && (
        <>
          <div className="mb-8 grid grid-cols-2 gap-4 sm:grid-cols-4">
            {/* Task Completion */}
            <MetricCard
              title={t("operations.taskCompletion")}
              value={data.taskCompletion.total > 0 ? `${data.taskCompletion.pct}%` : "–"}
              sub={
                data.taskCompletion.total > 0
                  ? t("operations.taskCount", {
                      done: data.taskCompletion.done,
                      total: data.taskCompletion.total,
                    })
                  : t("operations.noTasks")
              }
              icon={Percent}
              {...completionColors(data.taskCompletion.pct)}
            />

            {/* Stress Level — clickable to toggle department breakdown */}
            {(() => {
              const sc = stressColors(data.stressLevel.label);
              return (
                <div
                  className="cursor-pointer"
                  onClick={() => setShowDeptBreakdown(!showDeptBreakdown)}
                >
                  <MetricCard
                    title={t("operations.stressLevel")}
                    value={t(stressLabelKey[data.stressLevel.label])}
                    sub={
                      data.stressLevel.capacityPct > 0
                        ? t("operations.stressCapacity", {
                            pct: data.stressLevel.capacityPct,
                          }) +
                          (data.stressLevel.shortStaff > 0
                            ? `. ${t("operations.stressShortStaff", { count: data.stressLevel.shortStaff })}`
                            : "")
                        : t("operations.noShiftsPlanned")
                    }
                    icon={Gauge}
                    color={sc.color}
                    bg={sc.bg}
                    border={sc.border}
                    pulse={sc.pulse}
                  />
                </div>
              );
            })()}

            {/* Overdue Tasks */}
            <MetricCard
              title={t("operations.overdue")}
              value={String(data.overdueTasks)}
              sub={
                data.overdueTasks > 0 ? t("operations.overdueAttention") : t("operations.noDelays")
              }
              icon={AlertCircle}
              color={data.overdueTasks > 0 ? "text-warning" : "text-success"}
              bg={data.overdueTasks > 0 ? "bg-warning/10" : "bg-success/10"}
              border={data.overdueTasks > 0 ? "border-warning/20" : "border-success/20"}
            />

            {/* Upcoming Tasks */}
            <MetricCard
              title={t("operations.upcoming")}
              value={String(data.upcomingTasks)}
              sub={t("operations.nextHours")}
              icon={Clock}
              color="text-info"
              bg="bg-info/10"
              border="border-info/20"
            />

            {/* Staff Present */}
            <MetricCard
              title={t("operations.staffPresent")}
              value={
                data.staffPresent.expected > 0
                  ? `${data.staffPresent.present} / ${data.staffPresent.expected}`
                  : "–"
              }
              sub={
                data.staffPresent.names.length > 0
                  ? data.staffPresent.names.join(", ")
                  : t("operations.noShiftsToday")
              }
              icon={Users}
              color="text-primary"
              bg="bg-primary/10"
              border="border-primary/20"
            />

            {/* Active Tasks */}
            <MetricCard
              title={t("operations.activeTasks")}
              value={String(data.activeTasks)}
              sub={t("operations.activeNow")}
              icon={Activity}
              color="text-muted-foreground"
              bg="bg-muted"
              border="border-border"
            />

            {/* Temperature Status */}
            <div
              className={`flex flex-col justify-between rounded-2xl border p-4 shadow-sm transition-all ${
                data.haccpStatus === "ok"
                  ? "border-success/20 bg-success/5"
                  : data.haccpStatus === "deviation"
                    ? "border-destructive/20 bg-destructive/5"
                    : data.haccpStatus === "stale"
                      ? "border-warning/20 bg-warning/5"
                      : "border-border bg-card"
              }`}
            >
              <div className="mb-3 flex items-start justify-between">
                <h3 className="text-muted-foreground text-xs font-bold tracking-wider uppercase">
                  {t("operations.temperature")}
                </h3>
                <div
                  className={`flex h-8 w-8 items-center justify-center rounded-lg border ${
                    data.haccpStatus === "ok"
                      ? "border-success/20 bg-success/10"
                      : data.haccpStatus === "deviation"
                        ? "border-destructive/20 bg-destructive/10"
                        : data.haccpStatus === "stale"
                          ? "border-warning/20 bg-warning/10"
                          : "border-border bg-muted"
                  }`}
                >
                  <Thermometer
                    className={`h-4 w-4 ${
                      data.haccpStatus === "ok"
                        ? "text-success"
                        : data.haccpStatus === "deviation"
                          ? "text-destructive"
                          : "text-muted-foreground"
                    }`}
                  />
                </div>
              </div>
              <div>
                <div className="text-foreground font-heading mb-1.5 text-2xl leading-none font-black tracking-tight">
                  {data.haccpStatus === "none"
                    ? "—"
                    : data.haccpStatus === "ok"
                      ? t("operations.temperatureOk")
                      : data.haccpStatus === "stale"
                        ? t("operations.temperatureStaleValue")
                        : t("operations.temperatureDeviation")}
                </div>
                <div className="text-muted-foreground text-[10px] font-semibold">
                  {data.haccpStatus === "stale" && (
                    <span className="text-warning">{t("operations.temperatureStale")}</span>
                  )}
                  {data.haccpStatus === "none" && t("operations.temperatureNone")}
                  {data.lastHaccpTime &&
                    data.haccpStatus !== "stale" &&
                    data.haccpStatus !== "none" &&
                    formatDistanceToNow(new Date(data.lastHaccpTime), {
                      addSuffix: true,
                      locale: dateFnsLocale,
                    })}
                </div>
              </div>
            </div>

            {/* Cleaning Checklist Status */}
            <div
              className={`flex flex-col justify-between rounded-2xl border p-4 shadow-sm transition-all ${
                data.cleaningStatus.total === 0
                  ? "border-border bg-card"
                  : data.cleaningStatus.done === data.cleaningStatus.total
                    ? "border-success/20 bg-success/5"
                    : "border-warning/20 bg-warning/5"
              }`}
            >
              <div className="mb-3 flex items-start justify-between">
                <h3 className="text-muted-foreground text-xs font-bold tracking-wider uppercase">
                  {t("operations.cleaning")}
                </h3>
                <div
                  className={`flex h-8 w-8 items-center justify-center rounded-lg border ${
                    data.cleaningStatus.done === data.cleaningStatus.total &&
                    data.cleaningStatus.total > 0
                      ? "border-success/20 bg-success/10"
                      : "border-border bg-muted"
                  }`}
                >
                  <ClipboardCheck
                    className={`h-4 w-4 ${
                      data.cleaningStatus.done === data.cleaningStatus.total &&
                      data.cleaningStatus.total > 0
                        ? "text-success"
                        : "text-muted-foreground"
                    }`}
                  />
                </div>
              </div>
              <div>
                <div className="text-foreground font-heading mb-1.5 text-2xl leading-none font-black tracking-tight">
                  {data.cleaningStatus.total === 0
                    ? "—"
                    : t("operations.cleaningProgress", {
                        done: data.cleaningStatus.done,
                        total: data.cleaningStatus.total,
                      })}
                </div>
                <div className="text-muted-foreground text-[10px] font-semibold">
                  {data.cleaningStatus.total === 0 && t("operations.cleaningNone")}
                </div>
              </div>
            </div>
          </div>

          {/* ── Department breakdown (toggled from stress card) ──────── */}
          <AnimatePresence>
            {showDeptBreakdown && workspaceData?.workspace_id && (
              <div className="mb-8">
                <DepartmentBreakdown workspaceId={workspaceData.workspace_id} />
              </div>
            )}
          </AnimatePresence>

          {/* ── Deviations with severity breakdown ──────────────────── */}
          {data.deviationBreakdown.total > 0 && (
            <div
              className={`mb-8 rounded-2xl border p-6 shadow-sm ${
                data.deviationBreakdown.critical > 0
                  ? "border-destructive/20 bg-destructive/5"
                  : "border-warning/20 bg-warning/5"
              }`}
            >
              <div className="flex items-center gap-2">
                <AlertCircle
                  className={`h-5 w-5 ${
                    data.deviationBreakdown.critical > 0 ? "text-destructive" : "text-warning"
                  }`}
                />
                <h2 className="font-heading text-foreground text-lg font-extrabold">
                  {data.deviationBreakdown.total} {t("operations.deviations")}
                </h2>
              </div>
              <div className="mt-2 flex gap-4 text-sm">
                {data.deviationBreakdown.critical > 0 && (
                  <span className="text-destructive font-semibold">
                    {data.deviationBreakdown.critical} {t("operations.deviationsCritical")}
                  </span>
                )}
                {data.deviationBreakdown.high > 0 && (
                  <span className="text-warning font-semibold">
                    {data.deviationBreakdown.high} {t("operations.deviationsHigh")}
                  </span>
                )}
                {data.deviationBreakdown.medium > 0 && (
                  <span className="text-muted-foreground font-semibold">
                    {data.deviationBreakdown.medium} {t("operations.deviationsMedium")}
                  </span>
                )}
                {data.deviationBreakdown.low > 0 && (
                  <span className="text-muted-foreground font-semibold">
                    {data.deviationBreakdown.low} {t("operations.deviationsLow")}
                  </span>
                )}
              </div>
            </div>
          )}

          {/* ── Revenue vs Staff Cost chart ──────────────────────────── */}
          <div className="border-border bg-card flex flex-col rounded-2xl border p-6 shadow-sm">
            <div className="mb-8 flex items-center justify-between">
              <div>
                <h2 className="font-heading text-foreground text-xl font-extrabold">
                  {t("operations.revenueVsCost")}
                </h2>
                <p className="text-muted-foreground mt-1 text-sm">
                  {t("operations.revenueVsCostSub")}
                </p>
              </div>
              <div className="flex gap-4">
                <div className="flex items-center gap-2">
                  <div className="bg-success h-3 w-3 rounded-sm" />
                  <span className="text-muted-foreground text-sm font-semibold">
                    {t("operations.revenue")}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="bg-destructive h-3 w-3 rounded-sm" />
                  <span className="text-muted-foreground text-sm font-semibold">
                    {t("operations.laborCost")}
                  </span>
                </div>
              </div>
            </div>

            <div className="relative mt-4 flex h-64 items-end gap-2">
              {/* Horizontal grid lines */}
              <div className="border-border absolute top-0 w-full border-t border-dashed" />
              <div className="border-border absolute top-1/4 w-full border-t border-dashed" />
              <div className="border-border absolute top-2/4 w-full border-t border-dashed" />
              <div className="border-border absolute top-3/4 w-full border-t border-dashed" />

              {data.hourlyData.length === 0 ? (
                <div className="text-muted-foreground flex w-full items-center justify-center text-sm">
                  {t("operations.noHourlyData")}
                </div>
              ) : (
                data.hourlyData.map((col, idx) => (
                  <div
                    key={idx}
                    className="group hover:bg-muted/30 relative z-10 flex flex-1 flex-col items-center gap-2 rounded-xl pt-2 pb-1 transition-colors"
                  >
                    <div className="flex h-48 w-full items-end justify-center gap-1.5 opacity-90 transition-opacity hover:opacity-100">
                      <div
                        className={`w-1/3 rounded-t-md shadow-sm transition-all ${
                          col.isFuture
                            ? "border-success/20 bg-success/10 border"
                            : "bg-success group-hover:bg-success/80"
                        }`}
                        style={{ height: col.revPct }}
                      />
                      <div
                        className={`w-1/3 rounded-t-md shadow-sm transition-all ${
                          col.isFuture
                            ? "border-destructive/20 bg-destructive/10 border"
                            : "bg-destructive/70 group-hover:bg-destructive/60"
                        }`}
                        style={{ height: col.costPct }}
                      />
                    </div>
                    <span className="text-muted-foreground group-hover:text-foreground text-xs font-bold">
                      {col.time}
                    </span>

                    {/* Hover tooltip with real NOK values */}
                    <div className="bg-popover text-popover-foreground pointer-events-none absolute -top-10 z-20 rounded px-2 py-1 text-[10px] whitespace-nowrap opacity-0 shadow-xl transition-opacity group-hover:opacity-100">
                      {col.isFuture
                        ? t("operations.future")
                        : `Kr ${col.revenue.toLocaleString("nb-NO")} | Kr ${col.cost.toLocaleString("nb-NO")}`}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// ─── MetricCard ────────────────────────────────────────────────────────────

interface MetricCardProps {
  title: string;
  value: React.ReactNode;
  sub: string;
  icon: React.ElementType;
  color: string;
  bg: string;
  border: string;
  pulse?: boolean;
}

function MetricCard({ title, value, sub, icon: Icon, color, bg, border, pulse }: MetricCardProps) {
  return (
    <div
      className={`flex flex-col justify-between rounded-2xl border p-4 shadow-sm transition-all hover:shadow-md ${bg} ${border}`}
    >
      <div className="mb-3 flex items-start justify-between">
        <h3 className="text-muted-foreground text-xs font-bold tracking-wider uppercase">
          {title}
        </h3>
        <div
          className={`flex h-8 w-8 items-center justify-center rounded-lg border ${bg} ${border}`}
        >
          <Icon className={`h-4 w-4 ${color} ${pulse ? "animate-pulse" : ""}`} />
        </div>
      </div>
      <div>
        <div className="text-foreground mb-1.5 text-2xl leading-none font-black tracking-tight">
          {value}
        </div>
        <div className="text-muted-foreground text-[10px] font-semibold">{sub}</div>
      </div>
    </div>
  );
}
