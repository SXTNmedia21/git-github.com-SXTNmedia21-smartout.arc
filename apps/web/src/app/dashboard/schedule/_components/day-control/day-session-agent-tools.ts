// ============================================
// day-control/day-session-agent-tools.ts
// Builds the explicit day-session tool seam for future voice or agent control.
// Exists to avoid ad hoc DOM manipulation when the day panel becomes agent-aware.
// Connected to: DaySessionProvider.tsx and schedule-voice-tools-bridge.tsx
// ============================================

import type { DaySessionEvidenceDraft, DaySessionSnapshot } from "../../_hooks/day-session-model";

export type DaySessionAgentToolSet = {
  getDaySessionState: () => DaySessionSnapshot | null;
  focusTask: (taskId: string) => void;
  focusField: (fieldId: string) => void;
  updateEvidenceDraft: (taskId: string, patch: DaySessionEvidenceDraft) => void;
};

type CreateDaySessionAgentToolsInput = {
  getSnapshot: () => DaySessionSnapshot | null;
  focusTask: (taskId: string) => void;
  focusField: (fieldId: string) => void;
  updateEvidenceDraft: (taskId: string, patch: DaySessionEvidenceDraft) => void;
};

/**
 * Creates the narrow explicit day-session agent tool surface.
 *
 * Why: the panel needs a future-safe bridge that only exposes allowed shared
 * state actions instead of unrestricted DOM control.
 *
 * Returns: the agent-callable day-session tool set.
 */
export function createDaySessionAgentTools({
  getSnapshot,
  focusTask,
  focusField,
  updateEvidenceDraft,
}: CreateDaySessionAgentToolsInput): DaySessionAgentToolSet {
  return {
    getDaySessionState: () => getSnapshot(),
    focusTask,
    focusField,
    updateEvidenceDraft,
  };
}
