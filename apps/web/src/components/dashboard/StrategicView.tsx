"use client";

import React, { useState, useRef, useEffect } from "react";
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
  Pencil,
  SlidersHorizontal,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@smartout/ui";
import { useWorkforcePipeline, useTrainingReadiness, useKpiTargets } from "@/app/dashboard/_hooks";
import type { KpiMetric } from "@/app/dashboard/_hooks";
import { BudgetSettingsPanel } from "./BudgetSettingsPanel";

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

/** Config for each KPI card: maps metric key to dialog labels and benchmarks */
const KPI_CONFIG: {
  metric: KpiMetric;
  label: string;
  unit: string;
  benchmark: string;
}[] = [
  { metric: "cost_of_sales", label: "Cost of Sales Target", unit: "%", benchmark: "< 30%" },
  { metric: "turnover_90d", label: "Turnover Target", unit: "%", benchmark: "< 15%" },
  { metric: "absence_rate", label: "Absence Threshold", unit: "%", benchmark: "< 4%" },
  {
    metric: "time_to_job_ready",
    label: "Time to Job-Ready Target",
    unit: "Days",
    benchmark: "< 7 Days",
  },
  { metric: "task_completion", label: "Task Completion Target", unit: "%", benchmark: "> 90%" },
  {
    metric: "training_readiness",
    label: "Training Readiness Target",
    unit: "%",
    benchmark: "100%",
  },
];

interface StrategicViewProps {
  isDark: boolean;
}

