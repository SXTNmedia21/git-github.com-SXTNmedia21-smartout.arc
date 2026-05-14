"use client";

/**
 * settings-tools-bridge.tsx — registers Botsson tools for the
 * /dashboard/settings surface.
 *
 * Why a bridge:
 *  - Keeps SettingsTabs clean from voice-tool registration.
 *  - Mounts only from the page component so the tool set is always
 *    available while settings is the active route.
 *
 * Data sourcing:
 *  - Receives live state from the page (activeTab, setActiveTab) and
 *    optional read-only summaries (payrollSettings, operatingHours).
 *    No duplicate fetches — these values are passed down from hooks
 *    already running in the parent component.
 *
 * Lifecycle:
 *  - useRegisterTools handles register/unregister automatically on
 *    mount/unmount.
 */

import { useRegisterTools } from "@/app/Botsson/_components/tool-registry";
import {
  useSettingsTools,
  type PayrollSettingsSummary,
  type OperatingHoursEntry,
} from "./use-settings-tools";
import type { TabId } from "../_components/settings-tabs";

type SettingsToolsBridgeProps = {
  activeTab: TabId;
  setActiveTab: (tab: TabId) => void;
  payrollSettings: PayrollSettingsSummary;
  operatingHours: OperatingHoursEntry[] | null;
};

export function SettingsToolsBridge({
  activeTab,
  setActiveTab,
  payrollSettings,
  operatingHours,
}: SettingsToolsBridgeProps) {
  const tools = useSettingsTools({
    activeTab,
    setActiveTab,
    payrollSettings,
    operatingHours,
  });

  useRegisterTools("settings", tools);

  return null;
}
