/**
 * Cascade — Build Entity Context
 *
 * Pure function that constructs an EntityContext from an employee's
 * existing shifts and a draft shift being created/edited.
 * Used by useShiftRuleCheck() to feed evaluateFrameworkRules().
 *
 * No database dependencies — takes pre-loaded data, returns EntityContext.
 */

import type { EntityContext } from "./types";

type ShiftInput = {
  startTime: string; // HH:MM
  endTime: string; // HH:MM
  date: string; // YYYY-MM-DD
};

type EmployeeContext = {
  birthDate: string | null;
  contractType: string | null;
};

/**
 * Computes shift duration in hours from HH:MM strings.
 * Handles overnight shifts where endTime < startTime.
 */
function computeDurationHours(startTime: string, endTime: string): number {
  const [startH, startM] = startTime.split(":").map(Number) as [number, number];
  const [endH, endM] = endTime.split(":").map(Number) as [number, number];

  let startMinutes = startH * 60 + startM;
  let endMinutes = endH * 60 + endM;

  if (endMinutes <= startMinutes) {
    endMinutes += 24 * 60;
  }

  return (endMinutes - startMinutes) / 60;
}

/**
 * Computes employee age in full years at a given date.
 * Returns undefined if birthDate is null.
 */
function computeAge(birthDate: string, atDate: string): number {
  const birth = new Date(birthDate);
  const at = new Date(atDate);

  let age = at.getFullYear() - birth.getFullYear();
  const monthDiff = at.getMonth() - birth.getMonth();

  if (monthDiff < 0 || (monthDiff === 0 && at.getDate() < birth.getDate())) {
    age--;
  }

  return age;
}

/**
 * Builds an EntityContext from existing shifts + a draft shift.
 *
 * - dailyHoursWorked: sum of all shifts on the draft's date (including draft)
 * - weeklyHoursWorked: sum of all shifts in the array + draft
 * - lastShiftEnd: closest prior shift end before draft start (ISO timestamp)
 * - employeeAge: age computed from birthDate vs draft date
 */
export function buildEntityContext(
  existingShifts: ShiftInput[],
  draftShift: ShiftInput,
  employeeContext: EmployeeContext,
): EntityContext {
  const draftDuration = computeDurationHours(draftShift.startTime, draftShift.endTime);
  const draftDate = draftShift.date;

  // Daily hours: sum shifts on the same date as the draft + draft itself
  const dailySameDate = existingShifts.filter((s) => s.date === draftDate);
  const dailyExistingHours = dailySameDate.reduce(
    (sum, s) => sum + computeDurationHours(s.startTime, s.endTime),
    0,
  );
  const dailyHoursWorked = dailyExistingHours + draftDuration;

  // Weekly hours: sum of all existing shifts + draft
  const weeklyExistingHours = existingShifts.reduce(
    (sum, s) => sum + computeDurationHours(s.startTime, s.endTime),
    0,
  );
  const weeklyHoursWorked = weeklyExistingHours + draftDuration;

  // Last shift end: find closest prior shift end before draft start
  // Compare as "YYYY-MM-DDTHH:MM" timestamps
  const draftStartTimestamp = `${draftDate}T${draftShift.startTime}`;
  let lastShiftEnd: string | undefined;

  for (const shift of existingShifts) {
    const shiftEndTimestamp = `${shift.date}T${shift.endTime}`;
    if (shiftEndTimestamp < draftStartTimestamp) {
      if (!lastShiftEnd || shiftEndTimestamp > lastShiftEnd) {
        lastShiftEnd = shiftEndTimestamp;
      }
    }
  }

  // Employee age
  const employeeAge = employeeContext.birthDate
    ? computeAge(employeeContext.birthDate, draftDate)
    : undefined;

  return {
    date: draftDate,
    dailyHoursWorked,
    weeklyHoursWorked,
    lastShiftEnd,
    employeeAge,
    contractType: employeeContext.contractType ?? undefined,
  };
}
