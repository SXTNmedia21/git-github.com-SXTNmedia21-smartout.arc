"use client";

/**
 * useDashboardMode — Auto-detects operative/preparatory mode based on live shift data.
 * Operative mode = at least one active shift right now. Preparatory = no active shifts.
 * Supports manual override so managers can pin a view regardless of shift state.
 */

import { useState, useMemo } from "react";
import { useLiveShifts } from "./use-live-shifts";

export type DashboardMode = "operative" | "preparatory";
type ModeOverride = DashboardMode | "auto";

export function useDashboardMode() {
  const [override, setOverride] = useState<ModeOverride>("auto");
  const { data: liveShifts } = useLiveShifts();

  const autoMode: DashboardMode = useMemo(() => {
    const hasActiveShifts = (liveShifts?.entries ?? []).length > 0;
    return hasActiveShifts ? "operative" : "preparatory";
  }, [liveShifts]);

  const activeMode: DashboardMode = override === "auto" ? autoMode : override;

  return {
    mode: activeMode,
    autoMode,
    override,
    setOverride,
    isAuto: override === "auto",
  };
}
