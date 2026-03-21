/**
 * compute_anchored_shift — Cascade Phase B Pure Function #2
 *
 * Resolves a shift's start or end time based on its anchor type:
 * - fixed: use the fixedTime directly
 * - open: openTime + offsetMin
 * - close: closeTime + offsetMin
 *
 * Falls back to fixedTime if hours are closed.
 *
 * Spec: Section 3 Phase B, Function #2
 */

import type { AnchorInput, ComputedShiftTime, EffectiveHours } from "./types";

function addMinutesToTime(time: string, minutes: number): { time: string; isNextDay: boolean } {
  const parts = time.split(":").map(Number);
  const h = parts[0] ?? 0;
  const m = parts[1] ?? 0;
  let totalMinutes = h * 60 + m + minutes;

  let isNextDay = false;
  if (totalMinutes >= 24 * 60) {
    totalMinutes -= 24 * 60;
    isNextDay = true;
  } else if (totalMinutes < 0) {
    totalMinutes += 24 * 60;
    // Negative wrap means previous day — unusual but handle gracefully
  }

  const newH = Math.floor(totalMinutes / 60);
  const newM = totalMinutes % 60;
  return {
    time: `${String(newH).padStart(2, "0")}:${String(newM).padStart(2, "0")}`,
    isNextDay,
  };
}

export function computeAnchoredTime(anchor: AnchorInput, hours: EffectiveHours): ComputedShiftTime {
  // Fallback to fixed when hours are closed or anchor references unavailable time
  if (!hours.isOpen || (anchor.anchorType !== "fixed" && !hours.openTime && !hours.closeTime)) {
    return {
      resolvedTime: anchor.fixedTime ?? "00:00",
      source: "fixed",
      isNextDay: false,
    };
  }

  switch (anchor.anchorType) {
    case "fixed": {
      return {
        resolvedTime: anchor.fixedTime ?? "00:00",
        source: "fixed",
        isNextDay: false,
      };
    }
    case "open": {
      if (!hours.openTime) {
        return { resolvedTime: anchor.fixedTime ?? "00:00", source: "fixed", isNextDay: false };
      }
      const result = addMinutesToTime(hours.openTime, anchor.offsetMin);
      return { resolvedTime: result.time, source: "open", isNextDay: result.isNextDay };
    }
    case "close": {
      if (!hours.closeTime) {
        return { resolvedTime: anchor.fixedTime ?? "00:00", source: "fixed", isNextDay: false };
      }
      const result = addMinutesToTime(hours.closeTime, anchor.offsetMin);
      // If hours already cross midnight, the close-anchored shift is inherently next-day
      const isNextDay = hours.crossesMidnight || result.isNextDay;
      return { resolvedTime: result.time, source: "close", isNextDay };
    }
  }
}
