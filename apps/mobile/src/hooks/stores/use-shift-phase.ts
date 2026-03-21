/**
 * Zustand store that wraps calculateShiftPhase() and provides reactive shift phase state.
 *
 * Subscribes to useMyShifts() and useActiveTimeEntry() query data and recalculates
 * the phase on data change + a 1-minute interval timer to handle time-based transitions
 * (e.g., crossing into the "before_shift" window while the app is open).
 *
 * This store drives the home screen layout, FAB shortcuts, and push priority.
 */

import { useEffect, useRef, useMemo } from "react";
import { create } from "zustand";
import { useShallow } from "zustand/react/shallow";
import { calculateShiftPhase, type ShiftPhase, type ShiftPhaseResult } from "@/lib/shift-phase";
import { useMyShifts } from "@/hooks/queries/use-my-shifts";
import { useActiveTimeEntry } from "@/hooks/queries/use-active-time-entry";
import type { Database } from "@smartout/supabase/database.types";
import type { TimeEntry } from "@/types/time-entry";

type ScheduleShift = Database["public"]["Tables"]["schedule_shift"]["Row"];

type ShiftPhaseState = {
  phase: ShiftPhase;
  activeShift: ScheduleShift | null;
  activeTimeEntry: TimeEntry | null;
  nextShift: ScheduleShift | null;
  /** Updates the store with fresh calculation results */
  update: (result: ShiftPhaseResult) => void;
};

/** Internal Zustand store — not exported directly, use useShiftPhase() hook instead */
const useShiftPhaseStore = create<ShiftPhaseState>((set) => ({
  phase: "no_shift",
  activeShift: null,
  activeTimeEntry: null,
  nextShift: null,
  update: (result) =>
    set({
      phase: result.phase,
      activeShift: result.activeShift,
      activeTimeEntry: result.activeTimeEntry,
      nextShift: result.nextShift,
    }),
}));

/** Recalculation interval — 1 minute. Handles time-based phase transitions. */
const RECALC_INTERVAL_MS = 60 * 1000;

/**
 * Hook that provides the current shift phase and associated shift/time entry data.
 *
 * Must be called within a component tree that has QueryClientProvider.
 * Subscribes to shift + time entry queries and recalculates phase on change.
 *
 * @returns { phase, activeShift, activeTimeEntry, nextShift }
 */
export function useShiftPhase() {
  const { data: shiftsData } = useMyShifts();
  const { data: timeEntryData } = useActiveTimeEntry();

  const update = useShiftPhaseStore((s) => s.update);

  // Stabilize shifts reference to avoid unnecessary recalculations
  const shifts = useMemo(() => shiftsData ?? [], [shiftsData]);

  // Ref to hold latest values for the interval callback (avoids stale closures)
  const latestRef = useRef({ shifts, timeEntry: timeEntryData ?? null });
  latestRef.current = { shifts, timeEntry: timeEntryData ?? null };

  // Recalculate on data changes
  useEffect(() => {
    const result = calculateShiftPhase({
      shifts,
      activeTimeEntry: timeEntryData ?? null,
      now: new Date(),
    });
    update(result);
  }, [shifts, timeEntryData, update]);

  // Periodic recalculation for time-based transitions
  useEffect(() => {
    const interval = setInterval(() => {
      const { shifts: currentShifts, timeEntry } = latestRef.current;
      const result = calculateShiftPhase({
        shifts: currentShifts,
        activeTimeEntry: timeEntry,
        now: new Date(),
      });
      update(result);
    }, RECALC_INTERVAL_MS);

    return () => clearInterval(interval);
  }, [update]);

  return useShiftPhaseStore(
    useShallow((s) => ({
      phase: s.phase,
      activeShift: s.activeShift,
      activeTimeEntry: s.activeTimeEntry,
      nextShift: s.nextShift,
    })),
  );
}
