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

export default function EmployeeDashboard(_props: EmployeeDashboardProps) {
  const { profileId } = useContext(DashboardContext);
  const { workspace } = useWorkspace();

  const { data: shifts, isLoading: shiftsLoading } = useMyShifts(profileId);
  const { data: readiness } = useMyReadiness(profileId);

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
      <div className="mb-6 flex-shrink-0">
        <h1 className="text-foreground mb-2 flex items-center gap-3 text-3xl font-extrabold tracking-tight">
          My Workspace
        </h1>
        <p className="text-muted-foreground text-sm">
          Your shifts, training progress, and quick actions.
        </p>
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="flex h-full min-h-0 flex-col gap-6 lg:col-span-2">
          {/* Today's Shift */}
          <div className="border-border bg-card flex-shrink-0 rounded-2xl border p-6 shadow-sm">
            <div className="mb-4 flex items-start justify-between">
              <div className="border-border bg-muted text-muted-foreground rounded border px-2.5 py-1 text-xs font-bold tracking-widest uppercase">
                Today&apos;s Shift
              </div>
              <div className="text-muted-foreground flex items-center gap-2 text-sm font-semibold">
                <Calendar className="h-4 w-4" />
                {new Date().toLocaleDateString("en-GB", {
                  weekday: "short",
                  month: "short",
                  day: "numeric",
                })}
              </div>
            </div>

            {shiftsLoading ? (
              <div className="bg-muted h-16 animate-pulse rounded-xl" />
            ) : todayShift ? (
              <div className="flex items-center gap-6">
                <div className="border-border bg-muted flex h-16 w-16 flex-col items-center justify-center rounded-2xl border">
                  <span className="text-foreground text-2xl font-black">
                    {formatDayMonth(todayShift.date).day}
                  </span>
                  <span className="text-muted-foreground text-[10px] font-bold uppercase">
                    {formatDayMonth(todayShift.date).month}
                  </span>
                </div>

                <div className="flex-1">
                  <h2 className="text-foreground mb-1 text-2xl font-black">{todayShift.role}</h2>
                  <div className="text-muted-foreground flex items-center gap-4 text-sm font-semibold">
                    <div className="flex items-center gap-1.5">
                      <Clock className="h-4 w-4" />
                      {todayShift.startTime} - {todayShift.endTime} ({todayShift.workHours}h)
                    </div>
                  </div>
                </div>

                <button className="bg-foreground text-background w-32 rounded-xl py-3 text-sm font-bold shadow-sm transition-all hover:opacity-90 active:scale-95">
                  Punch In
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-4">
                <div className="border-border bg-muted flex h-16 w-16 items-center justify-center rounded-2xl border">
                  <Calendar className="text-muted-foreground h-6 w-6" />
                </div>
                <div>
                  <h2 className="text-foreground text-lg font-bold">No shift today</h2>
                  <p className="text-muted-foreground text-sm">
                    Check upcoming shifts or pick up an open one.
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Readiness Widget */}
          {readiness && readiness.total > 0 && (
            <div className="border-border bg-card flex-shrink-0 rounded-2xl border p-5 shadow-sm">
              <div className="mb-3 flex items-center justify-between">
                <h3 className="text-foreground flex items-center gap-2 text-sm font-bold">
                  <BookOpen className="text-muted-foreground h-4 w-4" /> My Readiness
                </h3>
                <span className="text-foreground text-2xl font-black">{readiness.percent}%</span>
              </div>
              <div className="bg-muted h-3 overflow-hidden rounded-full">
                <div
                  className="bg-foreground h-full rounded-full transition-all duration-700"
                  style={{ width: `${readiness.percent}%` }}
                />
              </div>
              <p className="text-muted-foreground mt-2 text-xs">
                {readiness.pending > 0
                  ? `${readiness.pending} protocol${readiness.pending > 1 ? "s" : ""} remaining`
                  : "All protocols completed!"}
              </p>
            </div>
          )}

          {/* Upcoming Schedule */}
          <div className="border-border bg-card flex min-h-0 flex-1 flex-col rounded-2xl border p-5 shadow-sm">
            <div className="mb-6 flex items-center justify-between">
              <h3 className="text-foreground text-lg font-extrabold">Upcoming Schedule</h3>
            </div>

            <div className="flex min-h-0 flex-1 flex-col gap-3">
              {upcomingShifts.length > 0 ? (
                upcomingShifts.map((shift: MyShift) => {
                  const dm = formatDayMonth(shift.date);
                  return (
                    <div
                      key={shift.id}
                      className="group border-border bg-muted/40 hover:bg-accent flex flex-1 cursor-pointer items-center rounded-xl border p-3 transition-colors"
                    >
                      <div className="border-border mr-3 flex w-14 flex-col items-center justify-center border-r pr-3">
                        <span className="text-muted-foreground text-[10px] font-bold uppercase">
                          {dm.weekday}
                        </span>
                        <span className="text-foreground text-lg font-black">{dm.day}</span>
                      </div>
                      <div className="flex-1">
                        <h4 className="text-foreground text-sm font-bold">{shift.role}</h4>
                        <p className="text-muted-foreground mt-0.5 text-xs font-semibold">
                          {shift.startTime} - {shift.endTime} ({shift.workHours}h)
                        </p>
                      </div>
                      <ChevronRight className="text-muted-foreground h-4 w-4 opacity-0 transition-opacity group-hover:opacity-100" />
                    </div>
                  );
                })
              ) : (
                <div className="border-border flex flex-1 items-center justify-center rounded-xl border-2 border-dashed p-6">
                  <p className="text-muted-foreground text-center text-xs font-semibold">
                    No upcoming shifts scheduled.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="flex h-full min-h-0 flex-col gap-6">
          {/* Quick Actions */}
          <div className="grid flex-shrink-0 grid-cols-2 gap-3">
            <button className="group border-border bg-card hover:bg-accent col-span-2 flex items-center justify-between rounded-xl border p-4 shadow-sm transition-all">
              <div className="flex items-center gap-3">
                <div className="bg-muted rounded-lg p-2">
                  <CalendarPlus className="text-foreground h-5 w-5" />
                </div>
                <div className="text-left">
                  <div className="text-foreground text-sm font-bold">Set Availability</div>
                  <div className="text-muted-foreground text-[10px] font-semibold">
                    For coming weeks
                  </div>
                </div>
              </div>
              <ChevronRight className="text-muted-foreground h-4 w-4 transition-transform group-hover:translate-x-1" />
            </button>

            <button className="border-border bg-card hover:bg-accent flex flex-col items-center justify-center gap-2 rounded-xl border p-4 transition-all hover:shadow-md">
              <Coffee className="text-muted-foreground h-5 w-5" />
              <span className="text-foreground text-xs font-bold">Time Off</span>
            </button>

            <button className="border-border bg-card hover:bg-accent flex flex-col items-center justify-center gap-2 rounded-xl border p-4 transition-all hover:shadow-md">
              <ArrowRightLeft className="text-muted-foreground h-5 w-5" />
              <span className="text-foreground text-xs font-bold">Swap Shift</span>
            </button>
          </div>

          {/* Open Shifts */}
          <div className="border-border bg-card flex-shrink-0 rounded-2xl border p-5 shadow-sm">
            <div className="mb-4 flex items-center gap-3">
              <div className="bg-muted rounded-md p-1.5">
                <Zap className="text-foreground h-4 w-4" />
              </div>
              <h3 className="text-foreground text-sm font-black tracking-widest uppercase">
                Open Shifts
              </h3>
            </div>

            {openShifts && openShifts.length > 0 ? (
              <>
                <p className="text-muted-foreground mb-4 text-xs font-semibold">
                  There are{" "}
                  <b className="text-foreground">
                    {openShifts.length} shift{openShifts.length > 1 ? "s" : ""}
                  </b>{" "}
                  available.
                </p>

                <div className="space-y-2">
                  {openShifts.map((shift: OpenShift) => (
                    <div
                      key={shift.schedule_shift_id}
                      className="border-border bg-muted/40 hover:bg-accent flex cursor-pointer items-center justify-between rounded-lg border p-3 text-sm transition-all"
                    >
                      <div>
                        <div className="text-foreground font-bold">
                          {formatShiftDate(shift.shift_date)}
                        </div>
                        <div className="text-muted-foreground text-[10px] font-semibold">
                          {shift.start_time} - {shift.end_time} &bull; {shift.role}
                        </div>
                      </div>
                      <button className="border-border bg-background text-foreground hover:bg-accent rounded border px-3 py-1.5 text-xs font-bold">
                        Take Shift
                      </button>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <p className="text-muted-foreground text-xs font-semibold">
                No open shifts available right now.
              </p>
            )}
          </div>

          {/* My Active Tasks */}
          <div className="border-border bg-card flex min-h-0 flex-1 flex-col rounded-2xl border p-5 shadow-sm">
            <h3 className="text-foreground mb-4 flex items-center gap-2 text-sm font-bold">
              <MapPin className="text-muted-foreground h-4 w-4" /> My Active Tasks
            </h3>

            <div className="border-border bg-muted/30 flex flex-1 items-center justify-center overflow-hidden rounded-xl border-2 border-dashed p-6">
              <div className="text-center">
                <CheckCircle2 className="text-muted-foreground mx-auto mb-2 h-8 w-8 opacity-20" />
                <p className="text-muted-foreground text-xs font-semibold">
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
