"use client";

import { useRegisterTools } from "@/app/Botsson/_components/tool-registry";
import {
  useBillingSettingsTools,
  type BillingSettingsWorkspace,
} from "./use-billing-settings-tools";

type BillingSettingsToolsBridgeProps = {
  workspaces: BillingSettingsWorkspace[];
  ehfEnabled: boolean;
  peppolParticipantId: string | null;
  platformRuleCount: number;
  workspaceRuleCount: number;
};

export function BillingSettingsToolsBridge(props: BillingSettingsToolsBridgeProps) {
  const tools = useBillingSettingsTools(props);
  useRegisterTools("billing-settings", tools);
  return null;
}
