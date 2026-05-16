"use client";

/**
 * hms-governance-tools-bridge.tsx — registers Botsson tools for
 * /dashboard/hms/governance.
 *
 * Different scope than /dashboard/governance — see use-hms-governance-tools.ts
 * header for the distinction.
 *
 * ADR-0238: page does not own a domain chat surface.
 */

import { useRegisterTools } from "@/app/Botsson/_components/tool-registry";
import { useHmsGovernanceTools } from "./use-hms-governance-tools";
import type { ProtocolOverviewItem } from "@/app/dashboard/_hooks/dashboard-types";

type HmsGovernanceToolsBridgeProps = {
  loading: boolean;
  protocols: ProtocolOverviewItem[];
};

export function HmsGovernanceToolsBridge(props: HmsGovernanceToolsBridgeProps) {
  const tools = useHmsGovernanceTools(props);
  useRegisterTools("hms-governance", tools);
  return null;
}
