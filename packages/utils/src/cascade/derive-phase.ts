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
