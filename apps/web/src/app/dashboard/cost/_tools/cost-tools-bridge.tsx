"use client";

/**
 * cost-tools-bridge.tsx — registers Botsson tools for /dashboard/cost.
 *
 * Why a bridge:
 *  - Cost page is a Server Component; tool registration requires a client boundary.
 *  - Receives live cost state as props from the CostOverview client island — no
 *    duplicate fetch, no lifted state.
 *  - useRegisterTools handles register/unregister automatically on mount/unmount.
 *
 * ADR-0238: owns_chat_surface=false — cost does not declare chat ownership.
 * ADR-0151: workspace_id resolved server-side; not forwarded to client tools.
 */

import { useRegisterTools } from "@/app/Botsson/_components/tool-registry";
import { useCostTools, type CostToolInput } from "./use-cost-tools";

type CostToolsBridgeProps = Omit<CostToolInput, "navigateWeek"> & {
  navigateWeek: (offset: number) => void;
};

export function CostToolsBridge(props: CostToolsBridgeProps) {
  const tools = useCostTools(props);
  useRegisterTools("cost", tools);
  return null;
}
