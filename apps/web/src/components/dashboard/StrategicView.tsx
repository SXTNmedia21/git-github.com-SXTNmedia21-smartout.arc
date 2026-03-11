"use client";

import React, { useState, useRef, useEffect } from "react";
import {
  ShieldCheck,
  Users,
  Target,
  CheckCircle2,
  Briefcase,
  ArrowUpRight,
  ArrowDownRight,
  Settings,
  BarChart3,
} from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@smartout/ui";
import {
  useWorkforcePipeline,
  useTrainingReadiness,
  useKpiTargets,
  useKpiCopy,
  useActiveSeason,
} from "@/app/dashboard/_hooks";
import type { KpiMetric } from "@/app/dashboard/_hooks";
import { BudgetSettingsPanel } from "./BudgetSettingsPanel";
import { DashboardCard } from "./DashboardCard";
import { SeasonCard } from "./SeasonCard";

interface StrategicViewProps {
  isDark: boolean;
}

export function StrategicView({ isDark }: StrategicViewProps) {
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [showBudget, setShowBudget] = useState(false);

  const { targets, updateTarget } = useKpiTargets();
  const { copy: kpiCopy } = useKpiCopy("nb");
  const { data: activeSeason } = useActiveSeason();
  const { data: pipeline } = useWorkforcePipeline();
  const { data: training } = useTrainingReadiness();

  function handleTargetSave(metric: KpiMetric, value: number) {
    updateTarget.mutate({ metric, value });
  }

  return (
    <div className="animate-in fade-in flex min-h-0 min-w-0 flex-1 flex-col gap-4 overflow-y-auto pr-2 pb-4 duration-500">
      {/* Header */}
      <div className="flex flex-shrink-0 flex-wrap items-center gap-3 pt-1">
        <div>
          <h1
            className={`text-base font-black tracking-tight ${isDark ? "text-zinc-100" : "text-zinc-900"}`}
          >
            Strategisk innsikt
          </h1>
        </div>

        <div className="bg-border h-5 w-px" />

        <button
          onClick={() => setShowBudget(!showBudget)}
          title="Budsjettinnstillinger"
          className={`flex items-center gap-1.5 rounded-lg border p-1.5 text-[10px] font-bold transition-colors ${
            showBudget
              ? "border-primary/50 bg-primary/10 text-primary"
              : isDark
                ? "border-zinc-800 bg-zinc-900 text-zinc-400 hover:text-zinc-200"
                : "border-zinc-200 bg-zinc-50 text-zinc-500 hover:text-zinc-700"
          }`}
        >
          <BarChart3 className="h-3.5 w-3.5" />
          <span className="hidden md:inline">Budsjett</span>
        </button>

        <div className="flex-1" />

        <button
          onClick={() => setIsSettingsOpen(true)}
          className={`flex items-center gap-2 rounded-xl border p-2 transition-colors ${isDark ? "border-zinc-800 bg-zinc-900 text-zinc-300 hover:bg-zinc-800" : "border-zinc-200 bg-zinc-50 text-zinc-700 hover:bg-zinc-100"}`}
        >
          <Settings className="h-4 w-4" />
          <span className="hidden text-xs font-bold md:inline">Konfigurer mål</span>
        </button>
      </div>

      {/* Budget Panel or KPI Grid */}
      {showBudget ? (
        <BudgetSettingsPanel onClose={() => setShowBudget(false)} />
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
          <KPICard
            isDark={isDark}
            title="Opplæringsberedskap"
            value={training ? `${training.readinessPercent}%` : null}
            targetDisplay={`${targets.training_readiness}%`}
            status={
              training
                ? training.readinessPercent < targets.training_readiness
                  ? "bad"
                  : "good"
                : null
            }
            icon={<ShieldCheck className="h-5 w-5" />}
            explanation={kpiCopy.training_readiness}
            metric="training_readiness"
            targetValue={targets.training_readiness}
            unit="%"
            onTargetSave={handleTargetSave}
          />

          <KPICard
            isDark={isDark}
            title="Oppgavefullfoering"
            value={null}
            targetDisplay={`> ${targets.task_completion}%`}
            status={null}
            icon={<CheckCircle2 className="h-5 w-5" />}
            explanation={kpiCopy.task_completion}
            metric="task_completion"
            targetValue={targets.task_completion}
            unit="%"
            onTargetSave={handleTargetSave}
          />

          <KPICard
            isDark={isDark}
            title="Tid til jobbklar"
            value={null}
            targetDisplay={`< ${targets.time_to_job_ready}d`}
            status={null}
            icon={<Target className="h-5 w-5" />}
            explanation={kpiCopy.time_to_job_ready}
            metric="time_to_job_ready"
            targetValue={targets.time_to_job_ready}
            unit="dager"
            onTargetSave={handleTargetSave}
          />

          <EmptyKPICard
            isDark={isDark}
            title="Varekostnad %"
            icon={<BarChart3 className="h-5 w-5" />}
          />
          <EmptyKPICard
            isDark={isDark}
            title="Personalomsetning"
            icon={<Users className="h-5 w-5" />}
          />
          <EmptyKPICard
            isDark={isDark}
            title="Fravaersrate"
            icon={<Target className="h-5 w-5" />}
          />
        </div>
      )}

      {/* Main Insights Row */}
      <div className="flex min-h-0 flex-col gap-4 lg:flex-row">
        {/* Workforce Pipeline — real data */}
        <div
          className={`relative flex min-h-0 flex-col overflow-hidden rounded-2xl border p-5 shadow-sm lg:w-1/2 ${isDark ? "border-zinc-800 bg-[#0c0c0e]" : "border-zinc-200 bg-white"}`}
        >
          <h2
            className={`mb-3 text-base font-extrabold ${isDark ? "text-zinc-100" : "text-zinc-800"}`}
          >
            Bemanningspipeline
          </h2>

          {pipeline ? (
            <div className="relative z-10 flex flex-1 flex-col justify-center space-y-4">
              <PipelineRow
                isDark={isDark}
                icon={<Users className="h-5 w-5" />}
                title="Aktive ansatte"
                value={pipeline.activeStaff}
                subtitle="Ansatt nå"
              />
              <div className={`h-px w-full ${isDark ? "bg-zinc-800" : "bg-zinc-100"}`} />
              <PipelineRow
                isDark={isDark}
                icon={<ArrowUpRight className="h-5 w-5 text-emerald-500" />}
                title="Nyansatte (30d)"
                value={`+${pipeline.newHires30d}`}
                subtitle="Onboardet"
                highlight
              />
              <div className={`h-px w-full ${isDark ? "bg-zinc-800" : "bg-zinc-100"}`} />
              <PipelineRow
                isDark={isDark}
                icon={<ArrowDownRight className="h-5 w-5 text-red-500" />}
                title="Sluttet (30d)"
                value={`-${pipeline.departures30d}`}
                subtitle="Avganger"
                alert={pipeline.departures30d > 2}
              />
              <div className={`h-px w-full ${isDark ? "bg-zinc-800" : "bg-zinc-100"}`} />
              <PipelineRow
                isDark={isDark}
                icon={<Briefcase className="h-5 w-5" />}
                title="Under opplaering"
                value={pipeline.onboarding}
                subtitle="Trainee-status"
              />
            </div>
          ) : (
            <EmptyState isDark={isDark} message="Ingen ansatte registrert ennå" />
          )}
        </div>

        {/* Training overview — real data */}
        <div
          className={`relative flex min-h-0 flex-col overflow-hidden rounded-2xl border p-5 shadow-sm lg:w-1/2 ${isDark ? "border-zinc-800 bg-[#0c0c0e]" : "border-zinc-200 bg-white"}`}
        >
          <h2
            className={`mb-3 text-base font-extrabold ${isDark ? "text-zinc-100" : "text-zinc-800"}`}
          >
            Opplaeringsstatus
          </h2>

          {training && training.totalAssignments > 0 ? (
            <div className="relative z-10 flex flex-1 flex-col justify-center space-y-4">
              <PipelineRow
                isDark={isDark}
                icon={<CheckCircle2 className="h-5 w-5 text-emerald-500" />}
                title="Fullfort"
                value={training.completed}
                subtitle={`av ${training.totalAssignments} tildelinger`}
                highlight
              />
              <div className={`h-px w-full ${isDark ? "bg-zinc-800" : "bg-zinc-100"}`} />
              <PipelineRow
                isDark={isDark}
                icon={<Target className="h-5 w-5 text-orange-500" />}
                title="Under arbeid"
                value={training.pending}
                subtitle="Venter på fullføring"
              />
              <div className={`h-px w-full ${isDark ? "bg-zinc-800" : "bg-zinc-100"}`} />
              <PipelineRow
                isDark={isDark}
                icon={<ArrowDownRight className="h-5 w-5 text-red-500" />}
                title="Utlopt"
                value={training.expired}
                subtitle="Overskredet frist"
                alert={training.expired > 0}
              />
            </div>
          ) : (
            <EmptyState isDark={isDark} message="Ingen protokoller tildelt ennå" />
          )}
        </div>
      </div>

      {/* Season Lifecycle Card */}
      <SeasonCard season={activeSeason ?? null} />

      {/* Target Configuration Modal */}
      <Dialog open={isSettingsOpen} onOpenChange={setIsSettingsOpen}>
        <DialogContent
          className={`${isDark ? "border-zinc-800 bg-[#0c0c0e] text-white" : "bg-white text-zinc-900"} max-w-2xl`}
        >
          <DialogHeader>
            <DialogTitle className="text-xl">Konfigurer arbeidsrom-KPIer</DialogTitle>
            <DialogDescription className={`${isDark ? "text-zinc-400" : "text-zinc-500"}`}>
              Endre terskelgrenser som brukes i all rapporteringslogikk i SmartOut.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-6 py-4">
            <div className="grid grid-cols-2 gap-4">
              {(
                [
                  {
                    metric: "training_readiness" as KpiMetric,
                    label: "Opplaeringsberedskap",
                    unit: "%",
                    benchmark: "100%",
                  },
                  {
                    metric: "task_completion" as KpiMetric,
                    label: "Oppgavefullfoering",
                    unit: "%",
                    benchmark: "> 90%",
                  },
                  {
                    metric: "time_to_job_ready" as KpiMetric,
                    label: "Tid til jobbklar",
                    unit: "Dager",
                    benchmark: "< 7 dager",
                  },
                  {
                    metric: "cost_of_sales" as KpiMetric,
                    label: "Varekostnad",
                    unit: "%",
                    benchmark: "< 30%",
                  },
                  {
                    metric: "turnover_90d" as KpiMetric,
                    label: "Personalomsetning",
                    unit: "%",
                    benchmark: "< 15%",
                  },
                  {
                    metric: "absence_rate" as KpiMetric,
                    label: "Fravaersrate",
                    unit: "%",
                    benchmark: "< 4%",
                  },
                ] as const
              ).map((cfg) => (
                <DialogTargetInput
                  key={cfg.metric}
                  isDark={isDark}
                  label={`${cfg.label} (${cfg.unit})`}
                  benchmark={`Referanseverdi: ${cfg.benchmark}`}
                  value={targets[cfg.metric]}
                  onSave={(val) => handleTargetSave(cfg.metric, val)}
                />
              ))}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// === Subcomponents ===

function EmptyState({ isDark, message }: { isDark: boolean; message: string }) {
  return (
    <div className="flex flex-1 items-center justify-center py-8">
      <p className={`text-sm ${isDark ? "text-zinc-600" : "text-zinc-400"}`}>{message}</p>
    </div>
  );
}

function EmptyKPICard({
  isDark,
  title,
  icon,
}: {
  isDark: boolean;
  title: string;
  icon: React.ReactNode;
}) {
  return (
    <DashboardCard
      label={title}
      value="—"
      icon={icon}
      status="good"
      explanation="Kobles til når data er tilgjengelig"
    />
  );
}

type KPICardProps = {
  isDark: boolean;
  title: string;
  value: string | null;
  targetDisplay: string;
  status: "good" | "bad" | null;
  icon: React.ReactNode;
  explanation?: string;
  metric: KpiMetric;
  targetValue: number;
  unit: string;
  onTargetSave: (metric: KpiMetric, value: number) => void;
};

function KPICard({
  isDark,
  title,
  value,
  targetDisplay,
  status,
  icon,
  explanation,
  metric,
  targetValue,
  unit,
  onTargetSave,
}: KPICardProps) {
  if (value === null) {
    return <EmptyKPICard isDark={isDark} title={title} icon={icon} />;
  }

  return (
    <DashboardCard
      label={title}
      value={value}
      icon={icon}
      status={status ?? "good"}
      explanation={explanation}
      target={`mål ${targetDisplay}`}
    />
  );
}

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
