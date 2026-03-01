// ============================================
// work-hours.ts
// Computes work hours from start/end times and break minutes.
// Handles cross-midnight shifts (e.g., 22:00 → 06:00).
// Connected to: src/tools/create-shift.ts, src/tools/update-shift.ts
// ============================================

/**
 * Converts a HH:MM time string to total minutes since midnight.
 *
 * @param time - Time in "HH:MM" format
 * @returns Minutes since midnight
 */
function timeToMinutes(time: string): number {
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
}

/**
 * Computes work hours from start time, end time, and break duration.
 * Handles cross-midnight shifts by adding 24 hours when end < start.
 *
 * @param startTime - Start time in "HH:MM" format
 * @param endTime - End time in "HH:MM" format
 * @param breakMinutes - Break duration in minutes
 * @returns Work hours as a number rounded to 2 decimal places
 */
export function computeWorkHours(startTime: string, endTime: string, breakMinutes: number): number {
  const startMinutes = timeToMinutes(startTime);
  let endMinutes = timeToMinutes(endTime);

  // Handle cross-midnight shifts (e.g., 22:00 → 06:00)
  if (endMinutes <= startMinutes) {
    endMinutes += 24 * 60;
  }

  const workMinutes = endMinutes - startMinutes - breakMinutes;
  const workHours = Math.max(0, workMinutes) / 60;

  // Round to 2 decimal places to match NUMERIC(4,2) column
  return Math.round(workHours * 100) / 100;
}
