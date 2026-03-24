/**
 * index.ts — Public API for @smartout/shift-clock.
 * Pure logic only — no DB access, no React hooks, no Supabase.
 * Consumed by apps/web and apps/mobile.
 */

export {
  type ShiftClockPhase,
  type ShiftClockState,
  type GPSSnapshot,
  type GPSConfig,
  type BreakClassification,
  type BreakEntry,
  type SupplementOption,
  type SupplementClaim,
  type PunchResult,
  type ComplianceWarning,
} from "./types";

export {
  gpsSnapshotSchema,
  punchInPayloadSchema,
  punchOutPayloadSchema,
  breakStartPayloadSchema,
  breakEndPayloadSchema,
  supplementClaimSchema,
  shiftNoteSchema,
  type PunchInPayload,
  type PunchOutPayload,
  type BreakStartPayload,
  type BreakEndPayload,
  type SupplementClaimPayload,
  type ShiftNotePayload,
} from "./schemas";

export { calculateGPSDistance } from "./utils/gps-distance";
export { classifyBreak } from "./utils/break-classifier";
export { calculatePunchPoints } from "./utils/points-calculator";
export { type ShiftClockTransition, canTransition, getNextPhase } from "./state-machine";
