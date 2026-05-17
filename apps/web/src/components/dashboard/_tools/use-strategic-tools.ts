"use client";

/**
 * use-strategic-tools.ts — Botsson read tools for the StrategicView (Innsikt) surface.
 *
 * Exposes 4 read tools:
 *
 * READ (4):
 *   getStrategicSnapshot   — all 6 KPIs + targets + status in one call
 *   getWorkforcePipeline   — hiring, departure, and onboarding counts (30d/90d)
 *   getTrainingStatus      — protocol assignment completion + readiness percent
 *   getSeasonProgress      — active season name, type, current stage, completed stages
 *
 * No write tools — StrategicView is read-only (target/manual-value mutations are
 * user-driven dialog interactions, not LLM-triggered mutations). If a write tool
 * is ever added here, load the gate pattern from oversikt tools first.
 *
 * Pattern: stable definitions in useMemo([], []) + dataRef refreshed every render
 * so implementations always read live data without churning the harness registry.
 */

import { useEffect, useMemo, useRef } from "react";
import type {
  ClientToolDefinition,
  ClientToolImplementation,
  ClientToolKit,
} from "@smartout/agent-sdk";
import type { PipelineData, TrainingReadinessData } from "@/app/dashboard/_hooks/dashboard-types";
import type { KpiTargets, KpiManualValues } from "@/app/dashboard/_hooks/use-kpi-targets";
import type { ActiveSeasonData } from "@/app/dashboard/_hooks/use-active-season";

/** Return shape of useAbsenceRate */
type AbsenceRateData = {
  rate: number;
  absenceDays: number;
  totalShiftDays: number;
  periodDays: number;
};

/** Return shape of useStaffTurnover */
type StaffTurnoverData = {
  rate: number;
  departed: number;
  activeNow: number;
  periodDays: number;
};

/** Return shape of useTaskCompletion */
type TaskCompletionData = {
  total: number;
  completed: number;
  rate: number;
};

/** Return shape of useTimeToJobReady */
type TimeToJobReadyData = {
  averageDays: number;
  sampleSize: number;
};

export type StrategicToolInput = {
  /** KPI target thresholds (from useKpiTargets). */
  targets: KpiTargets;
  /** Admin manual-override values keyed by metric (from useKpiTargets). */
  manualValues: KpiManualValues;
  /** Workforce pipeline snapshot — active, new hires, departures, onboarding (from useWorkforcePipeline). */
  pipeline: PipelineData | null;
  /** Protocol assignment completion rates (from useTrainingReadiness). */
  training: TrainingReadinessData | null;
  /** Absence rate over rolling 30-day window (from useAbsenceRate). */
  absenceData: AbsenceRateData | null;
  /** 90-day staff turnover rate (from useStaffTurnover). */
  turnoverData: StaffTurnoverData | null;
  /** Today's session task completion rate across all departments (from useTaskCompletion). */
  taskCompletionData: TaskCompletionData | null;
  /** Average days from trainee start → job-ready (from useTimeToJobReady). */
  timeToJobReadyData: TimeToJobReadyData | null;
  /** Active season from engine_sessions + season table (from useActiveSeason). Null = no active season. */
  activeSeason: ActiveSeasonData | null;
};

