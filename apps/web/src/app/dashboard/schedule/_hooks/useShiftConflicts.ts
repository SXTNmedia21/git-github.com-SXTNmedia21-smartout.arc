"use client";

import { useMemo } from "react";

type ShiftSlot = {
  shiftId: string;
  employeeId: string | null;
  dateId: string;
  startTime: string;
  endTime: string;
};

export type ConflictWarning = {
  shiftIdA: string;
  shiftIdB: string;
  employeeId: string;
  message: string;
};

/**
 * Detects overlapping shifts for the same employee.
 * Pure client-side computation — no DB queries.
 * Runs on the shift array already loaded by the schedule page.
 */
export function useShiftConflicts(shifts: ShiftSlot[]): ConflictWarning[] {
  return useMemo(() => {
    const conflicts: ConflictWarning[] = [];
    const assigned = shifts.filter((s) => s.employeeId);

    for (let i = 0; i < assigned.length; i++) {
      const a = assigned[i]!;
      for (let j = i + 1; j < assigned.length; j++) {
        const b = assigned[j]!;

        if (a.employeeId !== b.employeeId) continue;
        // Conflict requires SAME DAY — different dates with same times is not an overlap.
        if (a.dateId !== b.dateId) continue;

        // Parse time strings (HH:mm format) for comparison.
        // Cross-midnight handling: if endTime <= startTime, treat as next-day (+24h).
        const aStart = parseTime(a.startTime);
        const aEndRaw = parseTime(a.endTime);
        const aEnd = aEndRaw <= aStart ? aEndRaw + 1440 : aEndRaw;
        const bStart = parseTime(b.startTime);
        const bEndRaw = parseTime(b.endTime);
        const bEnd = bEndRaw <= bStart ? bEndRaw + 1440 : bEndRaw;

        const overlaps = aStart < bEnd && bStart < aEnd;
        if (overlaps) {
          conflicts.push({
            shiftIdA: a.shiftId,
            shiftIdB: b.shiftId,
            employeeId: a.employeeId!,
            message: "Overlappende vakter for samme ansatt",
          });
        }
      }
    }

    return conflicts;
  }, [shifts]);
}

/** Parse "HH:mm" time string to minutes since midnight for comparison */
function parseTime(time: string): number {
  const parts = time.split(":").map(Number);
  return (parts[0] ?? 0) * 60 + (parts[1] ?? 0);
}