export function StrategicView({ isDark }: StrategicViewProps) {
  const [selectedLocId, setSelectedLocId] = useState("all");
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [showBudget, setShowBudget] = useState(false);

  const { targets, updateTarget } = useKpiTargets();

  const data = defaultMetrics[selectedLocId as keyof typeof defaultMetrics];
  const { data: pipeline } = useWorkforcePipeline();
  const { data: training } = useTrainingReadiness();

  function handleTargetSave(metric: KpiMetric, value: number) {
    updateTarget.mutate({ metric, value });
  }

  return (
    <div className="animate-in fade-in flex min-h-0 min-w-0 flex-1 flex-col gap-4 overflow-y-auto pr-2 pb-4 duration-500">
      {/* Header & Location Selector */}
      <div className="flex flex-shrink-0 flex-wrap items-center gap-3 pt-1">
        <div>
          <h1
            className={`text-base font-black tracking-tight ${isDark ? "text-zinc-100" : "text-zinc-900"}`}
          >
            Strategic Insights
          </h1>
        </div>

        <div className="bg-border h-5 w-px" />

        {/* Budget toggle - more compact */}
        <button
          onClick={() => setShowBudget(!showBudget)}
          title="Budget Settings"
          className={`flex items-center gap-1.5 rounded-lg border p-1.5 text-[10px] font-bold transition-colors ${
            showBudget
              ? isDark
                ? "border-primary/50 bg-primary/10 text-primary"
                : "border-primary/50 bg-primary/10 text-primary"
              : isDark
                ? "border-zinc-800 bg-zinc-900 text-zinc-400 hover:text-zinc-200"
                : "border-zinc-200 bg-zinc-50 text-zinc-500 hover:text-zinc-700"
          }`}
        >
          <SlidersHorizontal className="h-3.5 w-3.5" />
          <span className="hidden md:inline">Budget</span>
        </button>

        <div className="flex-1" />

        {/* Location selector - compact pills */}
        <div
          className={`flex items-center rounded-lg border p-0.5 ${isDark ? "border-zinc-800 bg-[#0c0c0e]" : "border-zinc-200 bg-white shadow-sm"}`}
        >
          {LOCATIONS.map((loc) => {
            const isSelected = selectedLocId === loc.id;
            return (
              <button
                key={loc.id}
                onClick={() => setSelectedLocId(loc.id)}
                className={`relative rounded-md px-2.5 py-1.5 text-xs font-bold transition-colors ${isSelected ? (isDark ? "text-white" : "text-zinc-900") : isDark ? "text-zinc-500 hover:text-zinc-300" : "text-zinc-500 hover:text-zinc-700"}`}
              >
                {isSelected && (
                  <motion.div
                    layoutId="loc-pill"
                    className={`absolute inset-0 rounded-md shadow-sm ${isDark ? "border border-zinc-700/50 bg-zinc-800/80" : "border border-zinc-200/50 bg-zinc-100"}`}
                    transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                  />
                )}
                <span className="relative z-10 flex items-center gap-1.5">
                  {loc.id === "all" ? (
                    <Building2 className="h-3.5 w-3.5" />
                  ) : (
                    <MapPin className="h-3.5 w-3.5" />
                  )}
                  <span className="hidden sm:inline">{loc.name}</span>
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Budget Panel or KPI Grid */}
      {showBudget ? (
        <BudgetSettingsPanel onClose={() => setShowBudget(false)} />
      ) : (
        <>
          {/* SmartOut KPI Grid */}
          <AnimatePresence mode="popLayout" initial={false}>
            <motion.div
              key={selectedLocId}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.3 }}
              className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3"
            >
              <KPICard
                isDark={isDark}
                title="Cost of Sales %"
                metric="cost_of_sales"
                value={`${data.payroll}%`}
                targetValue={targets.cost_of_sales}
                targetDisplay={`< ${targets.cost_of_sales}%`}
                status={data.payroll > targets.cost_of_sales ? "bad" : "good"}
                icon={<Percent className="h-5 w-5" />}
                color="emerald"
                unit="%"
                explanation="Calculated by dividing total payroll costs by total revenue over the selected period (rolling 30 days). Adjust the target to trigger earlier warnings."
                onTargetSave={handleTargetSave}
              />

              <KPICard
                isDark={isDark}
                title="90-Day Turnover"
                metric="turnover_90d"
                value={`${data.turn}%`}
                targetValue={targets.turnover_90d}
                targetDisplay={`< ${targets.turnover_90d}%`}
                status={data.turn > targets.turnover_90d ? "bad" : "good"}
                icon={<Users className="h-5 w-5" />}
                color="blue"
                unit="%"
                explanation="Calculated by taking the number of separated employees divided by the average number of employees over 90 days. Measured against your target."
                onTargetSave={handleTargetSave}
              />

              <KPICard
                isDark={isDark}
                title="Absence Rate"
                metric="absence_rate"
                value={`${data.abs}%`}
                targetValue={targets.absence_rate}
                targetDisplay={`< ${targets.absence_rate}%`}
                status={data.abs > targets.absence_rate ? "bad" : "good"}
                icon={<Activity className="h-5 w-5" />}
                color="orange"
                unit="%"
                explanation="Total recorded absence hours divided by total expected working hours for the month-to-date. Used to detect early signs of team fatigue."
                onTargetSave={handleTargetSave}
              />

              <KPICard
                isDark={isDark}
                title="Time to Job-Ready"
                metric="time_to_job_ready"
                value={`${data.onboarding}d`}
                targetValue={targets.time_to_job_ready}
                targetDisplay={`< ${targets.time_to_job_ready}d`}
                status={data.onboarding > targets.time_to_job_ready ? "bad" : "good"}
                icon={<Target className="h-5 w-5" />}
                color="purple"
                unit="days"
                explanation="The average number of days between an employee's first shift and the completion of all required onboarding paths including compliance checks."
                onTargetSave={handleTargetSave}
              />

              <KPICard
                isDark={isDark}
                title="Task Completion"
                metric="task_completion"
                value={`${data.task}%`}
                targetValue={targets.task_completion}
                targetDisplay={`> ${targets.task_completion}%`}
                status={data.task < targets.task_completion ? "bad" : "good"}
                icon={<CheckCircle2 className="h-5 w-5" />}
                color="indigo"
                unit="%"
                explanation="Percentage of assigned workplace tasks (opening, closing, maintenance) completed across all shifts matching the location filter."
                onTargetSave={handleTargetSave}
              />

              <KPICard
                isDark={isDark}
                title="Training Readiness"
                metric="training_readiness"
                value={
                  selectedLocId === "all" && training
                    ? `${training.readinessPercent}%`
                    : `${data.compliance}%`
                }
                targetValue={targets.training_readiness}
                targetDisplay={`${targets.training_readiness}%`}
                status={
                  (selectedLocId === "all" && training
                    ? training.readinessPercent
                    : data.compliance) < targets.training_readiness
                    ? "bad"
                    : "good"
                }
                icon={<ShieldCheck className="h-5 w-5" />}
                color="stone"
                unit="%"
                explanation="Percentage of protocol assignments completed by active staff. Measures overall workforce readiness."
                onTargetSave={handleTargetSave}
              />
            </motion.div>
          </AnimatePresence>
        </>
      )}

      {/* Main Insights Row */}
      <div className="flex min-h-0 flex-col gap-4 lg:flex-row">
        {/* Modern Turnover Trend SVG Graph */}
        <div
          className={`relative flex min-h-0 flex-col overflow-hidden rounded-2xl border p-5 shadow-sm lg:w-2/3 ${isDark ? "border-zinc-800 bg-[#0c0c0e]" : "border-zinc-200 bg-white"}`}
        >
          <div className="pointer-events-none absolute top-0 right-0 h-96 w-96 rounded-full bg-blue-500/5 blur-[100px]" />

          <div className="relative z-10 mb-3 flex items-start justify-between">
            <div>
              <h2
                className={`text-base font-extrabold ${isDark ? "text-zinc-100" : "text-zinc-800"}`}
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

          <div className="relative z-10 mt-2 h-[160px] w-full">
            <TurnoverChart
              isDark={isDark}
              location={selectedLocId}
              targetLineValue={targets.turnover_90d}
            />
          </div>
        </div>

        {/* Workforce Pipeline */}
        <div
          className={`relative flex min-h-0 flex-col overflow-hidden rounded-2xl border p-5 shadow-sm lg:w-1/3 ${isDark ? "border-zinc-800 bg-[#0c0c0e]" : "border-zinc-200 bg-white"}`}
        >
          <div className="pointer-events-none absolute -bottom-12 -left-12 h-48 w-48 rounded-full bg-purple-500/5 blur-[60px]" />

          <h2
            className={`mb-3 text-base font-extrabold ${isDark ? "text-zinc-100" : "text-zinc-800"}`}
          >
            Workforce Pipeline
          </h2>

          <div className="relative z-10 flex flex-1 flex-col justify-center space-y-4">
            <PipelineRow
              isDark={isDark}
              icon={<Users className="h-5 w-5" />}
              title="Active Staff"
              value={selectedLocId === "all" && pipeline ? pipeline.activeStaff : data.pipeline}
              subtitle="Currently Employed"
            />
            <div className={`h-px w-full ${isDark ? "bg-zinc-800" : "bg-zinc-100"}`} />
            <PipelineRow
              isDark={isDark}
              icon={<ArrowUpRight className="h-5 w-5 text-emerald-500" />}
              title="New Hires (30d)"
              value={`+${selectedLocId === "all" && pipeline ? pipeline.newHires30d : data.hires}`}
              subtitle="Onboarded"
              highlight
            />
            <div className={`h-px w-full ${isDark ? "bg-zinc-800" : "bg-zinc-100"}`} />
            <PipelineRow
              isDark={isDark}
              icon={<ArrowDownRight className="h-5 w-5 text-red-500" />}
              title="Departures (30d)"
              value={`-${selectedLocId === "all" && pipeline ? pipeline.departures30d : data.resig}`}
              subtitle="Departures"
              alert={
                (selectedLocId === "all" && pipeline ? pipeline.departures30d : data.resig) > 2
              }
            />
            <div className={`h-px w-full ${isDark ? "bg-zinc-800" : "bg-zinc-100"}`} />
            <PipelineRow
              isDark={isDark}
              icon={<Briefcase className="h-5 w-5" />}
              title="Onboarding"
              value={
                selectedLocId === "all" && pipeline ? pipeline.onboarding : `${data.tenure} mo`
              }
              subtitle={
                selectedLocId === "all" && pipeline ? "Currently in training" : "Retention Length"
              }
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
              {KPI_CONFIG.map((cfg) => (
                <DialogTargetInput
                  key={cfg.metric}
                  isDark={isDark}
                  label={`${cfg.label} (${cfg.unit})`}
                  benchmark={`Benchmark: ${cfg.benchmark}`}
                  value={targets[cfg.metric]}
                  onSave={(val) => handleTargetSave(cfg.metric, val)}
                />
              ))}
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

/** Input row used inside the Configure Goals dialog */
function DialogTargetInput({
  isDark,
  label,
  benchmark,
  value,
  onSave,
}: {
  isDark: boolean;
  label: string;
  benchmark: string;
  value: number;
  onSave: (val: number) => void;
}) {
  const [local, setLocal] = useState(value);
  const prevValue = useRef(value);

  // Sync local state when DB value changes (after mutation completes)
  useEffect(() => {
    if (prevValue.current !== value) {
      prevValue.current = value;
      setLocal(value);
    }
  }, [value]);

  return (
    <div className="flex flex-col gap-2">
      <label className={`text-sm font-bold ${isDark ? "text-zinc-300" : "text-zinc-700"}`}>
        {label}
      </label>
      <input
        type="number"
        value={local}
        onChange={(e) => setLocal(Number(e.target.value))}
        onBlur={() => {
          if (local !== value) onSave(local);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.currentTarget.blur();
          }
        }}
        className={`rounded-lg border px-3 py-2 focus:ring-2 focus:ring-emerald-500 focus:outline-none ${isDark ? "border-zinc-800 bg-zinc-900" : "border-zinc-200 bg-zinc-50"}`}
      />
      <span className="text-[10px] text-zinc-500">{benchmark}</span>
    </div>
  );
}

interface KPICardProps {
  isDark: boolean;
  title: string;
  metric: KpiMetric;
  value: string;
  explanation?: string;
  targetValue: number;
  targetDisplay: string;
  status: "good" | "bad";
  icon: React.ReactNode;
  color: string;
  unit: string;
  onTargetSave: (metric: KpiMetric, value: number) => void;
}

function KPICard({
  isDark,
  title,
  metric,
  value,
  explanation,
  targetValue,
  targetDisplay,
  status,
  icon,
  color,
  unit,
  onTargetSave,
}: KPICardProps) {
  const isBad = status === "bad";
  const [showExplanation, setShowExplanation] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editValue, setEditValue] = useState(targetValue);
  const prevTarget = useRef(targetValue);

  // Sync edit value when target changes from DB
  useEffect(() => {
    if (prevTarget.current !== targetValue) {
      prevTarget.current = targetValue;
      setEditValue(targetValue);
    }
  }, [targetValue]);

  function commitEdit() {
    if (editValue !== targetValue) {
      onTargetSave(metric, editValue);
    }
    setEditOpen(false);
  }

  return (
    <Popover open={editOpen} onOpenChange={setEditOpen}>
      <PopoverTrigger asChild>
        <div
          onMouseEnter={() => {
            if (!editOpen) setShowExplanation(true);
          }}
          onMouseLeave={() => setShowExplanation(false)}
          className={`group relative min-h-[100px] cursor-pointer overflow-hidden rounded-2xl border p-4 transition-all hover:shadow-md ${isDark ? "border-zinc-800 bg-[#0c0c0e] hover:border-zinc-700" : "border-zinc-200 bg-white"}`}
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
                <div className="relative z-10 mb-2 flex items-start justify-between">
                  <div
                    className={`rounded-xl border p-2.5 ${isDark ? "border-zinc-800 bg-zinc-900 text-zinc-300" : "border-zinc-200 bg-zinc-50 text-zinc-600"}`}
                  >
                    {icon}
                  </div>
                  <div className="flex items-center gap-2">
                    <div
                      className={`rounded p-1 opacity-0 transition-opacity group-hover:opacity-100 ${isDark ? "text-zinc-500 hover:text-zinc-300" : "text-zinc-400 hover:text-zinc-600"}`}
                    >
                      <Pencil className="h-3 w-3" />
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
                </div>
                <div className="relative z-10 flex flex-1 flex-col justify-end">
                  <h3
                    className={`mb-1 text-sm font-bold ${isDark ? "text-zinc-400" : "text-zinc-500"}`}
                  >
                    {title}
                  </h3>
                  <div className="flex items-end gap-3">
                    <span
                      className={`text-2xl leading-none font-black ${isDark ? "text-white" : "text-zinc-900"} ${isBad ? (isDark ? "!text-red-400" : "!text-red-600") : ""}`}
                    >
                      {value}
                    </span>
                    <span
                      className={`mb-1 text-xs font-semibold ${isDark ? "text-zinc-500" : "text-zinc-400"}`}
                    >
                      target {targetDisplay}
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
      </PopoverTrigger>
      <PopoverContent
        className={`w-56 ${isDark ? "border-zinc-700 bg-zinc-900 text-white" : "border-zinc-200 bg-white text-zinc-900"}`}
        side="bottom"
        align="start"
      >
        <div className="flex flex-col gap-3">
          <label className={`text-xs font-bold ${isDark ? "text-zinc-300" : "text-zinc-700"}`}>
            Edit Target ({unit})
          </label>
          <input
            type="number"
            autoFocus
            value={editValue}
            onChange={(e) => setEditValue(Number(e.target.value))}
            onKeyDown={(e) => {
              if (e.key === "Enter") commitEdit();
              if (e.key === "Escape") setEditOpen(false);
            }}
            className={`w-full rounded-lg border px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none ${isDark ? "border-zinc-700 bg-zinc-800" : "border-zinc-200 bg-zinc-50"}`}
          />
          <div className="flex items-center justify-between">
            <span className={`text-[10px] ${isDark ? "text-zinc-500" : "text-zinc-400"}`}>
              Press Enter to save
            </span>
            <button
              onClick={commitEdit}
              className="rounded-md bg-emerald-600 px-3 py-1 text-xs font-bold text-white transition-colors hover:bg-emerald-500"
            >
              Save
            </button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
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
