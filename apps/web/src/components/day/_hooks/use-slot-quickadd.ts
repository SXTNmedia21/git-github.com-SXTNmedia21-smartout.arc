"use client";

// =============================================================================
// use-slot-quickadd.ts
//
// Bridge hook — maps a slot time to open-state setters for the five quick-add
// targets. Callers lift open-state to their nearest common parent (TimelineTab)
// and pass setters down. This hook bundles them into named openers so
// SlotQuickAddPopover only needs to call openBooking("14:00") etc.
//
// Why here: keeps the popover component pure (no state, just display + emit).
// =============================================================================

export type SlotQuickAddOpenState = {
  /** Currently selected time from timeline click, or null when no popover open. */
  slotTime: string | null;
  bookingOpen: boolean;
  noteOpen: boolean;
  taskOpen: boolean;
  deviationOpen: boolean;
  shiftStartOpen: boolean;
};

export type SlotQuickAddSetters = {
  setSlotTime: (time: string | null) => void;
  setBookingOpen: (open: boolean) => void;
  setNoteOpen: (open: boolean) => void;
  setTaskOpen: (open: boolean) => void;
  setDeviationOpen: (open: boolean) => void;
  setShiftStartOpen: (open: boolean) => void;
};

export type SlotQuickAddBridge = {
  openBooking: (time: string) => void;
  openNote: (time: string) => void;
  openTask: (time: string) => void;
  openDeviation: (time: string) => void;
  openShiftStart: (time: string) => void;
};

/**
 * Composes five "open with prefilled time" functions from individual state
 * setters. Each function sets the shared slotTime and opens exactly one target.
 *
 * Usage:
 *   const bridge = useSlotQuickAdd(setters);
 *   // In SlotQuickAddPopover:
 *   bridge.openBooking("14:00");
 */
export function useSlotQuickAdd(setters: SlotQuickAddSetters): SlotQuickAddBridge {
  const {
    setSlotTime,
    setBookingOpen,
    setNoteOpen,
    setTaskOpen,
    setDeviationOpen,
    setShiftStartOpen,
  } = setters;

  function openBooking(time: string) {
    setSlotTime(time);
    setBookingOpen(true);
  }

  function openNote(time: string) {
    setSlotTime(time);
    setNoteOpen(true);
  }

  function openTask(time: string) {
    setSlotTime(time);
    setTaskOpen(true);
  }

  function openDeviation(time: string) {
    setSlotTime(time);
    setDeviationOpen(true);
  }

  function openShiftStart(time: string) {
    setSlotTime(time);
    setShiftStartOpen(true);
  }

  return { openBooking, openNote, openTask, openDeviation, openShiftStart };
}
