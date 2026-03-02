"use client";

import React, { useState } from "react";
import {
  Percent,
  AlertCircle,
  CheckCircle2,
  ArrowUpRight,
  ArrowDownRight,
  ShieldCheck,
  Users,
  Activity,
  Target,
  Briefcase,
  Building2,
  MapPin,
  Settings,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@smartout/ui";

const LOCATIONS = [
  { id: "all", name: "All Locations" },
  { id: "baardshaug", name: "Bårdshaug Vegkro" },
  { id: "trondheim", name: "Trondheim City" },
  { id: "oslo", name: "Oslo S (Kiosk)" },
];

const defaultMetrics = {
  all: {
    payroll: 29.0,
    turn: 14.0,
    abs: 3.9,
    onboarding: 6.2,
    compliance: 92,
    task: 88,
    pipeline: 142,
    hires: 12,
    resig: 4,
    tenure: 8.4,
  },
  baardshaug: {
    payroll: 29.2,
    turn: 12.0,
    abs: 3.1,
    onboarding: 5.8,
    compliance: 95,
    task: 91,
    pipeline: 65,
    hires: 4,
    resig: 1,
    tenure: 11.2,
  },
  trondheim: {
    payroll: 31.5,
    turn: 22.0,
    abs: 5.8,
    onboarding: 7.5,
    compliance: 85,
    task: 82,
    pipeline: 45,
    hires: 6,
    resig: 3,
    tenure: 4.5,
  },
  oslo: {
    payroll: 27.1,
    turn: 8.0,
    abs: 2.9,
    onboarding: 4.5,
    compliance: 98,
    task: 94,
    pipeline: 32,
    hires: 2,
    resig: 0,
    tenure: 9.1,
  },
};

interface StrategicViewProps {
  isDark: boolean;
}

export function StrategicView({ isDark }: StrategicViewProps) {
  const [selectedLocId, setSelectedLocId] = useState("all");
  const [targets, setTargets] = useState({
    payrollTarget: 30,
    turnoverTarget: 15,
    absenceTarget: 4,
    onboardingTarget: 7,
    taskTarget: 90,
    complianceTarget: 100,
  });
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  const data = defaultMetrics[selectedLocId as keyof typeof defaultMetrics];

  return (
    <div className="animate-in fade-in flex min-h-0 min-w-0 flex-1 flex-col gap-6 overflow-y-auto pr-2 pb-6 duration-500">
      {/* Header & Department/Location Selector */}
      <div className="flex flex-shrink-0 flex-col justify-between gap-4 pt-2 md:flex-row md:items-center">
        <div>
          <h1
            className={`text-2xl font-black tracking-tight ${isDark ? "text-zinc-100" : "text-zinc-900"}`}
          >
            Strategic Insights
          </h1>
          <p className={`text-sm ${isDark ? "text-zinc-400" : "text-zinc-500"}`}>
            Monitor workforce KPIs and organizational health.
          </p>
        </div>

        {/* Modern Pill Selector */}
        <div
          className={`flex items-center rounded-xl border p-1 ${isDark ? "border-zinc-800 bg-[#0c0c0e]" : "border-zinc-200 bg-white shadow-sm"}`}
        >
          {LOCATIONS.map((loc) => {
            const isSelected = selectedLocId === loc.id;
            return (
              <button
                key={loc.id}
                onClick={() => setSelectedLocId(loc.id)}
                className={`relative rounded-lg px-4 py-2 text-sm font-bold transition-colors ${isSelected ? (isDark ? "text-white" : "text-zinc-900") : isDark ? "text-zinc-500 hover:text-zinc-300" : "text-zinc-500 hover:text-zinc-700"}`}
              >
                {isSelected && (
                  <motion.div
                    layoutId="loc-pill"
                    className={`absolute inset-0 rounded-lg shadow-sm ${isDark ? "border border-zinc-700/50 bg-zinc-800/80" : "border border-zinc-200/50 bg-zinc-100"}`}
                    transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                  />
                )}
                <span className="relative z-10 flex items-center gap-2">
                  {loc.id === "all" ? (
                    <Building2 className="h-4 w-4" />
                  ) : (
                    <MapPin className="h-4 w-4" />
                  )}
                  {loc.name}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* SmartOut KPI Grid */}
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.div
          key={selectedLocId}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95 }}
          transition={{ duration: 0.3 }}
          className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3"
        >
          <KPICard
            isDark={isDark}
            title="Cost of Sales %"
            value={`${data.payroll}%`}
            target={`< ${targets.payrollTarget}%`}
            status={data.payroll > targets.payrollTarget ? "bad" : "good"}
            icon={<Percent className="h-5 w-5" />}
            color="emerald"
            explanation="Calculated by dividing total payroll costs by total revenue over the selected period (rolling 30 days). Adjust the target to trigger earlier warnings."
          />

          <KPICard
            isDark={isDark}
            title="90-Day Turnover"
            value={`${data.turn}%`}
            target={`< ${targets.turnoverTarget}%`}
            status={data.turn > targets.turnoverTarget ? "bad" : "good"}
            icon={<Users className="h-5 w-5" />}
            color="blue"
            explanation="Calculated by taking the number of separated employees divided by the average number of employees over 90 days. Measured against your target."
          />

          <KPICard
            isDark={isDark}
            title="Absence Rate"
            value={`${data.abs}%`}
            target={`< ${targets.absenceTarget}%`}
            status={data.abs > targets.absenceTarget ? "bad" : "good"}
            icon={<Activity className="h-5 w-5" />}
            color="orange"
            explanation="Total recorded absence hours divided by total expected working hours for the month-to-date. Used to detect early signs of team fatigue."
          />

          <KPICard
            isDark={isDark}
            title="Time to Job-Ready"
            value={`${data.onboarding}d`}
            target={`< ${targets.onboardingTarget}d`}
            status={data.onboarding > targets.onboardingTarget ? "bad" : "good"}
            icon={<Target className="h-5 w-5" />}
            color="purple"
            explanation="The average number of days between an employee's first shift and the completion of all required onboarding paths including compliance checks."
          />

          <KPICard
            isDark={isDark}
            title="Task Completion"
            value={`${data.task}%`}
            target={`> ${targets.taskTarget}%`}
            status={data.task < targets.taskTarget ? "bad" : "good"}
            icon={<CheckCircle2 className="h-5 w-5" />}
            color="indigo"
            explanation="Percentage of assigned workplace tasks (opening, closing, maintenance) completed across all shifts matching the location filter."
          />

          <KPICard
            isDark={isDark}
            title="Compliance Health"
            value={`${data.compliance}%`}
            target={`${targets.complianceTarget}%`}
            status={data.compliance < targets.complianceTarget ? "bad" : "good"}
            icon={<ShieldCheck className="h-5 w-5" />}
            color="stone"
            explanation="Percentage of active staff with fully up-to-date certifications (e.g. food safety, allergen training). Always aim for 100% compliance."
          />
        </motion.div>
      </AnimatePresence>

      {/* Main Insights Row */}
      <div className="grid min-h-0 flex-1 grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Modern Turnover Trend SVG Graph */}
        <div
          className={`relative flex min-h-[320px] flex-col overflow-hidden rounded-3xl border p-6 shadow-sm lg:col-span-2 ${isDark ? "border-zinc-800 bg-[#0c0c0e]" : "border-zinc-200 bg-white"}`}
        >
          <div className="pointer-events-none absolute top-0 right-0 h-96 w-96 rounded-full bg-blue-500/5 blur-[100px]" />

          <div className="relative z-10 mb-6 flex items-start justify-between">
            <div>
              <h2
                className={`text-xl font-extrabold ${isDark ? "text-zinc-100" : "text-zinc-800"}`}
              >
                Turnover Trend & Forecast
              </h2>
              <p className={`mt-1 max-w-xl text-sm ${isDark ? "text-zinc-400" : "text-zinc-500"}`}>
                Rolling 6-month historical data vs industry benchmark target.
              </p>
            </div>
            <button
              onClick={() => setIsSettingsOpen(true)}
              className={`flex items-center gap-2 rounded-xl border p-2 transition-colors ${isDark ? "border-zinc-800 bg-zinc-900 text-zinc-300 hover:bg-zinc-800" : "border-zinc-200 bg-zinc-50 text-zinc-700 hover:bg-zinc-100"}`}
            >
              <Settings className="h-4 w-4" />
              <span className="hidden text-xs font-bold md:inline">Configure Goals</span>
            </button>
          </div>

          <div className="relative z-10 mt-4 h-[200px] w-full flex-1">
            <TurnoverChart
              isDark={isDark}
              location={selectedLocId}
              targetLineValue={targets.turnoverTarget}
            />
          </div>
        </div>

        {/* Workforce Pipeline */}
        <div
          className={`relative flex min-h-0 flex-col overflow-hidden rounded-3xl border p-6 shadow-sm ${isDark ? "border-zinc-800 bg-[#0c0c0e]" : "border-zinc-200 bg-white"}`}
        >
          <div className="pointer-events-none absolute -bottom-12 -left-12 h-48 w-48 rounded-full bg-purple-500/5 blur-[60px]" />

          <h2
            className={`mb-5 text-lg font-extrabold ${isDark ? "text-zinc-100" : "text-zinc-800"}`}
          >
            Workforce Pipeline
          </h2>

          <div className="relative z-10 flex flex-1 flex-col justify-center space-y-6">
            <PipelineRow
              isDark={isDark}
              icon={<Users className="h-5 w-5" />}
              title="Active Staff"
              value={data.pipeline}
              subtitle="Currently Employed"
            />
            <div className={`h-px w-full ${isDark ? "bg-zinc-800" : "bg-zinc-100"}`} />
            <PipelineRow
              isDark={isDark}
              icon={<ArrowUpRight className="h-5 w-5 text-emerald-500" />}
              title="New Hires (30d)"
              value={`+${data.hires}`}
              subtitle="Onboarded"
              highlight
            />
            <div className={`h-px w-full ${isDark ? "bg-zinc-800" : "bg-zinc-100"}`} />
            <PipelineRow
              isDark={isDark}
              icon={<ArrowDownRight className="h-5 w-5 text-red-500" />}
              title="Resignations (30d)"
              value={`-${data.resig}`}
              subtitle="Departures"
              alert={data.resig > 2}
            />
            <div className={`h-px w-full ${isDark ? "bg-zinc-800" : "bg-zinc-100"}`} />
            <PipelineRow
              isDark={isDark}
              icon={<Briefcase className="h-5 w-5" />}
              title="Avg. Tenure"
              value={`${data.tenure} mo`}
              subtitle="Retention Length"
            />
          </div>
        </div>
      </div>

      {/* Target Configuration Modal */}
      <Dialog open={isSettingsOpen} onOpenChange={setIsSettingsOpen}>
        <DialogContent
          className={`${isDark ? "border-zinc-800 bg-[#0c0c0e] text-white" : "bg-white text-zinc-900"} max-w-2xl`}
        >
          <DialogHeader>
            <DialogTitle className="text-xl">Configure Workspace KPIs</DialogTitle>
            <DialogDescription className={`${isDark ? "text-zinc-400" : "text-zinc-500"}`}>
              Modify threshold targets used across all reporting logic in SmartOut. Thresholds are
              used to highlight alerts and assess overall health.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-6 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-2">
                <label
                  className={`text-sm font-bold ${isDark ? "text-zinc-300" : "text-zinc-700"}`}
                >
                  Cost of Sales Target (%)
                </label>
                <input
                  type="number"
                  value={targets.payrollTarget}
                  onChange={(e) =>
                    setTargets({ ...targets, payrollTarget: Number(e.target.value) })
                  }
                  className={`rounded-lg border px-3 py-2 focus:ring-2 focus:ring-emerald-500 focus:outline-none ${isDark ? "border-zinc-800 bg-zinc-900" : "border-zinc-200 bg-zinc-50"}`}
                />
                <span className="text-[10px] text-zinc-500">Benchmark: &lt; 30%</span>
              </div>

              <div className="flex flex-col gap-2">
                <label
                  className={`text-sm font-bold ${isDark ? "text-zinc-300" : "text-zinc-700"}`}
                >
                  Turnover Target (%)
                </label>
                <input
                  type="number"
                  value={targets.turnoverTarget}
                  onChange={(e) =>
                    setTargets({ ...targets, turnoverTarget: Number(e.target.value) })
                  }
                  className={`rounded-lg border px-3 py-2 focus:ring-2 focus:ring-emerald-500 focus:outline-none ${isDark ? "border-zinc-800 bg-zinc-900" : "border-zinc-200 bg-zinc-50"}`}
                />
                <span className="text-[10px] text-zinc-500">Benchmark: &lt; 15%</span>
              </div>

              <div className="flex flex-col gap-2">
                <label
                  className={`text-sm font-bold ${isDark ? "text-zinc-300" : "text-zinc-700"}`}
                >
                  Absence Threshold (%)
                </label>
                <input
                  type="number"
                  value={targets.absenceTarget}
                  onChange={(e) =>
                    setTargets({ ...targets, absenceTarget: Number(e.target.value) })
                  }
                  className={`rounded-lg border px-3 py-2 focus:ring-2 focus:ring-emerald-500 focus:outline-none ${isDark ? "border-zinc-800 bg-zinc-900" : "border-zinc-200 bg-zinc-50"}`}
                />
                <span className="text-[10px] text-zinc-500">Benchmark: &lt; 4%</span>
              </div>

              <div className="flex flex-col gap-2">
                <label
                  className={`text-sm font-bold ${isDark ? "text-zinc-300" : "text-zinc-700"}`}
                >
                  Time to Job-Ready Target (Days)
                </label>
                <input
                  type="number"
                  value={targets.onboardingTarget}
                  onChange={(e) =>
                    setTargets({ ...targets, onboardingTarget: Number(e.target.value) })
                  }
                  className={`rounded-lg border px-3 py-2 focus:ring-2 focus:ring-emerald-500 focus:outline-none ${isDark ? "border-zinc-800 bg-zinc-900" : "border-zinc-200 bg-zinc-50"}`}
                />
                <span className="text-[10px] text-zinc-500">Benchmark: &lt; 7 Days</span>
              </div>
            </div>
            <div
              className={`rounded-xl border p-4 ${isDark ? "border-zinc-800 bg-zinc-900/50" : "border-zinc-200 bg-zinc-50"}`}
            >
              <p className={`text-xs ${isDark ? "text-zinc-400" : "text-zinc-500"}`}>
                <b>Note on Calculations:</b> SmartOut derives these KPIs uniquely. &quot;Cost of
                Sales&quot; takes payroll directly out of Live Shift timings multiplied by hourly
                rates, and contrasts it with integrated POS revenue over that same period.
              </p>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// === Subcomponents ===

interface KPICardProps {
  isDark: boolean;
  title: string;
  value: string;
  explanation?: string;
  target: string;
  status: "good" | "bad";
  icon: React.ReactNode;
  color: string;
}

function KPICard({ isDark, title, value, explanation, target, status, icon, color }: KPICardProps) {
  const isBad = status === "bad";
  const [showExplanation, setShowExplanation] = useState(false);

  return (
    <div
      onMouseEnter={() => setShowExplanation(true)}
      onMouseLeave={() => setShowExplanation(false)}
      className={`group relative min-h-[140px] cursor-help overflow-hidden rounded-2xl border p-5 transition-all hover:shadow-md ${isDark ? "border-zinc-800 bg-[#0c0c0e] hover:border-zinc-700" : "border-zinc-200 bg-white"}`}
    >
      <AnimatePresence mode="wait">
        {!showExplanation ? (
          <motion.div
            key="front"
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -5 }}
            transition={{ duration: 0.15 }}
            className="flex h-full flex-col"
          >
            <div
              className={`absolute -top-6 -right-6 h-24 w-24 rounded-full opacity-20 blur-2xl transition-opacity group-hover:opacity-40 bg-${color}-500`}
            />
            <div className="relative z-10 mb-4 flex items-start justify-between">
              <div
                className={`rounded-xl border p-2.5 ${isDark ? "border-zinc-800 bg-zinc-900 text-zinc-300" : "border-zinc-200 bg-zinc-50 text-zinc-600"}`}
              >
                {icon}
              </div>
              {isBad ? (
                <div
                  className={`flex items-center gap-1 rounded px-2 py-1 text-[10px] font-bold tracking-widest uppercase shadow-sm ${isDark ? "border border-red-500/20 bg-red-500/10 text-red-400" : "border border-red-200 bg-red-50 text-red-600"}`}
                >
                  <AlertCircle className="h-3 w-3" /> Action
                </div>
              ) : (
                <div
                  className={`flex items-center gap-1 rounded px-2 py-1 text-[10px] font-bold tracking-widest uppercase shadow-sm ${isDark ? "border border-emerald-500/20 bg-emerald-500/10 text-emerald-400" : "border border-emerald-200 bg-emerald-50 text-emerald-600"}`}
                >
                  <CheckCircle2 className="h-3 w-3" /> OK
                </div>
              )}
            </div>
            <div className="relative z-10 flex flex-1 flex-col justify-end">
              <h3
                className={`mb-1 text-sm font-bold ${isDark ? "text-zinc-400" : "text-zinc-500"}`}
              >
                {title}
              </h3>
              <div className="flex items-end gap-3">
                <span
                  className={`text-3xl leading-none font-black ${isDark ? "text-white" : "text-zinc-900"} ${isBad ? (isDark ? "!text-red-400" : "!text-red-600") : ""}`}
                >
                  {value}
                </span>
                <span
                  className={`mb-1 text-xs font-semibold ${isDark ? "text-zinc-500" : "text-zinc-400"}`}
                >
                  target {target}
                </span>
              </div>
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="back"
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -5 }}
            transition={{ duration: 0.15 }}
            className={`relative z-10 flex h-full flex-col justify-center ${isDark ? "text-zinc-300" : "text-zinc-700"}`}
          >
            <h3 className="mb-2 text-sm font-bold break-words text-emerald-500">
              How is this calculated?
            </h3>
            <p className="text-xs leading-relaxed opacity-90">
              {explanation || "Calculation standard set by AI Council documentation."}
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function TurnoverChart({
  isDark,
  location,
  targetLineValue,
}: {
  isDark: boolean;
  location: string;
  targetLineValue: number;
}) {
  const chartData = {
    all: [14, 15, 12, 16, 13, 11],
    baardshaug: [12, 11, 10, 14, 11, 9],
    trondheim: [20, 22, 19, 25, 23, 18],
    oslo: [9, 8, 7, 10, 8, 6],
  }[location as "all" | "baardshaug" | "trondheim" | "oslo"]!;

  const maxVal = Math.max(...chartData, 30);
  const months = ["Sep", "Oct", "Nov", "Dec", "Jan", "Feb"];

  const targetPct = 100 - (targetLineValue / maxVal) * 100;

  return (
    <div className="relative flex h-full w-full items-end justify-between gap-2 pt-4 pb-6 md:gap-4">
      {/* Programmable Target Line */}
      <AnimatePresence>
        <div
          className="pointer-events-none absolute left-0 z-0 w-full border-t border-dashed border-zinc-400/30 transition-all duration-500 ease-out dark:border-zinc-600/30"
          style={{ top: `${Math.max(0, Math.min(100, targetPct))}%` }}
        >
          <span
            className={`absolute -top-3 right-0 bg-white px-2 pb-1 text-[10px] font-bold dark:bg-[#0c0c0e] ${isDark ? "text-zinc-500" : "text-zinc-400"}`}
          >
            Target {targetLineValue}%
          </span>
        </div>
      </AnimatePresence>

      {chartData.map((val, idx) => {
        const heightPct = (val / maxVal) * 100;
        const isOverTarget = val > targetLineValue;

        return (
          <div
            key={idx}
            className="group relative flex h-full flex-1 flex-col items-center justify-end"
          >
            {/* Tooltip on hover */}
            <div
              className={`pointer-events-none absolute -top-10 z-20 rounded px-2 py-1 text-xs font-bold opacity-0 shadow-lg transition-opacity group-hover:opacity-100 ${isDark ? "bg-zinc-800 text-white" : "bg-zinc-800 text-white"}`}
            >
              {val}%
            </div>

            <motion.div
              key={`${location}-${idx}`}
              initial={{ height: 0 }}
              animate={{ height: `${heightPct}%` }}
              transition={{ duration: 0.8, delay: idx * 0.1, type: "spring", bounce: 0.3 }}
              className={`relative z-10 w-full max-w-[40px] overflow-hidden rounded-t-lg transition-colors ${isOverTarget ? (isDark ? "bg-red-500/80 hover:bg-red-400" : "bg-red-500 hover:bg-red-600") : isDark ? "bg-blue-500/80 hover:bg-blue-400" : "bg-blue-500 hover:bg-blue-600"}`}
            >
              <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/20 to-transparent" />
            </motion.div>
            <span
              className={`absolute -bottom-6 text-xs font-bold ${isDark ? "text-zinc-400" : "text-zinc-500"}`}
            >
              {months[idx]}
            </span>
          </div>
        );
      })}
    </div>
  );
}

interface PipelineRowProps {
  isDark: boolean;
  icon: React.ReactNode;
  title: string;
  value: React.ReactNode;
  subtitle: string;
  highlight?: boolean;
  alert?: boolean;
}

function PipelineRow({ isDark, icon, title, value, subtitle, highlight, alert }: PipelineRowProps) {
  return (
    <div className="group flex items-center justify-between">
      <div className="flex items-center gap-3">
        <div
          className={`rounded-xl border p-2.5 transition-colors ${alert ? (isDark ? "border-red-500/20 bg-red-500/10 text-red-500" : "border-red-200 bg-red-50 text-red-600") : highlight ? (isDark ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-500" : "border-emerald-200 bg-emerald-50 text-emerald-600") : isDark ? "border-zinc-800 bg-zinc-900 text-zinc-400 group-hover:bg-zinc-800" : "border-zinc-200 bg-zinc-50 text-zinc-500 group-hover:bg-zinc-100"}`}
        >
          {icon}
        </div>
        <div>
          <h4
            className={`text-sm font-bold transition-colors ${isDark ? "text-zinc-300 group-hover:text-white" : "text-zinc-700 group-hover:text-black"}`}
          >
            {title}
          </h4>
          <p
            className={`mt-0.5 text-[10px] font-semibold tracking-wider uppercase ${isDark ? "text-zinc-500" : "text-zinc-400"}`}
          >
            {subtitle}
          </p>
        </div>
      </div>
      <div
        className={`text-xl font-black ${alert ? (isDark ? "text-red-400" : "text-red-500") : highlight ? (isDark ? "text-emerald-400" : "text-emerald-500") : isDark ? "text-white" : "text-zinc-900"}`}
      >
        {value}
      </div>
    </div>
  );
}