/* ━━━ Helpers ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

type KpiStatus = "good" | "bad" | "no_data";

function evalKpiStatus(
  value: number | null,
  target: number,
  direction: "lower_is_better" | "higher_is_better",
): KpiStatus {
  if (value === null) return "no_data";
  if (direction === "higher_is_better") return value >= target ? "good" : "bad";
  return value <= target ? "good" : "bad";
}

function resolveValue(
  systemValue: number | null,
  metric: keyof KpiTargets,
  manualValues: KpiManualValues,
): { value: number | null; source: "system" | "manual" | null } {
  if (systemValue !== null) return { value: systemValue, source: "system" };
  const manual = manualValues[metric];
  if (manual?.value != null) return { value: manual.value, source: "manual" };
  return { value: null, source: null };
}

/* ━━━ Hook ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

export function useStrategicTools(input: StrategicToolInput): ClientToolKit {
  // Refresh ref on every render — implementations close over dataRef.current
  // so they always see the latest data without forcing tool re-registration.
  const dataRef = useRef(input);
  useEffect(() => {
    dataRef.current = input;
  });

  const definitions = useMemo<ClientToolDefinition[]>(
    () => [
      {
        temporaryTool: {
          modelToolName: "getStrategicSnapshot",
          description:
            "Get all 6 strategic KPIs for the workspace in one call: opplæringsberedskap, oppgavefullføring, tid-til-jobbklar, varekostnad, personalomsetning, fraværsrate — each with current value, target, and status. Call this first when the manager asks any open-ended question about workspace health, KPIs, or strategic status.",
          dynamicParameters: [],
          client: {},
        },
      },
      {
        temporaryTool: {
          modelToolName: "getWorkforcePipeline",
          description:
            "Get workforce pipeline headcount snapshot: total active staff, new hires last 30 days, departures last 30 days, and employees currently in onboarding (trainee status). Use when manager asks 'kor mange ansatte har vi?', 'har vi tapt folk?', 'hvem er under opplæring?', or any headcount question.",
          dynamicParameters: [],
          client: {},
        },
      },
      {
        temporaryTool: {
          modelToolName: "getTrainingStatus",
          description:
            "Get protocol assignment completion status across all workspace employees: total assignments, completed, pending (in progress), expired (missed deadline), and overall readiness percent. Use when manager asks 'er opplæringa i rute?', 'hvem har ikke fullført?', 'hva er opplæringsberedskapen?'.",
          dynamicParameters: [],
          client: {},
        },
      },
      {
        temporaryTool: {
          modelToolName: "getSeasonProgress",
          description:
            "Get the active season name, type, date range, current lifecycle stage, and completed stages. Use when manager asks 'hvilken sesong er vi i?', 'hvor er vi i sesongen?', 'hva gjenstår i sesongen?', or any season-progress question.",
          dynamicParameters: [],
          client: {},
        },
      },
    ],
    [],
  );

  const implementations = useMemo<Record<string, ClientToolImplementation>>(
    () => ({
      getStrategicSnapshot: () => {
        const d = dataRef.current;

        const trainingVal = d.training?.readinessPercent ?? null;
        const taskVal = d.taskCompletionData?.rate ?? null;
        const timeToReadyVal =
          d.timeToJobReadyData && d.timeToJobReadyData.sampleSize > 0
            ? d.timeToJobReadyData.averageDays
            : null;
        const turnoverVal = d.turnoverData?.rate ?? null;
        const absenceVal = d.absenceData?.rate ?? null;
        // cost_of_sales has no system source — manual only
        const costOfSalesResolved = resolveValue(null, "cost_of_sales", d.manualValues);

        return JSON.stringify({
          kpis: {
            training_readiness: {
              value: resolveValue(trainingVal, "training_readiness", d.manualValues),
              target: d.targets.training_readiness,
              unit: "%",
              status: evalKpiStatus(trainingVal, d.targets.training_readiness, "higher_is_better"),
            },
            task_completion: {
              value: resolveValue(taskVal, "task_completion", d.manualValues),
              target: d.targets.task_completion,
              unit: "%",
              status: evalKpiStatus(taskVal, d.targets.task_completion, "higher_is_better"),
            },
            time_to_job_ready: {
              value: resolveValue(timeToReadyVal, "time_to_job_ready", d.manualValues),
              target: d.targets.time_to_job_ready,
              unit: "days",
              status: evalKpiStatus(timeToReadyVal, d.targets.time_to_job_ready, "lower_is_better"),
            },
            cost_of_sales: {
              value: costOfSalesResolved,
              target: d.targets.cost_of_sales,
              unit: "%",
              status: evalKpiStatus(
                costOfSalesResolved.value,
                d.targets.cost_of_sales,
                "lower_is_better",
              ),
            },
            turnover_90d: {
              value: resolveValue(turnoverVal, "turnover_90d", d.manualValues),
              target: d.targets.turnover_90d,
              unit: "%",
              status: evalKpiStatus(turnoverVal, d.targets.turnover_90d, "lower_is_better"),
            },
            absence_rate: {
              value: resolveValue(absenceVal, "absence_rate", d.manualValues),
              target: d.targets.absence_rate,
              unit: "%",
              status: evalKpiStatus(absenceVal, d.targets.absence_rate, "lower_is_better"),
            },
          },
        });
      },

      getWorkforcePipeline: () => {
        const d = dataRef.current;
        if (!d.pipeline) {
          return JSON.stringify({
            available: false,
            reason: "Ingen ansatte registrert ennå.",
          });
        }
        return JSON.stringify({
          available: true,
          activeStaff: d.pipeline.activeStaff,
          newHires30d: d.pipeline.newHires30d,
          departures30d: d.pipeline.departures30d,
          onboarding: d.pipeline.onboarding,
          netChange30d: d.pipeline.newHires30d - d.pipeline.departures30d,
          alert: d.pipeline.departures30d > 2,
        });
      },

      getTrainingStatus: () => {
        const d = dataRef.current;
        if (!d.training || d.training.totalAssignments === 0) {
          return JSON.stringify({
            available: false,
            reason: "Ingen protokoller tildelt ennå.",
          });
        }
        const t = d.training;
        return JSON.stringify({
          available: true,
          totalAssignments: t.totalAssignments,
          completed: t.completed,
          pending: t.pending,
          expired: t.expired,
          readinessPercent: t.readinessPercent,
          target: d.targets.training_readiness,
          status: evalKpiStatus(
            t.readinessPercent,
            d.targets.training_readiness,
            "higher_is_better",
          ),
          alert: t.expired > 0,
        });
      },

      getSeasonProgress: () => {
        const d = dataRef.current;
        if (!d.activeSeason) {
          return JSON.stringify({
            available: false,
            reason: "Ingen aktiv sesong registrert.",
          });
        }
        const s = d.activeSeason;
        return JSON.stringify({
          available: true,
          name: s.name,
          type: s.type,
          startDate: s.startDate,
          endDate: s.endDate,
          currentStage: s.currentStage,
          stagesCompleted: s.stagesCompleted,
          stagesRemaining: [
            "seed",
            "revenue",
            "concept",
            "staffing",
            "prepare",
            "ready",
            "running",
            "reflect",
          ].filter((stage) => !s.stagesCompleted.includes(stage) && stage !== s.currentStage),
        });
      },
    }),
    [],
  );

  return useMemo(() => ({ definitions, implementations }), [definitions, implementations]);
}
