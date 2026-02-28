"use client";

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
  ListTodo,
} from "lucide-react";

interface EmployeeDashboardProps {
  isDark: boolean;
}

export default function EmployeeDashboard({ isDark }: EmployeeDashboardProps) {
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
          Your upcoming shifts, tasks, and quick actions at Bårdshaug Vegkro.
        </p>
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Left Column: Shifts */}
        <div className="flex h-full min-h-0 flex-col gap-6 lg:col-span-2">
          {/* Today's Shift */}
          <div className="group relative flex-shrink-0">
            {/* Glow effect */}
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
                  Wed, Feb 26
                </div>
              </div>

              <div className="flex items-center gap-6">
                <div
                  className={`flex h-16 w-16 flex-col items-center justify-center rounded-2xl border ${isDark ? "border-zinc-800 bg-zinc-900" : "border-zinc-200 bg-zinc-50"}`}
                >
                  <span
                    className={`text-2xl font-black ${isDark ? "text-white" : "text-zinc-900"}`}
                  >
                    15
                  </span>
                  <span
                    className={`text-[10px] font-bold uppercase ${isDark ? "text-zinc-400" : "text-zinc-500"}`}
                  >
                    Feb
                  </span>
                </div>

                <div className="flex-1">
                  <h2
                    className={`mb-1 text-2xl font-black ${isDark ? "text-white" : "text-zinc-900"}`}
                  >
                    Service • Evening
                  </h2>
                  <div
                    className={`flex items-center gap-4 text-sm font-semibold ${isDark ? "text-zinc-400" : "text-zinc-500"}`}
                  >
                    <div className="flex items-center gap-1.5 text-orange-500">
                      <Clock className="h-4 w-4" />
                      15:00 - 23:30 (8.5h)
                    </div>
                    <div className="flex items-center gap-1.5">
                      <MapPin className="h-4 w-4" />
                      Main Restaurant
                    </div>
                  </div>
                </div>

                <button
                  className={`w-32 rounded-xl py-3 text-sm font-bold shadow-md transition-all hover:scale-105 active:scale-95 ${isDark ? "bg-white text-zinc-900 hover:bg-zinc-200" : "bg-zinc-900 text-white hover:bg-zinc-800"}`}
                >
                  Punch In
                </button>
              </div>

              {/* Shift Details/Tasks Preview */}
              <div
                className={`mt-6 border-t border-dashed pt-5 ${isDark ? "border-zinc-800" : "border-zinc-200"}`}
              >
                <h3
                  className={`mb-3 text-xs font-bold tracking-wide uppercase ${isDark ? "text-zinc-400" : "text-zinc-500"}`}
                >
                  Shift Colleagues
                </h3>
                <div className="flex flex-wrap gap-2">
                  {["Kari (Shift Lead)", "Per", "Jon", "Morten (Bar)"].map((name, i) => (
                    <div
                      key={i}
                      className={`flex items-center justify-center rounded-lg border px-3 py-1.5 text-xs font-semibold ${isDark ? "border-zinc-800 bg-zinc-900/50 text-zinc-300" : "border-zinc-200 bg-zinc-50 text-zinc-700"}`}
                    >
                      {name}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Upcoming Schedule list */}
          <div
            className={`flex min-h-0 flex-1 flex-col rounded-2xl border p-5 shadow-sm ${isDark ? "border-zinc-800 bg-[#0c0c0e]" : "border-zinc-200 bg-white"}`}
          >
            <div className="mb-6 flex items-center justify-between">
              <h3
                className={`text-lg font-extrabold ${isDark ? "text-zinc-100" : "text-zinc-800"}`}
              >
                Upcoming Schedule
              </h3>
              <button
                className={`flex items-center gap-1 text-sm font-bold ${isDark ? "text-indigo-400 hover:text-indigo-300" : "text-indigo-600 hover:text-indigo-500"}`}
              >
                View Full Calendar <ChevronRight className="h-4 w-4" />
              </button>
            </div>

            <div className="flex min-h-0 flex-1 flex-col gap-3">
              {[
                {
                  date: "Thu, Feb 27",
                  time: "15:00 - 23:30",
                  role: "Service • Evening",
                  type: "regular",
                },
                { date: "Fri, Feb 28", time: "17:00 - 01:00", role: "Bar • Event", type: "event" },
              ].map((shift, i) => (
                <div
                  key={i}
                  className={`group flex flex-1 cursor-pointer items-center rounded-xl border p-3 transition-colors ${isDark ? "border-zinc-800 bg-zinc-900/40 hover:border-zinc-700 hover:bg-zinc-800/80" : "border-zinc-200 bg-zinc-50/50 hover:border-zinc-300 hover:bg-zinc-100"}`}
                >
                  <div
                    className={`mr-3 flex w-14 flex-col items-center justify-center border-r pr-3 ${isDark ? "border-zinc-800" : "border-zinc-200"}`}
                  >
                    <span
                      className={`text-[10px] font-bold uppercase ${isDark ? "text-zinc-400" : "text-zinc-500"}`}
                    >
                      {shift.date.split(",")[0]}
                    </span>
                    <span
                      className={`text-lg font-black ${isDark ? "text-white" : "text-zinc-900"}`}
                    >
                      {shift.date.split(" ")[2]}
                    </span>
                  </div>
                  <div className="flex-1">
                    <h4
                      className={`flex items-center gap-2 text-sm font-bold ${isDark ? "text-zinc-200" : "text-zinc-800"}`}
                    >
                      {shift.role}
                      {shift.type === "event" && (
                        <span
                          className={`rounded border px-1.5 py-0.5 text-[9px] uppercase ${isDark ? "border-indigo-500/20 bg-indigo-500/10 text-indigo-400" : "border-indigo-200 bg-indigo-50 text-indigo-600"}`}
                        >
                          Event
                        </span>
                      )}
                    </h4>
                    <p
                      className={`mt-0.5 text-xs font-semibold ${isDark ? "text-zinc-400" : "text-zinc-500"}`}
                    >
                      {shift.time}
                    </p>
                  </div>
                  <ChevronRight
                    className={`h-4 w-4 opacity-0 transition-opacity group-hover:opacity-100 ${isDark ? "text-zinc-600" : "text-zinc-400"}`}
                  />
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right Column: Actions & Open Shifts */}
        <div className="flex h-full min-h-0 flex-col gap-6">
          {/* Quick Actions Grid */}
          <div className="grid flex-shrink-0 grid-cols-2 gap-3">
            <button
              className={`group col-span-2 flex items-center justify-between rounded-xl border p-4 shadow-sm transition-all hover:scale-[1.02] active:scale-[0.98] ${isDark ? "border-indigo-500/30 bg-gradient-to-br from-indigo-900/40 to-indigo-900/10" : "border-indigo-200 bg-gradient-to-br from-indigo-50 to-white"} `}
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

          {/* Open Shifts Banner */}
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

            <p
              className={`mb-4 text-xs font-semibold ${isDark ? "text-zinc-400" : "text-zinc-600"}`}
            >
              There are <b className={isDark ? "text-emerald-400" : "text-emerald-600"}>2 shifts</b>{" "}
              available matching your skills.
            </p>

            <div className="space-y-2">
              <div
                className={`flex items-center justify-between rounded-lg border p-3 text-sm ${isDark ? "border-emerald-900/50 bg-black/20 hover:bg-black/40" : "border-emerald-100 bg-white hover:shadow-sm"} cursor-pointer transition-all`}
              >
                <div>
                  <div className={`font-bold ${isDark ? "text-zinc-200" : "text-zinc-800"}`}>
                    Sat, Mar 1
                  </div>
                  <div
                    className={`text-[10px] font-semibold ${isDark ? "text-zinc-500" : "text-zinc-500"}`}
                  >
                    15:00 - 23:30 • Service
                  </div>
                </div>
                <button
                  className={`rounded border px-3 py-1.5 text-xs font-bold ${isDark ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20" : "border-emerald-200 bg-emerald-50 text-emerald-600 hover:bg-emerald-100"}`}
                >
                  Take Shift
                </button>
              </div>
            </div>
          </div>

          {/* Ongoing Tasks Context */}
          <div
            className={`flex min-h-0 flex-1 flex-col rounded-2xl border p-5 ${isDark ? "border-zinc-800 bg-[#0c0c0e]" : "border-zinc-200 bg-white"}`}
          >
            <h3
              className={`mb-4 flex items-center gap-2 text-sm font-bold ${isDark ? "text-zinc-100" : "text-zinc-800"}`}
            >
              <ListTodo className="h-4 w-4 text-purple-500" /> My Active Tasks
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
