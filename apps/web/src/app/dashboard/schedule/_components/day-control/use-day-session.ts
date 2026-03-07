// ============================================
// day-control/use-day-session.ts
// Reads the shared day-session context for the schedule day panel.
// Exists to keep panel tabs decoupled from provider internals.
// Connected to: DaySessionProvider.tsx
// ============================================
"use client";

import { useContext } from "react";

import { DaySessionContext, type DaySessionContextValue } from "./DaySessionProvider";

/**
 * Returns the active shared day-session context.
 *
 * Why: day-panel tabs should consume one typed contract instead of importing
 * query hooks and local state independently.
 *
 * Returns: the current day-session context value.
 */
export function useDaySession(): DaySessionContextValue {
  const context = useContext(DaySessionContext);
  if (!context) {
    throw new Error("useDaySession must be used within a DaySessionProvider");
  }

  return context;
}
