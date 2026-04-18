// packages/ui/src/shift-timeline/types.ts
/**
 * Shared types for the shift timeline primitives.
 *
 * `phase` = the DB phase key (from v_shift_lifecycle). UI labels are
 * resolved at composition time via i18n — primitives never hardcode copy.
 *
 * `state` = the primitive's visual state for a given stage: is it the
 * active one, already completed, still upcoming, or skipped entirely.
 */

export type ShiftPhase = "planlegges" | "pagar" | "oppgjor" | "avsluttet";

export type StageState = "completed" | "active" | "upcoming" | "skipped";

export type StageOrientation = "vertical" | "horizontal";

export type StageBadgeVariant =
  | "deviation"
  | "blocking"
  | "pending-approval"
  | "punched-in"
  | "punched-out"
  | "locked";
