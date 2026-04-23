/**
 * Year-wheel hook wrappers — inject web-app context into shared package hooks.
 *
 * Components import from here. The actual hook logic lives in @smartout/year-wheel/hooks
 * so mobile can consume the same business logic with different context injection.
 */

"use client";

import { useContext } from "react";
import { useWorkspaceOptional } from "@/lib/workspace-context";
import { DashboardContext } from "@/components/dashboard/DashboardShell";
import {
  useSeasons as useSeasonsBase,
  useSeasonBudget as useSeasonBudgetBase,
  useDayFactors as useDayFactorsBase,
  useHourFactors as useHourFactorsBase,
  usePlanningEvents as usePlanningEventsBase,
  usePlanningCycles as usePlanningCyclesBase,
  useSeasonPolicyBindings as useSeasonPolicyBindingsBase,
  useSeasonGoals as useSeasonGoalsBase,
  useSeasonOperatingHours as useSeasonOperatingHoursBase,
  useSeasonsSeededState as useSeasonsSeededStateBase,
  DEFAULT_DAY_FACTORS,
  DEFAULT_HOUR_FACTORS,
  WEEKDAY_LABELS,
} from "@smartout/year-wheel/hooks";

/** Portable return types for exported hooks (avoids TS2742 across package boundary). */
type UseSeasonBudgetReturn = ReturnType<typeof useSeasonBudgetBase>;
type UsePlanningEventsReturn = ReturnType<typeof usePlanningEventsBase>;
type UsePlanningCyclesReturn = ReturnType<typeof usePlanningCyclesBase>;
type UseSeasonGoalsReturn = ReturnType<typeof useSeasonGoalsBase>;
export type { Season } from "@smartout/year-wheel/hooks";
export type { SeasonBudget } from "@smartout/year-wheel/hooks";
export type { DayFactor } from "@smartout/year-wheel/hooks";
export type { HourFactor } from "@smartout/year-wheel/hooks";

export { DEFAULT_DAY_FACTORS, DEFAULT_HOUR_FACTORS, WEEKDAY_LABELS };

function useYearWheelContext() {
  const ctx = useWorkspaceOptional();
  const wsId = ctx?.workspace.workspace_id ?? null;
  const { profileId } = useContext(DashboardContext);
  return { wsId, profileId };
}

export function useSeasons() {
  const { wsId, profileId } = useYearWheelContext();
  return useSeasonsBase(wsId, profileId);
}

export function useSeasonBudget(seasonId: string | null): UseSeasonBudgetReturn {
  const { wsId, profileId } = useYearWheelContext();
  return useSeasonBudgetBase(seasonId, wsId, profileId);
}

export function useDayFactors(seasonBudgetId: string | null) {
  const { wsId, profileId } = useYearWheelContext();
  return useDayFactorsBase(seasonBudgetId, wsId, profileId);
}

export function useHourFactors(seasonBudgetId: string | null) {
  const { wsId, profileId } = useYearWheelContext();
  return useHourFactorsBase(seasonBudgetId, wsId, profileId);
}

export function usePlanningEvents(planningCycleId?: string | null): UsePlanningEventsReturn {
  const { wsId, profileId } = useYearWheelContext();
  return usePlanningEventsBase(wsId, profileId, planningCycleId);
}

export function usePlanningCycles(): UsePlanningCyclesReturn {
  const { wsId, profileId } = useYearWheelContext();
  return usePlanningCyclesBase(wsId, profileId);
}

export function useSeasonPolicyBindings(seasonId: string | null) {
  const { wsId, profileId } = useYearWheelContext();
  return useSeasonPolicyBindingsBase(seasonId, wsId, profileId);
}

export function useSeasonGoals(seasonId: string | null): UseSeasonGoalsReturn {
  const { wsId, profileId } = useYearWheelContext();
  return useSeasonGoalsBase(seasonId, wsId, profileId);
}

export function useSeasonOperatingHours(seasonId: string | null) {
  const { wsId, profileId } = useYearWheelContext();
  return useSeasonOperatingHoursBase(seasonId, wsId, profileId);
}

/**
 * Seeded-state for every season in the workspace. Wraps the package hook
 * with the workspace context already resolved from DashboardShell.
 * See `@smartout/year-wheel/hooks/use-seasons-seeded-state.ts`.
 */
export function useSeasonsSeededState() {
  const { wsId } = useYearWheelContext();
  return useSeasonsSeededStateBase(wsId);
}
