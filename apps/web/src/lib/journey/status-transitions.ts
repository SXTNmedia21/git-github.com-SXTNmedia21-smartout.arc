// ============================================
// status-transitions.ts
// Journey status state machine and metadata.
// Defines which status transitions are valid,
// maps statuses to lifecycle phases, and provides
// display metadata (label, icon name, color) for each status.
// Connected to: packages/types/src/journey.ts (JourneyStatus, JourneyPhase types)
// ============================================

import type { JourneyStatus, JourneyPhase } from "@smartout/types";

/**
 * Maps each journey status to its valid next statuses.
 *
 * Why: Prevents invalid state transitions in the UI.
 * The journey lifecycle flows through definition → planning → build → test → release,
 * with specific rollback paths allowed at each stage.
 */
const TRANSITIONS: Record<JourneyStatus, JourneyStatus[]> = {
  idea: ["wizard"],
  wizard: ["defined", "idea"],
  defined: ["ready_impl", "idea"],
  ready_impl: ["building"],
  building: ["review", "ready_impl"],
  review: ["ready_test", "building"],
  ready_test: ["testing"],
  testing: ["ready_validation", "building"],
  ready_validation: ["implemented", "testing"],
  implemented: ["active", "inactive"],
  active: ["inactive", "broken"],
  inactive: ["active", "idea"],
  broken: ["testing"],
};

/**
 * Returns the list of statuses a journey can move to from its current status.
 *
 * @param current - The journey's current status
 * @returns Array of valid next statuses (empty if none)
 */
export function getValidTransitions(current: JourneyStatus): JourneyStatus[] {
  return TRANSITIONS[current] ?? [];
}

/**
 * Checks whether moving from one status to another is allowed.
 *
 * @param from - The current status
 * @param to - The desired next status
 * @returns True if the transition is valid
 */
export function isValidTransition(from: JourneyStatus, to: JourneyStatus): boolean {
  return getValidTransitions(from).includes(to);
}

/**
 * Maps a journey status to its lifecycle phase.
 * Phases group related statuses for filtering and display.
 *
 * Why: The journey board uses phases as column groups.
 * This is the single source of truth for which statuses belong to which phase.
 *
 * @param status - The journey status to classify
 * @returns The lifecycle phase the status belongs to
 */
export function getPhase(status: JourneyStatus): JourneyPhase {
  switch (status) {
    case "idea":
    case "wizard":
    case "defined":
      return "definition";
    case "ready_impl":
      return "planning";
    case "building":
    case "review":
      return "build";
    case "ready_test":
    case "testing":
    case "ready_validation":
      return "test";
    case "implemented":
    case "active":
    case "inactive":
    case "broken":
      return "release";
  }
}

/**
 * Display metadata for each journey status.
 * Icon names reference lucide-react icon components.
 * Colors are hex values for badges and status indicators.
 */
export const STATUS_META: Record<JourneyStatus, { label: string; icon: string; color: string }> = {
  idea: { label: "Idea", icon: "Lightbulb", color: "#e2e8f0" },
  wizard: { label: "Wizard", icon: "Wand2", color: "#c084fc" },
  defined: { label: "Defined", icon: "ClipboardList", color: "#6366f1" },
  ready_impl: {
    label: "Ready for Impl",
    icon: "FileText",
    color: "#2563eb",
  },
  building: { label: "Building", icon: "Hammer", color: "#f59e0b" },
  review: { label: "In Review", icon: "Eye", color: "#a855f7" },
  ready_test: {
    label: "Ready for Test",
    icon: "TestTube2",
    color: "#7c3aed",
  },
  testing: { label: "Testing", icon: "FlaskConical", color: "#8b5cf6" },
  ready_validation: {
    label: "Ready for Validation",
    icon: "CheckCircle2",
    color: "#059669",
  },
  implemented: { label: "Implemented", icon: "Rocket", color: "#0d9488" },
  active: { label: "Active", icon: "CircleDot", color: "#10b981" },
  inactive: { label: "Inactive", icon: "CircleMinus", color: "#6b7280" },
  broken: { label: "Broken", icon: "AlertTriangle", color: "#ef4444" },
};
