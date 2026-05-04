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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  KpiAccentTile,
  type KpiAccent,
} from "@smartout/ui";
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

  const { targets, manualValues, updateTarget, updateManualValue } = useKpiTargets();
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

  function handleManualSave(
    metric: KpiMetric,
    value: number | null,
    unit?: string | null,
    valueDate?: string,
  ) {
    updateManualValue.mutate({ metric, value, unit: unit ?? null, valueDate });
  }

  /**
   * resolveValue — system value if present, otherwise admin manual override.
   * Returns null when neither exists.
   */
  function resolveValue(
    metric: KpiMetric,
    systemValue: string | null,
    unit: string,
  ): { display: string | null; source: "system" | "manual" | null; sourceDate?: string } {
    if (systemValue) return { display: systemValue, source: "system" };
    const manual = manualValues[metric];
    if (manual?.value != null) {
      return {
        display: `${manual.value}${manual.unit ?? unit}`,
        source: "manual",
        sourceDate: manual.valueDate,
      };
    }
    return { display: null, source: null };
  }

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col gap-5 p-4 pt-1 md:p-6 md:pt-3">
      {/* Page header — Reports-style */}
      <div className="flex items-end justify-between gap-4">
        <div className="min-w-0">
          <h1 className="font-heading text-foreground text-3xl leading-tight tracking-tight">
            Innsikt
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Strategiske KPI-er og workforce-pipeline. Klikk på et tall for å fylle inn manuelt eller
            endre mål.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowBudget(!showBudget)}
            title="Budsjettinnstillinger"
            className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors ${
              showBudget
                ? "border-primary/50 bg-primary/10 text-primary"
                : "border-border bg-card text-muted-foreground hover:text-foreground"
            }`}
          >
            <BarChart3 className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Budsjett</span>
          </button>
          <button
            onClick={() => setIsSettingsOpen(true)}
            className="border-border bg-card text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors"
          >
            <Settings className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Konfigurer mål</span>
          </button>
        </div>
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
            targetValueLabel={`${targets.training_readiness}`}
            status={
              training
                ? training.readinessPercent < targets.training_readiness
                  ? "bad"
                  : "good"
                : null
            }
            icon={ShieldCheck}
            accent="blue"
            explanation={kpiCopy.training_readiness}
            metric="training_readiness"
            targetValue={targets.training_readiness}
            unit="%"
            onTargetSave={handleTargetSave}
            onManualSave={handleManualSave}
          />

          <KPICard
            title="Oppgavefullføring"
            value={taskCompletionData ? `${taskCompletionData.rate}%` : null}
            targetDisplay={`> ${targets.task_completion}%`}
            targetValueLabel={`${targets.task_completion}`}
            status={
              taskCompletionData
                ? taskCompletionData.rate < targets.task_completion
                  ? "bad"
                  : "good"
                : null
            }
            icon={CheckCircle2}
            accent="emerald"
            explanation={kpiCopy.task_completion}
            metric="task_completion"
            targetValue={targets.task_completion}
            unit="%"
            onTargetSave={handleTargetSave}
            onManualSave={handleManualSave}
          />

          {(() => {
            const r = resolveValue(
              "time_to_job_ready",
              timeToJobReadyData && timeToJobReadyData.sampleSize > 0
                ? `${timeToJobReadyData.averageDays}d`
                : null,
              "d",
            );
            return (
              <KPICard
                title="Tid til jobbklar"
                value={r.display}
                source={r.source}
                targetDisplay={`< ${targets.time_to_job_ready}d`}
                targetValueLabel={`${targets.time_to_job_ready}`}
                status={
                  timeToJobReadyData && timeToJobReadyData.sampleSize > 0
                    ? timeToJobReadyData.averageDays > targets.time_to_job_ready
                      ? "bad"
                      : "good"
                    : null
                }
                icon={Target}
                accent="purple"
                explanation={kpiCopy.time_to_job_ready}
                metric="time_to_job_ready"
                targetValue={targets.time_to_job_ready}
                unit="dager"
                onTargetSave={handleTargetSave}
                onManualSave={handleManualSave}
              />
            );
          })()}

          {(() => {
            const r = resolveValue("cost_of_sales", null, "%");
            return (
              <KPICard
                title="Varekostnad"
                value={r.display}
                source={r.source}
                targetDisplay={`< ${targets.cost_of_sales}%`}
                targetValueLabel={`${targets.cost_of_sales}`}
                status={null}
                icon={BarChart3}
                accent="amber"
                explanation="Kobles til regnskap. Krever integrasjon med varesystem — eller fyll inn manuelt."
                metric="cost_of_sales"
                targetValue={targets.cost_of_sales}
                unit="%"
                onTargetSave={handleTargetSave}
                onManualSave={handleManualSave}
              />
            );
          })()}

          {(() => {
            const r = resolveValue(
              "turnover_90d",
              turnoverData ? `${turnoverData.rate}%` : null,
              "%",
            );
            return (
              <KPICard
                title="Personalomsetning"
                value={r.display}
                source={r.source}
                targetDisplay={`< ${targets.turnover_90d}%`}
                targetValueLabel={`${targets.turnover_90d}`}
                status={
                  turnoverData ? (turnoverData.rate > targets.turnover_90d ? "bad" : "good") : null
                }
                icon={Users}
                accent="orange"
                explanation={kpiCopy.turnover_90d}
                metric="turnover_90d"
                targetValue={targets.turnover_90d}
                unit="%"
                onTargetSave={handleTargetSave}
                onManualSave={handleManualSave}
              />
            );
          })()}

          {(() => {
            const r = resolveValue(
              "absence_rate",
              absenceData ? `${absenceData.rate}%` : null,
              "%",
            );
            return (
              <KPICard
                title="Fraværsrate"
                value={r.display}
                source={r.source}
                targetDisplay={`< ${targets.absence_rate}%`}
                targetValueLabel={`${targets.absence_rate}`}
                status={
                  absenceData ? (absenceData.rate > targets.absence_rate ? "bad" : "good") : null
                }
                icon={Target}
                accent="rose"
                explanation={kpiCopy.absence_rate}
                metric="absence_rate"
                targetValue={targets.absence_rate}
                unit="%"
                onTargetSave={handleTargetSave}
                onManualSave={handleManualSave}
              />
            );
          })()}
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
  /** Where the value came from — "system" (live data) or "manual" (admin-entered). */
  source?: "system" | "manual" | null;
  targetDisplay: string;
  targetValueLabel: string;
  status: "good" | "bad" | null;
  icon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
  accent: KpiAccent;
  explanation?: string;
  metric: KpiMetric;
  targetValue: number;
  unit: string;
  onTargetSave: (metric: KpiMetric, value: number) => void;
  onManualSave: (
    metric: KpiMetric,
    value: number | null,
    unit?: string | null,
    valueDate?: string,
  ) => void;
};

/**
 * Strip non-numeric suffix off a display string like "82%" or "5d" so we can
 * render value + unit in the asymmetric KpiAccentTile shape.
 */
function splitValueUnit(display: string | null, unit: string): { value: string; unit: string } {
  if (!display) return { value: "—", unit };
  const m = display.match(/^(-?\d+(?:[.,]\d+)?)\s*(\D.*)?$/);
  if (m) {
    return { value: m[1] ?? display, unit: (m[2] ?? unit).trim() };
  }
  return { value: display, unit };
}

function KPICard({
  title,
  value,
  source,
  targetDisplay,
  targetValueLabel,
  status: _status,
  icon,
  accent,
  explanation,
  metric,
  targetValue,
  unit,
  onTargetSave,
  onManualSave,
}: KPICardProps) {
  const [open, setOpen] = useState(false);
  const split = splitValueUnit(value, unit);

  return (
    <>
      <KpiAccentTile
        title={title}
        icon={icon}
        accent={accent}
        primary={{
          label: source === "manual" ? "Manuelt" : "Nå",
          value: split.value,
          unit: split.unit,
        }}
        secondary={{ label: "Mål", value: targetValueLabel, unit }}
        onClick={() => setOpen(true)}
      />
      <ManualValueDialog
        open={open}
        onOpenChange={setOpen}
        title={title}
        unit={unit}
        currentValue={value}
        targetValue={targetValue}
        explanation={explanation}
        onSaveTarget={(v) => onTargetSave(metric, v)}
        onSaveManual={(v, valueDate) => onManualSave(metric, v, unit, valueDate)}
        metric={metric}
      />
      {/* targetDisplay still passed in for backwards compat — surface in dialog only */}
      <span hidden>{targetDisplay}</span>
    </>
  );
}

function ManualValueDialog({
  open,
  onOpenChange,
  title,
  unit,
  currentValue,
  targetValue,
  explanation,
  onSaveTarget,
  onSaveManual,
  metric: _metric,
}: {
  open: boolean;
  onOpenChange: (next: boolean) => void;
  title: string;
  unit: string;
  currentValue: string | null;
  targetValue: number;
  explanation?: string;
  onSaveTarget: (value: number) => void;
  onSaveManual: (value: number | null, valueDate: string) => void;
  metric: KpiMetric;
}) {
  const today = new Date().toISOString().slice(0, 10);
  const [manual, setManual] = useState<string>("");
  const [target, setTarget] = useState<number>(targetValue);
  const [valueDate, setValueDate] = useState<string>(today);

  useEffect(() => {
    if (open) {
      setManual("");
      setTarget(targetValue);
      setValueDate(today);
    }
  }, [open, targetValue, today]);

  function handleSave() {
    if (target !== targetValue) {
      onSaveTarget(target);
    }
    const manualNum = manual.trim() === "" ? null : Number(manual.replace(",", "."));
    if (manualNum !== null && Number.isFinite(manualNum)) {
      onSaveManual(manualNum, valueDate);
    }
    onOpenChange(false);
  }

  function handleClearManual() {
    onSaveManual(null, valueDate);
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="border-border bg-background text-foreground max-w-md">
        <DialogHeader>
          <DialogTitle className="text-lg">{title}</DialogTitle>
          {explanation ? (
            <DialogDescription className="text-muted-foreground">{explanation}</DialogDescription>
          ) : null}
        </DialogHeader>
        <div className="grid gap-4 py-2">
          <div className="grid gap-1.5">
            <label className="text-secondary-foreground text-sm font-bold">
              Manuell verdi {unit ? <span className="text-muted-foreground">({unit})</span> : null}
            </label>
            <input
              type="text"
              value={manual}
              onChange={(e) => setManual(e.target.value)}
              placeholder={currentValue ?? "—"}
              className="border-border bg-muted focus:ring-primary rounded-lg border px-3 py-2 focus:ring-2 focus:outline-none"
            />
            <span className="text-muted-foreground text-[10px]">
              Fyll inn manuelt når systemet ikke har data
            </span>
          </div>
          <div className="grid gap-1.5">
            <label className="text-secondary-foreground text-sm font-bold">
              Mål {unit ? <span className="text-muted-foreground">({unit})</span> : null}
            </label>
            <input
              type="number"
              value={target}
              onChange={(e) => setTarget(Number(e.target.value))}
              className="border-border bg-muted focus:ring-primary rounded-lg border px-3 py-2 focus:ring-2 focus:outline-none"
            />
          </div>
        </div>
        <div className="flex justify-between gap-2 pt-2">
          <button
            type="button"
            onClick={handleClearManual}
            className="text-destructive hover:text-destructive/80 rounded-lg px-3 py-1.5 text-sm font-semibold"
          >
            Fjern manuell
          </button>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="text-muted-foreground hover:text-foreground rounded-lg px-3 py-1.5 text-sm font-semibold"
            >
              Avbryt
            </button>
            <button
              type="button"
              onClick={handleSave}
              className="bg-primary text-primary-foreground rounded-lg px-3 py-1.5 text-sm font-semibold"
            >
              Lagre
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
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
