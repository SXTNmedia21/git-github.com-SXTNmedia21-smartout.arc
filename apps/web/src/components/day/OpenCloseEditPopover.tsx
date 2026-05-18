"use client";

/**
 * OpenCloseEditPopover — STUB
 *
 * Placeholder for the hours-edit popover. CT2 replaces this with the full
 * implementation (time-range inputs + updateDayLineHoursAction wiring).
 *
 * Renders null until CT2 ships. Props accepted for forward-compatibility so
 * DayLineStrip's import is stable and requires no change when CT2 lands.
 *
 * References: ADR-0367 §CT2.
 */

import type { DayLineRow } from "./_hooks/use-day-lines.types";

export type OpenCloseEditPopoverProps = {
  line: DayLineRow;
  onClose: () => void;
};

/**
 * STUB — returns null. CT2 replaces with full popover implementation.
 */
export function OpenCloseEditPopover(_props: OpenCloseEditPopoverProps): null {
  return null;
}
