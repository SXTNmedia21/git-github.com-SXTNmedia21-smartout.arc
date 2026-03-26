"use client";

// UI Events:
// - color-regime: stress-based (Lav=emerald, Middels=orange, Høy=red)
// - color-regime: task-completion (>75%=emerald, 50-75%=orange, <50%=red)
// - action: auto-refetch every 60s (live dashboard, no user trigger needed)

import { useContext } from "react";
import { useQuery } from "@tanstack/react-query";
import { DashboardContext } from "@/components/dashboard/DashboardShell";
import { Percent, Gauge, Clock, Users, Activity, AlertCircle, Loader2 } from "lucide-react";
import { createClient } from "@smartout/supabase/client";
import { useOperationsData } from "./_hooks/use-operations-data";
import type { StressLabel } from "./_hooks/use-operations-data";
import { DeviationDialog } from "./_components/DeviationDialog";

// ─── Stress-level color maps ───────────────────────────────────────────────

function stressColors(label: StressLabel, isDark: boolean) {
  if (label === "Lav") {
    return {
      color: "text-emerald-500",
      bg: isDark ? "bg-emerald-500/10" : "bg-emerald-50",
      border: isDark ? "border-emerald-500/20" : "border-emerald-200",
      pulse: false,
    };
  }
  if (label === "Middels") {
    return {
      color: "text-orange-500",
      bg: isDark ? "bg-orange-500/10" : "bg-orange-50",
      border: isDark ? "border-orange-500/20" : "border-orange-200",
      pulse: false,
    };
  }
  return {
    color: "text-red-500",
    bg: isDark ? "bg-red-500/10" : "bg-red-50",
    border: isDark ? "border-red-500/20" : "border-red-200",
    pulse: true,
  };
}

function completionColors(pct: number, isDark: boolean) {
  if (pct >= 75) {
    return {
      color: "text-emerald-500",
      bg: isDark ? "bg-emerald-500/10" : "bg-emerald-50",
      border: isDark ? "border-emerald-500/20" : "border-emerald-200",
    };
  }
  if (pct >= 50) {
    return {
      color: "text-orange-500",
      bg: isDark ? "bg-orange-500/10" : "bg-orange-50",
      border: isDark ? "border-orange-500/20" : "border-orange-200",
    };
  }
  return {
    color: "text-red-500",
    bg: isDark ? "bg-red-500/10" : "bg-red-50",
    border: isDark ? "border-red-500/20" : "border-red-200",
  };
}

// ─── Page ──────────────────────────────────────────────────────────────────

