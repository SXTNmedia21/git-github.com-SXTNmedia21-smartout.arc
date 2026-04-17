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
import { useWorkforcePipeline } from "@/app/dashboard/_hooks/use-workforce-pipeline";
import { useTrainingReadiness } from "@/app/dashboard/_hooks/use-training-readiness";
import { useKpiTargets, type KpiMetric } from "@/app/dashboard/_hooks/use-kpi-targets";
import { useKpiCopy } from "@/app/dashboard/_hooks/use-kpi-copy";
import { useActiveSeason } from "@/app/dashboard/_hooks/use-active-season";
import { useAbsenceRate } from "@/app/dashboard/_hooks/use-absence-rate";
import { useStaffTurnover } from "@/app/dashboard/_hooks/use-staff-turnover";
import { useTaskCompletion } from "@/app/dashboard/_hooks/use-task-completion";
import { useTimeToJobReady } from "@/app/dashboard/_hooks/use-time-to-job-ready";
import { BudgetSettingsPanel } from "./BudgetSettingsPanel";
import { DashboardCard } from "./DashboardCard";
import { SeasonCard } from "./SeasonCard";

export function StrategicView() {
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [showBudget, setShowBudget] = useState(false);

  const { targets, updateTarget } = useKpiTargets();
  const { copy: kpiCopy } = useKpiCopy("nb");
  const { data: activeSeason } = useActiveSeason();
  const { data: pipeline } = useWorkforcePipeline();
  const { data: training } = useTrainingReadiness();
  const { data: absenceData } = useAbsenceRate();
  const { data: turnoverData } = useStaffTurnover();
  const { data: taskCompletionData } = useTaskCompletion();
  const { data: timeToJobReadyData } = useTimeToJobReady();

  function handleTargetSave(metric: KpiMetric, value: number) {
    updateTarget.mutate({ metric, value });
  }

  return (
    <div className="animate-in fade-in flex min-h-0 min-w-0 flex-1 flex-col gap-4 overflow-y-auto pr-2 pb-4 duration-500">
      {/* Header */}
      <div className="flex flex-shrink-0 flex-wrap items-center gap-3 pt-1">
        <div>
          <h1 className="text-foreground text-base font-black tracking-tight">
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
              : "border-border bg-muted text-muted-foreground hover:text-foreground"
          }`}
        >
          <BarChart3 className="h-3.5 w-3.5" />
          <span className="hidden md:inline">Budsjett</span>
        </button>

        <div className="flex-1" />

        <button
          onClick={() => setIsSettingsOpen(true)}
          className="border-border bg-muted text-muted-foreground hover:bg-muted/80 flex items-center gap-2 rounded-xl border p-2 transition-colors"
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
            title="Oppgavefullfoering"
            value={taskCompletionData ? `${taskCompletionData.rate}%` : null}
            targetDisplay={`> ${targets.task_completion}%`}
            status={
              taskCompletionData
                ? taskCompletionData.rate < targets.task_completion
                  ? "bad"
                  : "good"
                : null
            }
            icon={<CheckCircle2 className="h-5 w-5" />}
            explanation={kpiCopy.task_completion}
            metric="task_completion"
            targetValue={targets.task_completion}
            unit="%"
            onTargetSave={handleTargetSave}
          />

          <KPICard
            title="Tid til jobbklar"
            value={
              timeToJobReadyData && timeToJobReadyData.sampleSize > 0
                ? `${timeToJobReadyData.averageDays}d`
                : null
            }
            targetDisplay={`< ${targets.time_to_job_ready}d`}
            status={
              timeToJobReadyData && timeToJobReadyData.sampleSize > 0
                ? timeToJobReadyData.averageDays > targets.time_to_job_ready
                  ? "bad"
                  : "good"
                : null
            }
            icon={<Target className="h-5 w-5" />}
            explanation={kpiCopy.time_to_job_ready}
            metric="time_to_job_ready"
            targetValue={targets.time_to_job_ready}
            unit="dager"
            onTargetSave={handleTargetSave}
          />

          <KPICard
            title="Varekostnad %"
            value={null}
            targetDisplay={`< ${targets.cost_of_sales}%`}
            status={null}
            icon={<BarChart3 className="h-5 w-5" />}
            explanation="Kobles til regnskap. Krever integrasjon med varesystem."
            metric="cost_of_sales"
            targetValue={targets.cost_of_sales}
            unit="%"
            onTargetSave={handleTargetSave}
          />
          <KPICard
            title="Personalomsetning"
            value={turnoverData ? `${turnoverData.rate}%` : null}
            targetDisplay={`< ${targets.turnover_90d}%`}
            status={
              turnoverData ? (turnoverData.rate > targets.turnover_90d ? "bad" : "good") : null
            }
            icon={<Users className="h-5 w-5" />}
            explanation={kpiCopy.turnover_90d}
            metric="turnover_90d"
            targetValue={targets.turnover_90d}
            unit="%"
            onTargetSave={handleTargetSave}
          />
          <KPICard
            title="Fravaersrate"
            value={absenceData ? `${absenceData.rate}%` : null}
            targetDisplay={`< ${targets.absence_rate}%`}
            status={absenceData ? (absenceData.rate > targets.absence_rate ? "bad" : "good") : null}
            icon={<Target className="h-5 w-5" />}
            explanation={kpiCopy.absence_rate}
            metric="absence_rate"
            targetValue={targets.absence_rate}
            unit="%"
            onTargetSave={handleTargetSave}
          />
        </div>
      )}

      {/* Main Insights Row */}
      <div className="flex min-h-0 flex-col gap-4 lg:flex-row">
        {/* Workforce Pipeline — real data */}
        <div className="border-border bg-background relative flex min-h-0 flex-col overflow-hidden rounded-2xl border p-5 shadow-sm lg:w-1/2">
          <h2 className="text-foreground mb-3 text-base font-extrabold">Bemanningspipeline</h2>

          {pipeline ? (
            <div className="relative z-10 flex flex-1 flex-col justify-center space-y-4">
              <PipelineRow
                icon={<Users className="h-5 w-5" />}
                title="Aktive ansatte"
                value={pipeline.activeStaff}
                subtitle="Ansatt nå"
              />
              <div className="bg-border h-px w-full" />
              <PipelineRow
                icon={<ArrowUpRight className="text-success h-5 w-5" />}
                title="Nyansatte (30d)"
                value={`+${pipeline.newHires30d}`}
                subtitle="Onboardet"
                highlight
              />
              <div className="bg-border h-px w-full" />
              <PipelineRow
                icon={<ArrowDownRight className="text-destructive h-5 w-5" />}
                title="Sluttet (30d)"
                value={`-${pipeline.departures30d}`}
                subtitle="Avganger"
                alert={pipeline.departures30d > 2}
              />
              <div className="bg-border h-px w-full" />
              <PipelineRow
                icon={<Briefcase className="h-5 w-5" />}
                title="Under opplaering"
                value={pipeline.onboarding}
                subtitle="Trainee-status"
              />
            </div>
          ) : (
            <EmptyState message="Ingen ansatte registrert ennå" />
          )}
        </div>

        {/* Training overview — real data */}
        <div className="border-border bg-background relative flex min-h-0 flex-col overflow-hidden rounded-2xl border p-5 shadow-sm lg:w-1/2">
          <h2 className="text-foreground mb-3 text-base font-extrabold">Opplaeringsstatus</h2>

          {training && training.totalAssignments > 0 ? (
            <div className="relative z-10 flex flex-1 flex-col justify-center space-y-4">
              <PipelineRow
                icon={<CheckCircle2 className="text-success h-5 w-5" />}
                title="Fullfort"
                value={training.completed}
                subtitle={`av ${training.totalAssignments} tildelinger`}
                highlight
              />
              <div className="bg-border h-px w-full" />
              <PipelineRow
                icon={<Target className="text-warning h-5 w-5" />}
                title="Under arbeid"
                value={training.pending}
                subtitle="Venter på fullføring"
              />
              <div className="bg-border h-px w-full" />
              <PipelineRow
                icon={<ArrowDownRight className="text-destructive h-5 w-5" />}
                title="Utlopt"
                value={training.expired}
                subtitle="Overskredet frist"
                alert={training.expired > 0}
              />
            </div>
          ) : (
            <EmptyState message="Ingen protokoller tildelt ennå" />
          )}
        </div>
      </div>

      {/* Season Lifecycle Card */}
      <SeasonCard season={activeSeason ?? null} />

      {/* Target Configuration Modal */}
      <Dialog open={isSettingsOpen} onOpenChange={setIsSettingsOpen}>
        <DialogContent className="border-border bg-background text-foreground max-w-2xl">
          <DialogHeader>
            <DialogTitle className="text-xl">Konfigurer arbeidsrom-KPIer</DialogTitle>
            <DialogDescription className="text-muted-foreground">
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

function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex flex-1 items-center justify-center py-8">
      <p className="text-muted-foreground text-sm">{message}</p>
    </div>
  );
}

function EmptyKPICard({ title, icon }: { title: string; icon: React.ReactNode }) {
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
  title,
  value,
  targetDisplay,
  status,
  icon,
  explanation,
  metric: _metric,
  targetValue: _targetValue,
  unit: _unit,
  onTargetSave: _onTargetSave,
}: KPICardProps) {
  if (value === null) {
    return <EmptyKPICard title={title} icon={icon} />;
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
  label,
  benchmark,
  value,
  onSave,
}: {
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
      <label className="text-secondary-foreground text-sm font-bold">{label}</label>
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
        className="border-border bg-muted focus:ring-primary rounded-lg border px-3 py-2 focus:ring-2 focus:outline-none"
      />
      <span className="text-muted-foreground text-[10px]">{benchmark}</span>
    </div>
  );
}

interface PipelineRowProps {
  icon: React.ReactNode;
  title: string;
  value: React.ReactNode;
  subtitle: string;
  highlight?: boolean;
  alert?: boolean;
}

function PipelineRow({ icon, title, value, subtitle, highlight, alert }: PipelineRowProps) {
  return (
    <div className="group flex items-center justify-between">
      <div className="flex items-center gap-3">
        <div
          className={`rounded-xl border p-2.5 transition-colors ${alert ? "border-destructive/20 bg-destructive/10 text-destructive" : highlight ? "border-success/20 bg-success/10 text-success" : "border-border bg-muted text-muted-foreground group-hover:bg-muted/80"}`}
        >
          {icon}
        </div>
        <div>
          <h4 className="text-secondary-foreground group-hover:text-foreground text-sm font-bold transition-colors">
            {title}
          </h4>
          <p className="text-muted-foreground mt-0.5 text-[10px] font-semibold tracking-wider uppercase">
            {subtitle}
          </p>
        </div>
      </div>
      <div
        className={`text-xl font-black ${alert ? "text-destructive" : highlight ? "text-success" : "text-foreground"}`}
      >
        {value}
      </div>
    </div>
  );
}
