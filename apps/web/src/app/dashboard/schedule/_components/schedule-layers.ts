// ============================================
// schedule-layers.ts
// Central z-index hierarchy for schedule surfaces and overlays.
// Keeps visual stacking deterministic so sticky headers, bars,
// dialogs, and day planner interactions do not fight each other.
// Connected to: schedule page + schedule UI components.
// ============================================

/**
 * Schedule-specific layer definitions.
 *
 * Why this exists:
 * - Prevent ad-hoc z-index values from drifting across components
 * - Keep Botson showcase interactions (focus/scroll/highlight/open planner)
 *   predictable when overlays are active
 * - Ensure modal/sheet layers always win over sticky grid surfaces
 */
export const SCHEDULE_LAYERS = {
  base: 0,
  stickyContent: 10,
  stickyHeaders: 20,
  stickyCorner: 30,
  floatingActionBar: 30,
  dayPlannerBackdrop: 60,
  dayPlannerSheet: 70,
} as const;
