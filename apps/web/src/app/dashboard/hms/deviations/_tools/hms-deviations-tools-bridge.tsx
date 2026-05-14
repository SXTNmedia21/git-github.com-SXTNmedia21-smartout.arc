"use client";

/**
 * hms-deviations-tools-bridge.tsx — registers Botsson tools for the
 * /dashboard/hms/deviations surface.
 *
 * Bridge mounts inside the page so it can hand both data (deviations) and
 * setters (viewMode, openDetail) to the hook. Tools read the live data via
 * dataRef on every invocation.
 *
 * ADR-0238: page does not own a domain chat surface — Orb interactive mode.
 * ADR-0151: workspace_id resolved server-side in useDeviations; bridge is
 * pure presentation glue.
 */

import { useRegisterTools } from "@/app/Botsson/_components/tool-registry";
import { useHmsDeviationsTools } from "./use-hms-deviations-tools";
import type { DeviationRow } from "@smartout/hms";

type HmsDeviationsToolsBridgeProps = {
  isAdminMode: boolean;
  loading: boolean;
  deviations: DeviationRow[];
  viewMode: "kanban" | "list";
  selectedDeviationId: string | null;
  setViewMode: (mode: "kanban" | "list") => void;
  openDetail: (deviationId: string) => void;
};

export function HmsDeviationsToolsBridge(props: HmsDeviationsToolsBridgeProps) {
  const tools = useHmsDeviationsTools(props);
  useRegisterTools("hms-deviations", tools);
  return null;
}
