"use client";

import {
  Calendar,
  TrendingUp,
  Percent,
  Clock,
  AlertCircle,
  CheckCircle2,
  ShieldCheck,
} from "lucide-react";

interface TacticalViewProps {
  isDark: boolean;
}

export function TacticalView({ isDark }: TacticalViewProps) {
  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 flex min-h-0 min-w-0 flex-1 flex-col gap-3 overflow-y-auto pr-2 pb-2 duration-500">
      {/* Top Metrics Row */}
      <div className="grid flex-shrink-0 grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
        {/* Payroll Cost */}
        <div
          className={`group relative overflow-hidden rounded-2xl border p-5 ${isDark ? "border-zinc-800/50 bg-zinc-950" : "border-zinc-200 bg-white"}`}
        >
          <div className="absolute -top-4 -right-4 h-24 w-24 rounded-full bg-emerald-500/10 blur-2xl transition-colors group-hover:bg-emerald-500/20" />
          <div className="relative z-10 mb-3 flex items-center gap-3">
            <div
              className={`rounded-lg border p-2 ${isDark ? "border-zinc-800 bg-zinc-900 text-emerald-400" : "border-emerald-100 bg-emerald-50 text-emerald-600"}`}
            >
              <TrendingUp className="h-4 w-4" />
            </div>
            <h3
              className={`text-xs font-bold tracking-widest uppercase ${isDark ? "text-zinc-400" : "text-zinc-500"}`}
            >
              Weekly Payroll
            </h3>
          </div>
          <div className="relative z-10 flex items-end gap-2">
            <span
              className={`text-3xl leading-none font-bold ${isDark ? "text-white" : "text-zinc-900"}`}
            >
              142k NOK
            </span>
            <span
              className={`mb-0.5 text-sm font-medium ${isDark ? "text-zinc-400" : "text-zinc-500"}`}
            >
              vs 145k budget
            </span>
          </div>
        </div>

        {/* Payroll % */}
        <div
          className={`group relative overflow-hidden rounded-2xl border p-5 ${isDark ? "border-zinc-800/50 bg-zinc-950" : "border-zinc-200 bg-white"}`}
        >
          <div className="absolute -top-4 -right-4 h-24 w-24 rounded-full bg-blue-500/10 blur-2xl transition-colors group-hover:bg-blue-500/20" />
          <div className="relative z-10 mb-3 flex items-center gap-3">
            <div
              className={`rounded-lg border p-2 ${isDark ? "border-zinc-800 bg-zinc-900 text-blue-400" : "border-blue-100 bg-blue-50 text-blue-600"}`}
            >
              <Percent className="h-4 w-4" />
            </div>
            <h3
              className={`text-xs font-bold tracking-widest uppercase ${isDark ? "text-zinc-400" : "text-zinc-500"}`}
            >
              Cost of Sales %
            </h3>
          </div>
          <div className="relative z-10 flex items-end gap-2">
            <span
              className={`text-3xl leading-none font-bold ${isDark ? "text-white" : "text-zinc-900"}`}
            >
              28.3%
            </span>
            <span className="mb-0.5 text-sm font-medium text-emerald-500">target &lt;30%</span>
          </div>
        </div>

        {/* Absence Rate */}
        <div
          className={`group relative cursor-pointer overflow-hidden rounded-2xl border p-5 transition-colors hover:border-orange-500/30 ${isDark ? "border-zinc-800/50 bg-zinc-950" : "border-zinc-200 bg-white"}`}
        >
          <div className="absolute -top-4 -right-4 h-24 w-24 rounded-full bg-orange-500/10 blur-2xl transition-colors group-hover:bg-orange-500/20" />
          <div className="relative z-10 mb-3 flex items-center gap-3">
            <div
              className={`rounded-lg border p-2 ${isDark ? "border-orange-500/20 bg-orange-500/10 text-orange-500" : "border-orange-200 bg-orange-50 text-orange-600"}`}
            >
              <AlertCircle className="h-4 w-4" />
            </div>
            <h3
              className={`text-xs font-bold tracking-widest uppercase ${isDark ? "text-zinc-400" : "text-zinc-500"}`}
            >
              Absence (MTD)
            </h3>
          </div>
          <div className="relative z-10 flex items-end gap-2">
            <span
              className={`text-3xl leading-none font-bold ${isDark ? "text-orange-400" : "text-orange-600"}`}
            >
              4.2%
            </span>
            <span
              className={`mb-0.5 text-sm font-medium ${isDark ? "text-zinc-400" : "text-zinc-500"}`}
            >
              up 0.8%
            </span>
          </div>
        </div>

        {/* Overtime */}
        <div
          className={`group relative overflow-hidden rounded-2xl border p-5 ${isDark ? "border-zinc-800/50 bg-zinc-950" : "border-zinc-200 bg-white"}`}
        >
          <div className="absolute -top-4 -right-4 h-24 w-24 rounded-full bg-indigo-500/10 blur-2xl transition-colors group-hover:bg-indigo-500/20" />
          <div className="relative z-10 mb-3 flex items-center gap-3">
            <div
              className={`rounded-lg border p-2 ${isDark ? "border-zinc-800 bg-zinc-900 text-indigo-400" : "border-indigo-100 bg-indigo-50 text-indigo-600"}`}
            >
              <Clock className="h-4 w-4" />
            </div>
            <h3
              className={`text-xs font-bold tracking-widest uppercase ${isDark ? "text-zinc-400" : "text-zinc-500"}`}
            >
              Overtime Hrs
            </h3>
          </div>
          <div className="relative z-10 flex items-end gap-2">
            <span
              className={`text-3xl leading-none font-bold ${isDark ? "text-white" : "text-zinc-900"}`}
            >
              23h
            </span>
            <span className="mb-0.5 text-sm font-medium text-emerald-500">down 5h</span>
          </div>
        </div>
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-1 gap-3 lg:grid-cols-3">
        {/* Main Weekly Schedule Overview */}
        <div
          className={`flex min-h-0 flex-col rounded-2xl border p-4 shadow-sm lg:col-span-2 ${isDark ? "border-zinc-800 bg-[#0c0c0e]" : "border-zinc-200 bg-white"}`}
        >
          <div className="mb-4 flex items-center justify-between">
            <h2 className={`text-xl font-extrabold ${isDark ? "text-zinc-100" : "text-zinc-800"}`}>
              Staffing Coverage (Week 9)
            </h2>
            <button
              className={`rounded-lg border px-3 py-1.5 text-sm font-semibold transition-colors ${isDark ? "border-zinc-700 text-zinc-300 hover:bg-zinc-800" : "border-zinc-200 text-zinc-700 hover:bg-zinc-50"}`}
            >
              View Schedule Details
            </button>
          </div>

          <div className="flex min-h-0 flex-1 flex-col justify-around">
            {[
              {
                day: "Mon",
                status: "OK",
                fill: "100%",
                color: isDark ? "bg-emerald-500/80" : "bg-emerald-500",
              },
              {
                day: "Tue",
                status: "OK",
                fill: "100%",
                color: isDark ? "bg-emerald-500/80" : "bg-emerald-500",
              },
              {
                day: "Wed",
                status: "Alert",
                fill: "85%",
                color: isDark ? "bg-orange-500/80" : "bg-orange-500",
                note: "1 Short (Evening)",
              },
              {
                day: "Thu",
                status: "OK",
                fill: "100%",
                color: isDark ? "bg-emerald-500/80" : "bg-emerald-500",
              },
              {
                day: "Fri",
                status: "OK",
                fill: "100%",
                color: isDark ? "bg-emerald-500/80" : "bg-emerald-500",
              },
              {
                day: "Sat",
                status: "Alert",
                fill: "90%",
                color: isDark ? "bg-orange-500/80" : "bg-orange-500",
                note: "High volume expected",
              },
              {
                day: "Sun",
                status: "Alert",
                fill: "70%",
                color: isDark ? "bg-red-500/80" : "bg-red-500",
                note: "2 Open Shifts",
              },
            ].map((d, i) => (
              <div key={i} className="group flex items-center gap-4">
                <span
                  className={`w-10 text-sm font-bold ${isDark ? "text-zinc-400" : "text-zinc-500"}`}
                >
                  {d.day}
                </span>
                <div
                  className={`relative h-6 flex-1 overflow-hidden rounded-lg ${isDark ? "bg-zinc-800/50" : "bg-zinc-100"}`}
                >
                  <div
                    className={`h-full ${d.color} transition-all duration-1000 ease-out`}
                    style={{ width: d.fill }}
                  />
                </div>
                <div className="flex w-32 items-center justify-end gap-2">
                  {d.note && (
                    <span
                      className={`text-xs font-semibold ${d.status === "Alert" ? (isDark ? "text-orange-400" : "text-orange-500") : isDark ? "text-zinc-400" : "text-zinc-500"}`}
                    >
                      {d.note}
                    </span>
                  )}
                  {d.status === "OK" ? (
                    <CheckCircle2
                      className={`h-4 w-4 ${isDark ? "text-emerald-500" : "text-emerald-500"}`}
                    />
                  ) : (
                    <AlertCircle
                      className={`h-4 w-4 ${isDark ? "text-orange-500" : "text-orange-500"}`}
                    />
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Sidebar Widgets */}
        <div className="flex h-full min-h-0 flex-col gap-3">
          {/* Team Health / Compliance */}
          <div
            className={`flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border p-4 shadow-sm ${isDark ? "border-zinc-800 bg-[#0c0c0e]" : "border-zinc-200 bg-white"}`}
          >
            <h3
              className={`mb-3 flex items-center gap-2 text-sm font-bold tracking-widest uppercase ${isDark ? "text-zinc-400" : "text-zinc-500"}`}
            >
              <ShieldCheck className="h-4 w-4 text-orange-500" />
              Training & Compliance
            </h3>
            <div className="flex min-h-0 flex-1 flex-col justify-around gap-3 overflow-hidden">
              <div
                className={`rounded-lg border p-3 ${isDark ? "border-red-500/20 bg-red-500/5" : "border-red-200 bg-red-50"}`}
              >
                <div className="flex items-start gap-3">
                  <AlertCircle
                    className={`mt-0.5 h-4 w-4 ${isDark ? "text-red-400" : "text-red-500"}`}
                  />
                  <div>
                    <h4 className={`text-sm font-bold ${isDark ? "text-red-400" : "text-red-700"}`}>
                      Allergen Certificate Expiring
                    </h4>
                    <p className={`mt-1 text-xs ${isDark ? "text-red-300/70" : "text-red-600/80"}`}>
                      2 staff members (Kari, Ole) have certificates expiring in{" "}
                      <b className="font-extrabold">3 days</b>.
                    </p>
                    <button
                      className={`mt-2 rounded bg-red-500/20 px-2.5 py-1 text-xs font-bold text-red-700 transition-colors hover:bg-red-500/30 ${isDark ? "bg-red-500/20 text-red-300 hover:bg-red-500/40" : ""}`}
                    >
                      Notify Staff
                    </button>
                  </div>
                </div>
              </div>

              <div
                className={`flex items-center justify-between rounded-lg border p-3 ${isDark ? "border-zinc-800 bg-zinc-900" : "border-zinc-200 bg-zinc-50"}`}
              >
                <div>
                  <h4 className={`text-sm font-bold ${isDark ? "text-zinc-300" : "text-zinc-700"}`}>
                    Avg. Onboarding Time
                  </h4>
                  <p className={`mt-0.5 text-xs ${isDark ? "text-zinc-500" : "text-zinc-500"}`}>
                    Time to &quot;Job Ready&quot;
                  </p>
                </div>
                <div className="text-right">
                  <div className={`text-xl font-black ${isDark ? "text-white" : "text-zinc-900"}`}>
                    6.2d
                  </div>
                  <div className="text-[10px] font-bold text-emerald-500">Target &lt; 7d</div>
                </div>
              </div>
            </div>
          </div>

          {/* Upcoming Events */}
          <div
            className={`flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border p-4 shadow-sm ${isDark ? "border-zinc-800 bg-[#0c0c0e]" : "border-zinc-200 bg-white"}`}
          >
            <h3
              className={`mb-3 flex items-center gap-2 text-sm font-bold tracking-widest uppercase ${isDark ? "text-zinc-400" : "text-zinc-500"}`}
            >
              <Calendar className="h-4 w-4 text-blue-500" />
              Upcoming Events (Impact)
            </h3>
            <div className="flex min-h-0 flex-1 flex-col justify-around gap-4 overflow-hidden">
              <div className="relative border-l-2 border-orange-500 pl-4">
                <div
                  className={`absolute top-1.5 -left-[5px] h-2 w-2 rounded-full bg-orange-500`}
                />
                <p
                  className={`text-xs font-bold uppercase ${isDark ? "text-orange-400" : "text-orange-600"}`}
                >
                  Fri, Feb 28
                </p>
                <h4
                  className={`mt-0.5 text-sm font-bold ${isDark ? "text-zinc-200" : "text-zinc-800"}`}
                >
                  Private Banquet (40 pax)
                </h4>
                <p
                  className={`mt-1 inline-block rounded border bg-orange-500/10 px-2 py-0.5 text-xs font-medium text-orange-600 ${isDark ? "border-orange-500/20 text-orange-400" : "border-orange-200"}`}
                >
                  Requires +3 Service Staff
                </p>
              </div>

              <div className="relative border-l-2 border-zinc-300 pl-4 dark:border-zinc-700">
                <div
                  className={`absolute h-2 w-2 rounded-full ${isDark ? "bg-zinc-700" : "bg-zinc-300"} top-1.5 -left-[5px]`}
                />
                <p
                  className={`text-xs font-bold uppercase ${isDark ? "text-zinc-400" : "text-zinc-500"}`}
                >
                  Sat, Mar 1
                </p>
                <h4
                  className={`mt-0.5 text-sm font-bold ${isDark ? "text-zinc-300" : "text-zinc-700"}`}
                >
                  Local Football Match
                </h4>
                <p className={`mt-1 text-xs ${isDark ? "text-zinc-500" : "text-zinc-500"}`}>
                  Expected +20% walk-in volume
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
