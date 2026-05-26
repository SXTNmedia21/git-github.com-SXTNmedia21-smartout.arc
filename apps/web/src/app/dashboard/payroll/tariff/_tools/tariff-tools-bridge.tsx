"use client";

/**
 * tariff-tools-bridge.tsx — Client island that registers Botsson tools for
 * /dashboard/payroll/tariff.
 *
 * Receives a serialized snapshot of tariff state from TariffClient (the client
 * boundary on this page). Decouples tool contract from BFF response schema so
 * that BFF drift doesn't break the tool registration.
 *
 * Returns null — purely a side-effect island (Phase 7.5 §3 pattern).
 *
 * Scope: "payroll-tariff" per §7 naming convention (parent-route-segment-leaf).
 */

import { useRegisterTools } from "@/app/Botsson/_components/tool-registry";
import { useTariffTools, type TariffToolInput } from "./use-tariff-tools";

export function TariffToolsBridge(props: TariffToolInput) {
  const tools = useTariffTools(props);
  useRegisterTools("payroll-tariff", tools);
  return null;
}
