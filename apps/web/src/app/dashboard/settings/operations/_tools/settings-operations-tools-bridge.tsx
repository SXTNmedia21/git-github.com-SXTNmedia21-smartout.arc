"use client";

/**
 * settings-operations-tools-bridge.tsx — registers Botsson tools for the
 * /dashboard/settings/operations surface.
 *
 * Why a bridge:
 *  - Keeps the page component clean from voice-tool registration.
 *  - Mounts only when the page is the active route; useRegisterTools
 *    handles automatic unregister on unmount.
 *
 * Data sourcing:
 *  - Receives pre-fetched summaries from the page (no duplicate queries).
 *    Page hooks run first; bridge re-uses those results.
 *
 * Scope: "settings-operations" — distinct from the parent "settings" scope
 * so Botsson routes tool calls to the correct surface.
 */

import { useRegisterTools } from "@/app/Botsson/_components/tool-registry";
import {
  useSettingsOperationsTools,
  type OperationsHoursEntry,
  type OperationsWorkingTimeRule,
  type OperationsBreakRule,
} from "./use-settings-operations-tools";

type SettingsOperationsToolsBridgeProps = {
  loadingHours: boolean;
  operatingHours: OperationsHoursEntry[];
  loadingWorkingTime: boolean;
  workingTimeRules: OperationsWorkingTimeRule[];
  loadingBreakRules: boolean;
  breakRules: OperationsBreakRule[];
};

export function SettingsOperationsToolsBridge({
  loadingHours,
  operatingHours,
  loadingWorkingTime,
  workingTimeRules,
  loadingBreakRules,
  breakRules,
}: SettingsOperationsToolsBridgeProps) {
  const tools = useSettingsOperationsTools({
    loadingHours,
    operatingHours,
    loadingWorkingTime,
    workingTimeRules,
    loadingBreakRules,
    breakRules,
  });

  useRegisterTools("settings-operations", tools);

  return null;
}