export default function OperationsPage() {
  const { isDark, workspaceData, profileId } = useContext(DashboardContext);
  const { data, isLoading, isError } = useOperationsData();

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
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1
            className={`mb-2 flex items-center gap-3 text-3xl font-extrabold tracking-tight ${isDark ? "text-white" : "text-zinc-900"}`}
          >
            Aktiv Pipeline
            <span className="rounded border border-orange-500/20 bg-orange-500/10 px-2 py-1 text-xs font-bold tracking-wider text-orange-600 uppercase">
              LIVE
            </span>
          </h1>
          <p className={`text-sm ${isDark ? "text-zinc-400" : "text-zinc-500"}`}>
            Sanntidsstatus for dagens operasjonelle avdelingsseksjoner.
          </p>
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
        <div className="mb-8 grid grid-cols-2 gap-4 lg:grid-cols-3 xl:grid-cols-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className={`flex flex-col justify-between rounded-2xl border p-4 shadow-sm ${isDark ? "border-zinc-800/80 bg-[#121216]" : "border-zinc-200 bg-white"}`}
            >
              <div className="mb-3 flex items-start justify-between">
                <div
                  className={`h-3 w-16 animate-pulse rounded ${isDark ? "bg-zinc-800" : "bg-zinc-200"}`}
                />
                <div
                  className={`h-8 w-8 animate-pulse rounded-lg ${isDark ? "bg-zinc-800" : "bg-zinc-200"}`}
                />
              </div>
              <div>
                <div
                  className={`mb-1.5 h-7 w-12 animate-pulse rounded ${isDark ? "bg-zinc-800" : "bg-zinc-200"}`}
                />
                <div
                  className={`h-2.5 w-24 animate-pulse rounded ${isDark ? "bg-zinc-800/60" : "bg-zinc-100"}`}
                />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Error state ───────────────────────────────────────────────── */}
      {isError && (
        <div
          className={`mb-8 rounded-2xl border p-6 text-sm ${isDark ? "border-red-500/20 bg-red-500/5 text-red-400" : "border-red-200 bg-red-50 text-red-600"}`}
        >
          <div className="flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin" />
            Kunne ikke laste driftsdata. Prøver igjen...
          </div>
        </div>
      )}

      {/* ── Metric cards ──────────────────────────────────────────────── */}
      {!isLoading && data && (
        <>
          <div className="mb-8 grid grid-cols-2 gap-4 lg:grid-cols-3 xl:grid-cols-6">
            {/* Task Completion */}
            <MetricCard
              isDark={isDark}
              title="Fullføring"
              value={data.taskCompletion.total > 0 ? `${data.taskCompletion.pct}%` : "–"}
              sub={
                data.taskCompletion.total > 0
                  ? `${data.taskCompletion.done} / ${data.taskCompletion.total} oppgaver`
                  : "Ingen oppgaver i dag"
              }
              icon={Percent}
              {...completionColors(data.taskCompletion.pct, isDark)}
            />

            {/* Stress Level */}
            {(() => {
              const sc = stressColors(data.stressLevel.label, isDark);
              return (
                <MetricCard
                  isDark={isDark}
                  title="Stressnivå"
                  value={data.stressLevel.label}
                  sub={
                    data.stressLevel.capacityPct > 0
                      ? `${data.stressLevel.capacityPct}% kapasitet${data.stressLevel.shortStaff > 0 ? `. ${data.stressLevel.shortStaff} mangler.` : ""}`
                      : "Ingen vakter planlagt"
                  }
                  icon={Gauge}
                  color={sc.color}
                  bg={sc.bg}
                  border={sc.border}
                  pulse={sc.pulse}
                />
              );
            })()}

            {/* Overdue Tasks */}
            <MetricCard
              isDark={isDark}
              title="Forfalt"
              value={String(data.overdueTasks)}
              sub={data.overdueTasks > 0 ? "Krever oppmerksomhet" : "Ingen forsinkelser"}
              icon={AlertCircle}
              color={data.overdueTasks > 0 ? "text-orange-500" : "text-emerald-500"}
              bg={
                data.overdueTasks > 0
                  ? isDark
                    ? "bg-orange-500/10"
                    : "bg-orange-50"
                  : isDark
                    ? "bg-emerald-500/10"
                    : "bg-emerald-50"
              }
              border={
                data.overdueTasks > 0
                  ? isDark
                    ? "border-orange-500/20"
                    : "border-orange-200"
                  : isDark
                    ? "border-emerald-500/20"
                    : "border-emerald-200"
              }
            />

            {/* Upcoming Tasks */}
            <MetricCard
              isDark={isDark}
              title="Kommende"
              value={String(data.upcomingTasks)}
              sub="Neste 2 timer"
              icon={Clock}
              color="text-blue-500"
              bg={isDark ? "bg-blue-500/10" : "bg-blue-50"}
              border={isDark ? "border-blue-500/20" : "border-blue-200"}
            />

            {/* Staff Present */}
            <MetricCard
              isDark={isDark}
              title="Til stede"
              value={
                data.staffPresent.expected > 0
                  ? `${data.staffPresent.present} / ${data.staffPresent.expected}`
                  : "–"
              }
              sub={
                data.staffPresent.names.length > 0
                  ? data.staffPresent.names.join(", ")
                  : "Ingen vakter i dag"
              }
              icon={Users}
              color="text-purple-500"
              bg={isDark ? "bg-purple-500/10" : "bg-purple-50"}
              border={isDark ? "border-purple-500/20" : "border-purple-200"}
            />

            {/* Active Tasks */}
            <MetricCard
              isDark={isDark}
              title="Aktive"
              value={String(data.activeTasks)}
              sub="Pågår nå"
              icon={Activity}
              color="text-zinc-500"
              bg={isDark ? "bg-zinc-800" : "bg-zinc-100"}
              border={isDark ? "border-zinc-700" : "border-zinc-200"}
            />
          </div>

          {/* ── Revenue vs Staff Cost chart ──────────────────────────── */}
          <div
            className={`flex flex-col rounded-2xl border p-6 shadow-sm ${isDark ? "border-zinc-800 bg-[#0c0c0e]" : "border-zinc-200 bg-white"}`}
          >
            <div className="mb-8 flex items-center justify-between">
              <div>
                <h2
                  className={`text-xl font-extrabold ${isDark ? "text-zinc-100" : "text-zinc-800"}`}
                >
                  Omsetning vs Lønnskostnad (time for time)
                </h2>
                <p className={`mt-1 text-sm ${isDark ? "text-zinc-400" : "text-zinc-500"}`}>
                  Direktesammenligning av generert omsetning og aktiv lønn per time.
                </p>
              </div>
              <div className="flex gap-4">
                <div className="flex items-center gap-2">
                  <div className="h-3 w-3 rounded-sm bg-emerald-500" />
                  <span
                    className={`text-sm font-semibold ${isDark ? "text-zinc-400" : "text-zinc-600"}`}
                  >
                    Omsetning
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="h-3 w-3 rounded-sm bg-red-400" />
                  <span
                    className={`text-sm font-semibold ${isDark ? "text-zinc-400" : "text-zinc-600"}`}
                  >
                    Lønnskostnad
                  </span>
                </div>
              </div>
            </div>

            <div className="relative mt-4 flex h-64 items-end gap-2">
              {/* Horizontal grid lines */}
              <div
                className={`absolute top-0 w-full border-t border-dashed ${isDark ? "border-zinc-800" : "border-zinc-200"}`}
              />
              <div
                className={`absolute top-1/4 w-full border-t border-dashed ${isDark ? "border-zinc-800" : "border-zinc-200"}`}
              />
              <div
                className={`absolute top-2/4 w-full border-t border-dashed ${isDark ? "border-zinc-800" : "border-zinc-200"}`}
              />
              <div
                className={`absolute top-3/4 w-full border-t border-dashed ${isDark ? "border-zinc-800" : "border-zinc-200"}`}
              />

              {data.hourlyData.length === 0 ? (
                <div
                  className={`flex w-full items-center justify-center text-sm ${isDark ? "text-zinc-600" : "text-zinc-400"}`}
                >
                  Ingen timedata tilgjengelig for i dag
                </div>
              ) : (
                data.hourlyData.map((col, idx) => (
                  <div
                    key={idx}
                    className="group relative z-10 flex flex-1 flex-col items-center gap-2 rounded-xl pt-2 pb-1 transition-colors hover:bg-zinc-500/5"
                  >
                    <div className="flex h-48 w-full items-end justify-center gap-1.5 opacity-90 transition-opacity hover:opacity-100">
                      <div
                        className={`w-1/3 rounded-t-md shadow-sm transition-all ${
                          col.isFuture
                            ? isDark
                              ? "border border-emerald-900/30 bg-emerald-900/20"
                              : "border border-emerald-200/50 bg-emerald-100/50"
                            : "bg-emerald-500 group-hover:bg-emerald-400"
                        }`}
                        style={{ height: col.revPct }}
                      />
                      <div
                        className={`w-1/3 rounded-t-md shadow-sm transition-all ${
                          col.isFuture
                            ? isDark
                              ? "border border-red-900/30 bg-red-900/20"
                              : "border border-red-200/50 bg-red-100/50"
                            : "bg-red-400 group-hover:bg-red-300"
                        }`}
                        style={{ height: col.costPct }}
                      />
                    </div>
                    <span
                      className={`text-xs font-bold ${isDark ? "text-zinc-500 group-hover:text-zinc-300" : "text-zinc-400 group-hover:text-zinc-700"}`}
                    >
                      {col.time}
                    </span>

                    {/* Hover tooltip with real NOK values */}
                    <div className="pointer-events-none absolute -top-10 z-20 rounded bg-zinc-800 px-2 py-1 text-[10px] whitespace-nowrap text-white opacity-0 shadow-xl transition-opacity group-hover:opacity-100">
                      {col.isFuture
                        ? "Fremtidig"
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
  isDark?: boolean;
}

function MetricCard({
  title,
  value,
  sub,
  icon: Icon,
  color,
  bg,
  border,
  pulse,
  isDark,
}: MetricCardProps) {
  return (
    <div
      className={`flex flex-col justify-between rounded-2xl border p-4 shadow-sm transition-all ${isDark ? "border-zinc-800/80 bg-[#121216] hover:bg-[#18181b]" : "border-zinc-200 bg-white hover:border-zinc-300 hover:shadow-md"}`}
    >
      <div className="mb-3 flex items-start justify-between">
        <h3
          className={`text-xs font-bold tracking-wider uppercase ${isDark ? "text-zinc-500" : "text-zinc-400"}`}
        >
          {title}
        </h3>
        <div
          className={`flex h-8 w-8 items-center justify-center rounded-lg border ${bg} ${border}`}
        >
          <Icon className={`h-4 w-4 ${color} ${pulse ? "animate-pulse" : ""}`} />
        </div>
      </div>
      <div>
        <div
          className={`mb-1.5 text-2xl leading-none font-black tracking-tight ${isDark ? "text-white" : "text-zinc-900"}`}
        >
          {value}
        </div>
        <div className={`text-[10px] font-semibold ${isDark ? "text-zinc-500" : "text-zinc-400"}`}>
          {sub}
        </div>
      </div>
    </div>
  );
}
