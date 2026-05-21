/**
 * Status gate for day_line task visibility (FINDINGS §2 Gap 2, council Q-A).
 * Tasks surface for an employee whose shift is scheduled (pre-shift prep) or
 * clocked_in (working). Terminal states (clocked_out, cancelled) hide them.
 * Source signal is shift_session.status — NOT shift-phase.ts (time-entry based).
 *
 * NOTE: ShiftSessionRow["status"] in use-shift-session.ts (line 29) exposes the
 * identical literal union: "scheduled"|"clocked_in"|"clocked_out"|"cancelled".
 * We redeclare it here to avoid a cross-layer import of a query hook into a pure
 * helper, keeping this module dependency-free and trivially testable.
 */
export type ShiftSessionStatus = "scheduled" | "clocked_in" | "clocked_out" | "cancelled";

const TASK_VISIBLE_STATUSES: ReadonlySet<string> = new Set(["scheduled", "clocked_in"]);

export function isShiftActiveForTasks(status: ShiftSessionStatus | null | undefined): boolean {
  if (status == null) return false;
  return TASK_VISIBLE_STATUSES.has(status);
}
