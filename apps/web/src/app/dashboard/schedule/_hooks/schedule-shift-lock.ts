/**
 * Client-side approximation of the `schedule_shift_is_temporally_locked`
 * PL/pgSQL function (supabase/migrations/20260428130000_schedule_shift_temporal_lock.sql).
 *
 * Why: the trigger rejects planning mutations on past/started shifts. This
 * helper lets the UI preempt that so users don't click, fail, and see a
 * generic 400. Server-side is still the source of truth — this is UX only.
 */

type LockableShift = {
  dateId: string;
  startTime: string;
};

export function isShiftTemporallyLocked(shift: LockableShift): boolean {
  const [year, month, day] = shift.dateId.split("-").map(Number);
  const [startHour, startMinute] = shift.startTime.split(":").map(Number);

  if (
    year === undefined ||
    month === undefined ||
    day === undefined ||
    startHour === undefined ||
    startMinute === undefined
  ) {
    return false;
  }

  const shiftStartLocal = new Date(year, month - 1, day, startHour, startMinute, 0, 0);
  return shiftStartLocal.getTime() <= Date.now();
}
