/**
 * D3 Rules validation for shift swap eligibility.
 * Pure function — no Supabase, no React. Importable from web, mobile, and server.
 *
 * Checks (per spec):
 * 1. Temporal lock   — shift must not have started or passed (ADR-0066)
 * 2. Overlap         — target must not have a conflicting shift on the swap date
 * 3. Qualification   — position_id must match between shifts
 * 4. Absence         — neither party can have active absence
 * 5. Weekly hours    — warn if swap pushes either party over 37.5h/week
 * 6. 11-hour rest    — warn if rest period < 11 hours (Arbeidsmiljoloven)
 * 7. Delt dagsverk   — warn if gap > 2 hours triggers split shift supplement (Riksavtalen +28 kr/t)
 */

import type { ShiftForValidation, SwapValidationResult } from "./types";

/** Riksavtalen/Arbeidsmiljoloven constants */
const WEEKLY_HOURS_LIMIT = 37.5;
const REST_HOURS_MINIMUM = 11;
const SPLIT_SHIFT_GAP_HOURS = 2;
const SPLIT_SHIFT_SUPPLEMENT_KR = 28;

export function validateSwap(params: {
  requesterShift: ShiftForValidation;
  targetShift: ShiftForValidation;
  targetEmployeeShifts: ShiftForValidation[];
  requesterEmployeeShifts: ShiftForValidation[];
  targetHasAbsence: boolean;
  requesterHasAbsence: boolean;
  now: Date;
}): SwapValidationResult {
  const blockers: string[] = [];
  const warnings: string[] = [];

  // ── 1. Temporal lock — shift must not have started or passed ───────────────
  const requesterShiftStart = new Date(
    `${params.requesterShift.shift_date}T${params.requesterShift.start_time}`,
  );
  const targetShiftStart = new Date(
    `${params.targetShift.shift_date}T${params.targetShift.start_time}`,
  );

  if (requesterShiftStart <= params.now) {
    blockers.push("swap.blockerLocked");
  }
  if (targetShiftStart <= params.now) {
    blockers.push("swap.blockerLocked");
  }

  // ── 2. Overlap — does the target have a conflicting shift on the requester's date? ──
  const targetHasOverlap = params.targetEmployeeShifts.some((s) => {
    if (s.schedule_shift_id === params.targetShift.schedule_shift_id) return false;
    if (s.shift_date !== params.requesterShift.shift_date) return false;
    return (
      s.start_time < params.requesterShift.end_time && s.end_time > params.requesterShift.start_time
    );
  });
  if (targetHasOverlap) {
    blockers.push("swap.blockerOverlap");
  }

  // Check reverse overlap — does the requester have a conflicting shift on the target's date?
  const requesterHasOverlap = params.requesterEmployeeShifts.some((s) => {
    if (s.schedule_shift_id === params.requesterShift.schedule_shift_id) return false;
    if (s.shift_date !== params.targetShift.shift_date) return false;
    return s.start_time < params.targetShift.end_time && s.end_time > params.targetShift.start_time;
  });
  if (requesterHasOverlap) {
    blockers.push("swap.blockerOverlap");
  }

  // ── 3. Qualification — position must match ────────────────────────────────
  if (
    params.requesterShift.position_id &&
    params.targetShift.position_id &&
    params.requesterShift.position_id !== params.targetShift.position_id
  ) {
    blockers.push("swap.blockerQualification");
  }

  // ── 4. Absence — check both parties ───────────────────────────────────────
  if (params.targetHasAbsence) {
    blockers.push("swap.blockerAbsence");
  }
  if (params.requesterHasAbsence) {
    blockers.push("swap.blockerAbsence");
  }

  // ── 5. Weekly hours — warn if swap pushes either over 37.5h/week ──────────
  const targetWeekHours = params.targetEmployeeShifts
    .filter((s) => isSameISOWeek(s.shift_date, params.requesterShift.shift_date))
    .reduce((sum, s) => sum + s.work_hours, 0);
  const adjustedTargetHours =
    targetWeekHours - params.targetShift.work_hours + params.requesterShift.work_hours;

  if (adjustedTargetHours > WEEKLY_HOURS_LIMIT) {
    warnings.push("swap.warningHours");
  }

  const requesterWeekHours = params.requesterEmployeeShifts
    .filter((s) => isSameISOWeek(s.shift_date, params.targetShift.shift_date))
    .reduce((sum, s) => sum + s.work_hours, 0);
  const adjustedRequesterHours =
    requesterWeekHours - params.requesterShift.work_hours + params.targetShift.work_hours;

  if (adjustedRequesterHours > WEEKLY_HOURS_LIMIT) {
    warnings.push("swap.warningHours");
  }

  // ── 6. 11-hour rest — check gap between shifts for target ─────────────────
  const targetOtherShifts = params.targetEmployeeShifts
    .filter((s) => s.schedule_shift_id !== params.targetShift.schedule_shift_id)
    .sort((a, b) => {
      const dateCompare = a.shift_date.localeCompare(b.shift_date);
      return dateCompare !== 0 ? dateCompare : a.start_time.localeCompare(b.start_time);
    });

  for (const adjacent of targetOtherShifts) {
    const gapHours = calculateGapHours(
      params.requesterShift.end_time,
      adjacent.start_time,
      params.requesterShift.shift_date,
      adjacent.shift_date,
    );
    if (gapHours > 0 && gapHours < REST_HOURS_MINIMUM) {
      warnings.push("swap.warningRest");
      break;
    }
  }

  // ── 7. Delt dagsverk — gap > 2 hours between shifts on same day ───────────
  // Riksavtalen: triggers +28 kr/t supplement when daily working time is split
  let tariff_delta: number | undefined;
  for (const adjacent of targetOtherShifts) {
    if (adjacent.shift_date !== params.requesterShift.shift_date) continue;
    const gapHours = calculateGapHours(
      params.requesterShift.end_time,
      adjacent.start_time,
      params.requesterShift.shift_date,
      adjacent.shift_date,
    );
    if (gapHours > SPLIT_SHIFT_GAP_HOURS) {
      warnings.push("swap.warningSplitShift");
      tariff_delta = SPLIT_SHIFT_SUPPLEMENT_KR;
      break;
    }
  }

  return {
    eligible: blockers.length === 0,
    blockers,
    warnings,
    tariff_delta,
  };
}

// ── Helpers ─────────────────────────────────────────────────────────────────

/** Check if two dates fall in the same ISO week (Mon-Sun) */
function isSameISOWeek(dateA: string, dateB: string): boolean {
  const a = new Date(dateA);
  const b = new Date(dateB);
  return a.getFullYear() === b.getFullYear() && getISOWeek(a) === getISOWeek(b);
}

/** ISO 8601 week number (Monday = start of week) */
function getISOWeek(d: Date): number {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  date.setUTCDate(date.getUTCDate() + 4 - (date.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  return Math.ceil(((date.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
}

/** Calculate gap in hours between end of one shift and start of another */
function calculateGapHours(
  endTime: string,
  startTime: string,
  endDate: string,
  startDate: string,
): number {
  const end = new Date(`${endDate}T${endTime}`);
  const start = new Date(`${startDate}T${startTime}`);
  return (start.getTime() - end.getTime()) / 3600000;
}
