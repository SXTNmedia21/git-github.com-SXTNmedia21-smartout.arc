// packages/utils/src/cascade/derive-phase.ts
//
// Phase derivation helper for D6 department_session surfaces.
//
// DB enum `department_session_status` has 5 values:
//   upcoming | active | pending_signoff | closed | missed
//
// UI widgets (e.g. WebDayControl, mobile day view) need a 6th phase `locked`
// which represents "reconciliation finalised, day cannot re-open". Locked is a
// derivation of `session.status = 'closed'` + `reconciliation.status = 'locked'`,
// not a stored value.
//
// Per ADR-0156 + L-0064: components must consume `UiPhase` via this helper,
// never raw `DepartmentSessionStatus`. Never persist a derived value.

export type UiPhase = "upcoming" | "active" | "pending_signoff" | "closed" | "missed" | "locked";

export type DepartmentSessionStatusSubset =
  | "upcoming"
  | "active"
  | "pending_signoff"
  | "closed"
  | "missed";

export type DailyReconciliationStatusSubset =
  | "open"
  | "submitted"
  | "awaiting_approval"
  | "approved"
  | "locked"
  | "unreconciled";

export interface PhaseSession {
  status: DepartmentSessionStatusSubset;
}

export interface PhaseReconciliation {
  status: DailyReconciliationStatusSubset;
}

/**
 * Derive the UI phase from persisted session + reconciliation state.
 *
 * `closed` + `recon.status === 'locked'` → `locked`. Otherwise passthrough.
 * Reconciliation may be undefined/null when the row has not been created yet —
 * treated as "not locked".
 */
export function derivePhase(session: PhaseSession, recon?: PhaseReconciliation | null): UiPhase {
  if (session.status === "closed" && recon?.status === "locked") {
    return "locked";
  }
  return session.status;
}

// ─── Phase Boundaries ────────────────────────────────────────────────────────

/**
 * Parse "HH:MM" string to minutes-of-day. Returns null if input is invalid.
 */
function hhmmToMinutes(hhmm: string | null | undefined): number | null {
  if (!hhmm) return null;
  const parts = hhmm.split(":").map(Number);
  const h = parts[0];
  const m = parts[1] ?? 0;
  if (h === undefined || Number.isNaN(h) || Number.isNaN(m)) return null;
  return h * 60 + m;
}

/**
 * Compute the three phase time-ranges (minute-of-day) for a D6 department_session.
 *
 * - Prep   = first 30 min of session
 * - Service = middle of session
 * - WindDown = last 30 min of session
 *
 * If the session spans ≤ 60 min total, prep and windDown collapse to 0 width
 * and service spans the full range.
 *
 * Handles midnight wrap: if plannedClose < plannedOpen, adds 1440 to close so
 * all ranges are in a monotone minute space.
 *
 * Returns null if either bound is missing or cannot be parsed.
 */
export function getPhaseBoundaries(session: {
  plannedOpen: string | null;
  plannedClose: string | null;
}): {
  prep: [number, number];
  service: [number, number];
  windDown: [number, number];
} | null {
  const open = hhmmToMinutes(session.plannedOpen);
  const rawClose = hhmmToMinutes(session.plannedClose);

  if (open === null || rawClose === null) return null;

  // Handle midnight wrap — close before open means the session crosses 00:00.
  const close = rawClose < open ? rawClose + 24 * 60 : rawClose;
  const duration = close - open;

  const PREP_WIN_MIN = 30;

  if (duration <= 2 * PREP_WIN_MIN) {
    // Session ≤ 60 min — prep and windDown collapse, service spans full range.
    return {
      prep: [open, open],
      service: [open, close],
      windDown: [close, close],
    };
  }

  return {
    prep: [open, open + PREP_WIN_MIN],
    service: [open + PREP_WIN_MIN, close - PREP_WIN_MIN],
    windDown: [close - PREP_WIN_MIN, close],
  };
}
