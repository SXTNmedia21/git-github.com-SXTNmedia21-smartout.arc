"use client";

/**
 * reconciliation-tools-bridge.tsx — registers Botsson read tools for the
 * ReconciliationView surface inside the harness registry.
 *
 * Why a bridge:
 *  - Keeps ReconciliationView free from voice-tool registration bookkeeping.
 *  - Mounts ONLY in the data-ready state (departments resolved, not loading).
 *    The view passes `isReady` — when false (loading / no data) the bridge
 *    renders null without calling useRegisterTools, which means tools are
 *    absent rather than returning stale empty arrays.
 *
 * Data sourcing:
 *  - Re-uses the same data ReconciliationView already holds (useDepartmentShifts
 *    result, decisions state, dayApproved state). No extra network cost — the
 *    bridge reads from the same TanStack Query cache entry.
 *
 * Lifecycle:
 *  - useRegisterTools handles register/unregister automatically. When the
 *    bridge unmounts (e.g. user navigates away from reconciliation variant),
 *    tools are removed from the registry.
 *
 * Write tools (lockReconciliation / revertReconciliation):
 *  - Deferred. No "use server" Server Actions exist for day-level lock/revert.
 *    See use-reconciliation-tools.ts for full deferral rationale.
 */

import { useRegisterTools } from "@/app/Botsson/_components/tool-registry";
import type { DepartmentShiftGroup } from "@/app/dashboard/_hooks/dashboard-types";
import { useReconciliationTools } from "./use-reconciliation-tools";

type Props = {
  selectedDate: string;
  departments: DepartmentShiftGroup[] | null | undefined;
  dayApproved: boolean;
  decisions: Record<string, string>;
};

export function ReconciliationToolsBridge({
  selectedDate,
  departments,
  dayApproved,
  decisions,
}: Props) {
  const tools = useReconciliationTools({
    selectedDate,
    departments,
    dayApproved,
    decisions,
  });

  useRegisterTools("reconciliation", tools);

  return null;
}
