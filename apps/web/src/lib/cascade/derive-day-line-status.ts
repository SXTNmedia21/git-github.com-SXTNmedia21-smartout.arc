/**
 * derive-day-line-status.ts
 *
 * Pure helper — derives the display status of a day_line at read time.
 * Status is NEVER stored in the database (ADR-0367). The precedence order
 * guarantees deterministic output regardless of partial data states:
 *
 *   locked > cancelled > draft > closed > active
 *
 * "locked" wins unconditionally — a reconciliation lock is an auditing seal.
 * "cancelled" wins over lifecycle states — no point showing draft/active/closed
 * for a line the operator has explicitly pulled back.
 * "draft" indicates the parent session has not opened yet.
 * "closed" means the session completed its lifecycle.
 * "active" is the operational state: session is open, line is running.
 */

export type DayLineStatus = "draft" | "active" | "closed" | "locked" | "cancelled";

export type DayLineStatusInput = {
  /** Minimal day_line shape — only the fields needed for derivation. */
  line: {
    cancelled_at: string | null;
    business_date: string;
  };
  /** Derived from department_session.status at the call site. */
  sessionStatus: "draft" | "open" | "closed";
  /** True when daily_reconciliation.locked_at is non-null for this date. */
  reconciliationLocked: boolean;
};

/**
 * Returns the DayLineStatus for a given line + context.
 *
 * Precedence (highest → lowest):
 *   1. locked        — reconciliation seal trumps everything
 *   2. cancelled     — operator explicitly cancelled the line
 *   3. draft         — session has not opened yet
 *   4. closed        — session lifecycle completed
 *   5. active        — session is open and line is operational
 */
export function deriveDayLineStatus({
  line,
  sessionStatus,
  reconciliationLocked,
}: DayLineStatusInput): DayLineStatus {
  if (reconciliationLocked) return "locked";
  if (line.cancelled_at !== null) return "cancelled";
  if (sessionStatus === "draft") return "draft";
  if (sessionStatus === "closed") return "closed";
  return "active";
}
