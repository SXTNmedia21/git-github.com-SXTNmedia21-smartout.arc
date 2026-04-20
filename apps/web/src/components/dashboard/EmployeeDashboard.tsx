"use client";

import { useContext } from "react";
import {
  Calendar,
  CheckCircle2,
  Clock,
  Zap,
  Coffee,
  CalendarPlus,
  ArrowRightLeft,
  ChevronRight,
  MapPin,
  BookOpen,
} from "lucide-react";
import { DashboardContext } from "@/components/dashboard/DashboardShell";
import { useMyShifts, useMyReadiness, type MyShift } from "@/app/dashboard/_hooks/use-my-dashboard";
import { useWorkspace } from "@/lib/workspace-context";
import { createClient } from "@smartout/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { dashboardKeys } from "@/app/dashboard/_hooks/dashboard-keys";

type OpenShift = {
  schedule_shift_id: string;
  shift_date: string;
  start_time: string;
  end_time: string;
  role: string;
};

interface EmployeeDashboardProps {
  isDark: boolean;
}

function formatShiftDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-GB", { weekday: "short", month: "short", day: "numeric" });
}

function formatDayMonth(dateStr: string): { day: string; month: string; weekday: string } {
  const d = new Date(dateStr);
  return {
    day: String(d.getDate()),
    month: d.toLocaleDateString("en-GB", { month: "short" }),
    weekday: d.toLocaleDateString("en-GB", { weekday: "short" }),
  };
}

