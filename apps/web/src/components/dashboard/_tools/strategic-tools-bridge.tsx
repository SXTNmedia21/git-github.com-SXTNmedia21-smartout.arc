"use client";

/**
 * strategic-tools-bridge.tsx — registers Botsson read tools for the
 * StrategicView (Innsikt) surface inside the harness registry.
 *
 * Why a bridge:
 *  - Keeps StrategicView free from voice-tool registration bookkeeping.
 *  - Mounts ONLY when StrategicView is in ready-state (workspace resolved).
 *    When unmounted, useRegisterTools removes the scope from the registry
 *    automatically.
 *
 * Data sourcing:
 *  - Re-uses the same TanStack hooks StrategicView already calls (useWorkforcePipeline,
 *    useTrainingReadiness, useKpiTargets, useActiveSeason, useAbsenceRate,
 *    useStaffTurnover, useTaskCompletion, useTimeToJobReady). Query-key dedup
 *    means there is no extra network cost — the bridge reads from the same
 *    cache entries.
 *
 * Lifecycle:
 *  - useRegisterTools handles register/unregister. When the bridge unmounts
 *    (adminView changes away from "strategic"), tools are removed from the
 *    registry.
 */

import { useRegisterTools } from "@/app/Botsson/_components/tool-registry";
import { useWorkforcePipeline } from "@/app/dashboard/_hooks/use-workforce-pipeline";
import { useTrainingReadiness } from "@/app/dashboard/_hooks/use-training-readiness";
import { useKpiTargets } from "@/app/dashboard/_hooks/use-kpi-targets";
import { useActiveSeason } from "@/app/dashboard/_hooks/use-active-season";
import { useAbsenceRate } from "@/app/dashboard/_hooks/use-absence-rate";
import { useStaffTurnover } from "@/app/dashboard/_hooks/use-staff-turnover";
import { useTaskCompletion } from "@/app/dashboard/_hooks/use-task-completion";
import { useTimeToJobReady } from "@/app/dashboard/_hooks/use-time-to-job-ready";

import { useStrategicTools } from "./use-strategic-tools";

export function StrategicToolsBridge() {
  const { targets, manualValues } = useKpiTargets();
  const { data: pipeline } = useWorkforcePipeline();
  const { data: training } = useTrainingReadiness();
  const { data: absenceData } = useAbsenceRate();
  const { data: turnoverData } = useStaffTurnover();
  const { data: taskCompletionData } = useTaskCompletion();
  const { data: timeToJobReadyData } = useTimeToJobReady();
  const { data: activeSeason } = useActiveSeason();

  const tools = useStrategicTools({
    targets,
    manualValues,
    pipeline: pipeline ?? null,
    training: training ?? null,
    absenceData: absenceData ?? null,
    turnoverData: turnoverData ?? null,
    taskCompletionData: taskCompletionData ?? null,
    timeToJobReadyData: timeToJobReadyData ?? null,
    activeSeason: activeSeason ?? null,
  });

  useRegisterTools("strategic", tools);

  return null;
}
