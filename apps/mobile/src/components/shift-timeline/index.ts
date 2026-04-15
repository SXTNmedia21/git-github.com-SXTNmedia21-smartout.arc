/**
 * apps/mobile/src/components/shift-timeline — barrel.
 *
 * Council 6.4 (2026-04-15) locked these components to apps/mobile — a new
 * `packages/ui-native` was explicitly rejected. Web primitives remain in
 * `packages/ui/src/shift-timeline/` unchanged.
 */

export { ShiftTimeline, type ShiftTimelineProps } from "./ShiftTimeline";
export { PhaseOrb } from "./PhaseOrb";
export { PhaseStrip, PHASE_STRIP_HEIGHT, type PhaseStripProps } from "./PhaseStrip";
export { PhaseExplainer } from "./PhaseExplainer";
export { ShiftTimelineContainer } from "./ShiftTimelineContainer";
export {
  PHASE_ORDER,
  deriveStageState,
  type ShiftLifecyclePhase,
  type ShiftLifecycleRow,
  type StageState,
  type TimelineBotssonIntent,
  type TimelineOpenReason,
} from "./types";