export default function EmployeeDashboard({ isDark }: EmployeeDashboardProps) {
  const { profileId } = useContext(DashboardContext);
  const { workspace } = useWorkspace();

  const { data: shifts, isLoading: shiftsLoading } = useMyShifts(profileId);
  const { data: readiness } = useMyReadiness(profileId);

  // Open shifts query
  const { data: openShifts } = useQuery({
    queryKey: dashboardKeys.openShifts(workspace.workspace_id),
    queryFn: async () => {
      const supabase = createClient();
      const today = new Date().toISOString().split("T")[0];

      const { data, error } = await supabase
        .from("schedule_shift")
        .select("schedule_shift_id, shift_date, start_time, end_time, role")
        .eq("workspace_id", workspace.workspace_id)
        .is("employee_id", null)
        .eq("is_published", true)
        .gte("shift_date", today!)
        .order("shift_date", { ascending: true })
        .limit(3);

      if (error) throw error;
      return data ?? [];
    },
  });

  const today = new Date().toISOString().split("T")[0];
  const todayShift = shifts?.find((s: MyShift) => s.date === today);
  const upcomingShifts = shifts?.filter((s: MyShift) => s.date !== today) ?? [];

  return (
    <div className="z-10 flex h-full w-full flex-1 flex-col overflow-hidden">
      {/* Header section */}
      <div className="mb-6 flex-shrink-0">
        <h1
          className={`mb-2 flex items-center gap-3 text-3xl font-extrabold tracking-tight ${isDark ? "text-white" : "text-zinc-900"}`}
        >
          My Workspace
        </h1>
        <p className={`text-sm ${isDark ? "text-zinc-400" : "text-zinc-500"}`}>
          Your shifts, training progress, and quick actions.
        </p>
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Left Column: Shifts */}
        <div className="flex h-full min-h-0 flex-col gap-6 lg:col-span-2">
          {/* Today's Shift */}
          <div className="group relative flex-shrink-0">
            <div
              className={`absolute -inset-0.5 rounded-2xl opacity-25 blur transition duration-1000 group-hover:opacity-50 group-hover:duration-200 ${isDark ? "bg-gradient-to-r from-orange-500 to-indigo-500" : "bg-gradient-to-r from-orange-400 to-indigo-400"}`}
            />
            <div
              className={`relative rounded-2xl border p-6 shadow-lg ${isDark ? "border-zinc-800 bg-[#0c0c0e]" : "border-zinc-200 bg-white"}`}
            >
              <div className="mb-4 flex items-start justify-between">
                <div
                  className={`rounded border bg-orange-500/10 px-2.5 py-1 text-xs font-bold tracking-widest uppercase ${isDark ? "border-orange-500/20 text-orange-400" : "border-orange-200 text-orange-600"}`}
                >
                  Today&apos;s Shift
                </div>
                <div
                  className={`flex items-center gap-2 text-sm font-semibold ${isDark ? "text-zinc-400" : "text-zinc-500"}`}
                >
                  <Calendar className="h-4 w-4" />
                  {new Date().toLocaleDateString("en-GB", {
                    weekday: "short",
                    month: "short",
                    day: "numeric",
                  })}
                </div>
              </div>

              {shiftsLoading ? (
                <div
                  className={`h-16 animate-pulse rounded-xl ${isDark ? "bg-zinc-800" : "bg-zinc-100"}`}
                />
              ) : todayShift ? (
                <div className="flex items-center gap-6">
                  <div
                    className={`flex h-16 w-16 flex-col items-center justify-center rounded-2xl border ${isDark ? "border-zinc-800 bg-zinc-900" : "border-zinc-200 bg-zinc-50"}`}
                  >
                    <span
                      className={`text-2xl font-black ${isDark ? "text-white" : "text-zinc-900"}`}
                    >
                      {formatDayMonth(todayShift.date).day}
                    </span>
                    <span
                      className={`text-[10px] font-bold uppercase ${isDark ? "text-zinc-400" : "text-zinc-500"}`}
                    >
                      {formatDayMonth(todayShift.date).month}
                    </span>
                  </div>

                  <div className="flex-1">
                    <h2
                      className={`mb-1 text-2xl font-black ${isDark ? "text-white" : "text-zinc-900"}`}
                    >
                      {todayShift.role}
                    </h2>
                    <div
                      className={`flex items-center gap-4 text-sm font-semibold ${isDark ? "text-zinc-400" : "text-zinc-500"}`}
                    >
                      <div className="flex items-center gap-1.5 text-orange-500">
                        <Clock className="h-4 w-4" />
                        {todayShift.startTime} - {todayShift.endTime} ({todayShift.workHours}h)
                      </div>
                    </div>
                  </div>

                  <button
                    className={`w-32 rounded-xl py-3 text-sm font-bold shadow-md transition-all hover:scale-105 active:scale-95 ${isDark ? "bg-white text-zinc-900 hover:bg-zinc-200" : "bg-zinc-900 text-white hover:bg-zinc-800"}`}
                  >
                    Punch In
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-4">
                  <div
                    className={`flex h-16 w-16 items-center justify-center rounded-2xl border ${isDark ? "border-zinc-800 bg-zinc-900" : "border-zinc-200 bg-zinc-50"}`}
                  >
                    <Calendar className={`h-6 w-6 ${isDark ? "text-zinc-600" : "text-zinc-300"}`} />
                  </div>
                  <div>
                    <h2
                      className={`text-lg font-bold ${isDark ? "text-zinc-300" : "text-zinc-700"}`}
                    >
                      No shift today
                    </h2>
                    <p className={`text-sm ${isDark ? "text-zinc-500" : "text-zinc-400"}`}>
                      Check upcoming shifts or pick up an open one.
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Readiness Widget */}
          {readiness && readiness.total > 0 && (
            <div
              className={`flex-shrink-0 rounded-2xl border p-5 shadow-sm ${isDark ? "border-zinc-800 bg-[#0c0c0e]" : "border-zinc-200 bg-white"}`}
            >
              <div className="mb-3 flex items-center justify-between">
                <h3
                  className={`flex items-center gap-2 text-sm font-bold ${isDark ? "text-zinc-100" : "text-zinc-800"}`}
                >
                  <BookOpen className="h-4 w-4 text-indigo-500" /> My Readiness
                </h3>
                <span
                  className={`text-2xl font-black ${readiness.percent >= 100 ? "text-emerald-500" : isDark ? "text-white" : "text-zinc-900"}`}
                >
                  {readiness.percent}%
                </span>
              </div>
              <div
                className={`h-3 overflow-hidden rounded-full ${isDark ? "bg-zinc-800" : "bg-zinc-100"}`}
              >
                <div
                  className={`h-full rounded-full transition-all duration-700 ${readiness.percent >= 100 ? "bg-emerald-500" : readiness.percent >= 70 ? "bg-blue-500" : "bg-orange-500"}`}
                  style={{ width: `${readiness.percent}%` }}
                />
              </div>
              <p className={`mt-2 text-xs ${isDark ? "text-zinc-400" : "text-zinc-500"}`}>
                {readiness.pending > 0
                  ? `${readiness.pending} protocol${readiness.pending > 1 ? "s" : ""} remaining`
                  : "All protocols completed!"}
              </p>
            </div>
          )}

          {/* Upcoming Schedule */}
          <div
            className={`flex min-h-0 flex-1 flex-col rounded-2xl border p-5 shadow-sm ${isDark ? "border-zinc-800 bg-[#0c0c0e]" : "border-zinc-200 bg-white"}`}
          >
            <div className="mb-6 flex items-center justify-between">
              <h3
                className={`text-lg font-extrabold ${isDark ? "text-zinc-100" : "text-zinc-800"}`}
              >
                Upcoming Schedule
              </h3>
            </div>

            <div className="flex min-h-0 flex-1 flex-col gap-3">
              {upcomingShifts.length > 0 ? (
                upcomingShifts.map((shift: MyShift) => {
                  const dm = formatDayMonth(shift.date);
                  return (
                    <div
                      key={shift.id}
                      className={`group flex flex-1 cursor-pointer items-center rounded-xl border p-3 transition-colors ${isDark ? "border-zinc-800 bg-zinc-900/40 hover:border-zinc-700 hover:bg-zinc-800/80" : "border-zinc-200 bg-zinc-50/50 hover:border-zinc-300 hover:bg-zinc-100"}`}
                    >
                      <div
                        className={`mr-3 flex w-14 flex-col items-center justify-center border-r pr-3 ${isDark ? "border-zinc-800" : "border-zinc-200"}`}
                      >
                        <span
                          className={`text-[10px] font-bold uppercase ${isDark ? "text-zinc-400" : "text-zinc-500"}`}
                        >
                          {dm.weekday}
                        </span>
                        <span
                          className={`text-lg font-black ${isDark ? "text-white" : "text-zinc-900"}`}
                        >
                          {dm.day}
                        </span>
                      </div>
                      <div className="flex-1">
                        <h4
                          className={`text-sm font-bold ${isDark ? "text-zinc-200" : "text-zinc-800"}`}
                        >
                          {shift.role}
                        </h4>
                        <p
                          className={`mt-0.5 text-xs font-semibold ${isDark ? "text-zinc-400" : "text-zinc-500"}`}
                        >
                          {shift.startTime} - {shift.endTime} ({shift.workHours}h)
                        </p>
                      </div>
                      <ChevronRight
                        className={`h-4 w-4 opacity-0 transition-opacity group-hover:opacity-100 ${isDark ? "text-zinc-600" : "text-zinc-400"}`}
                      />
                    </div>
                  );
                })
              ) : (
                <div
                  className={`flex flex-1 items-center justify-center rounded-xl border-2 border-dashed p-6 ${isDark ? "border-zinc-800" : "border-zinc-200"}`}
                >
                  <p
                    className={`text-center text-xs font-semibold ${isDark ? "text-zinc-500" : "text-zinc-400"}`}
                  >
                    No upcoming shifts scheduled.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right Column: Actions & Open Shifts */}
        <div className="flex h-full min-h-0 flex-col gap-6">
          {/* Quick Actions */}
          <div className="grid flex-shrink-0 grid-cols-2 gap-3">
            <button
              className={`group col-span-2 flex items-center justify-between rounded-xl border p-4 shadow-sm transition-all hover:scale-[1.02] active:scale-[0.98] ${isDark ? "border-indigo-500/30 bg-gradient-to-br from-indigo-900/40 to-indigo-900/10" : "border-indigo-200 bg-gradient-to-br from-indigo-50 to-white"}`}
            >
              <div className="flex items-center gap-3">
                <div
                  className={`rounded-lg p-2 ${isDark ? "bg-indigo-500/20" : "bg-white shadow-sm"}`}
                >
                  <CalendarPlus
                    className={`h-5 w-5 ${isDark ? "text-indigo-400" : "text-indigo-600"}`}
                  />
                </div>
                <div className="text-left">
                  <div
                    className={`text-sm font-bold ${isDark ? "text-indigo-100" : "text-indigo-900"}`}
                  >
                    Set Availability
                  </div>
                  <div
                    className={`text-[10px] font-semibold ${isDark ? "text-indigo-300" : "text-indigo-600/70"}`}
                  >
                    For coming weeks
                  </div>
                </div>
              </div>
              <ChevronRight
                className={`h-4 w-4 transition-transform group-hover:translate-x-1 ${isDark ? "text-indigo-400" : "text-indigo-400"}`}
              />
            </button>

            <button
              className={`flex flex-col items-center justify-center gap-2 rounded-xl border p-4 transition-all hover:-translate-y-1 ${isDark ? "border-zinc-800 bg-[#0c0c0e] hover:border-zinc-700" : "border-zinc-200 bg-white hover:border-zinc-300 hover:shadow-md"}`}
            >
              <Coffee className={`h-5 w-5 ${isDark ? "text-orange-500" : "text-orange-500"}`} />
              <span className={`text-xs font-bold ${isDark ? "text-zinc-300" : "text-zinc-700"}`}>
                Time Off
              </span>
            </button>

            <button
              className={`flex flex-col items-center justify-center gap-2 rounded-xl border p-4 transition-all hover:-translate-y-1 ${isDark ? "border-zinc-800 bg-[#0c0c0e] hover:border-zinc-700" : "border-zinc-200 bg-white hover:border-zinc-300 hover:shadow-md"}`}
            >
              <ArrowRightLeft className={`h-5 w-5 ${isDark ? "text-blue-500" : "text-blue-500"}`} />
              <span className={`text-xs font-bold ${isDark ? "text-zinc-300" : "text-zinc-700"}`}>
                Swap Shift
              </span>
            </button>
          </div>

          {/* Open Shifts */}
          <div
            className={`relative flex-shrink-0 overflow-hidden rounded-2xl border p-5 shadow-sm ${isDark ? "border-emerald-900/50 bg-emerald-950/20" : "border-emerald-200 bg-emerald-50"}`}
          >
            <div
              className={`absolute top-0 right-0 -mt-16 -mr-16 h-32 w-32 rounded-full opacity-20 blur-3xl ${isDark ? "bg-emerald-500" : "bg-emerald-400"}`}
            />

            <div className="mb-4 flex items-center gap-3">
              <div
                className={`rounded-md p-1.5 ${isDark ? "bg-emerald-500/20" : "bg-emerald-200"}`}
              >
                <Zap className={`h-4 w-4 ${isDark ? "text-emerald-400" : "text-emerald-600"}`} />
              </div>
              <h3
                className={`text-sm font-black tracking-widest uppercase ${isDark ? "text-emerald-500" : "text-emerald-700"}`}
              >
                Open Shifts
              </h3>
            </div>

            {openShifts && openShifts.length > 0 ? (
              <>
                <p
                  className={`mb-4 text-xs font-semibold ${isDark ? "text-zinc-400" : "text-zinc-600"}`}
                >
                  There are{" "}
                  <b className={isDark ? "text-emerald-400" : "text-emerald-600"}>
                    {openShifts.length} shift{openShifts.length > 1 ? "s" : ""}
                  </b>{" "}
                  available.
                </p>

                <div className="space-y-2">
                  {openShifts.map((shift: OpenShift) => (
                    <div
                      key={shift.schedule_shift_id}
                      className={`flex items-center justify-between rounded-lg border p-3 text-sm ${isDark ? "border-emerald-900/50 bg-black/20 hover:bg-black/40" : "border-emerald-100 bg-white hover:shadow-sm"} cursor-pointer transition-all`}
                    >
                      <div>
                        <div className={`font-bold ${isDark ? "text-zinc-200" : "text-zinc-800"}`}>
                          {formatShiftDate(shift.shift_date)}
                        </div>
                        <div
                          className={`text-[10px] font-semibold ${isDark ? "text-zinc-500" : "text-zinc-500"}`}
                        >
                          {shift.start_time} - {shift.end_time} &bull; {shift.role}
                        </div>
                      </div>
                      <button
                        className={`rounded border px-3 py-1.5 text-xs font-bold ${isDark ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20" : "border-emerald-200 bg-emerald-50 text-emerald-600 hover:bg-emerald-100"}`}
                      >
                        Take Shift
                      </button>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <p className={`text-xs font-semibold ${isDark ? "text-zinc-500" : "text-zinc-400"}`}>
                No open shifts available right now.
              </p>
            )}
          </div>

          {/* Placeholder: Colleagues */}
          <div
            className={`flex min-h-0 flex-1 flex-col rounded-2xl border p-5 ${isDark ? "border-zinc-800 bg-[#0c0c0e]" : "border-zinc-200 bg-white"}`}
          >
            <h3
              className={`mb-4 flex items-center gap-2 text-sm font-bold ${isDark ? "text-zinc-100" : "text-zinc-800"}`}
            >
              <MapPin className="h-4 w-4 text-purple-500" /> My Active Tasks
            </h3>

            <div
              className={`flex flex-1 items-center justify-center overflow-hidden rounded-xl border-2 border-dashed p-6 ${isDark ? "border-zinc-800 bg-zinc-900/30" : "border-zinc-200 bg-zinc-50"}`}
            >
              <div className="text-center">
                <CheckCircle2
                  className={`mx-auto mb-2 h-8 w-8 opacity-20 ${isDark ? "text-zinc-400" : "text-zinc-500"}`}
                />
                <p
                  className={`text-xs font-semibold ${isDark ? "text-zinc-500" : "text-zinc-500"}`}
                >
                  No active task lists.
                  <br />
                  Punch in to get your tasks.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
