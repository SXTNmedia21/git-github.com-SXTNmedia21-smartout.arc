import { describe, test, expect } from "vitest";
import { EVENT_ROUTING, type SmartoutEvent } from "../registry";

type EventName = SmartoutEvent["event"];

// Phase 2 Task 2.3 of Billing Engine Fase 1. Two-part contract:
//
// 1. Structural: every canonical billing event is registered in
//    EVENT_ROUTING, carries billing_activity_log in its destinations, and
//    sits under the `billing` category.
//
// 2. Coverage (test.todo below): every call-site in the codebase that
//    mutates a billing entity MUST call emit() with the right event name.
//    The todo flips to a real `test.each` when Phase 7 lands Server
//    Actions — the list below is the forcing function.

const BILLING_EVENTS: EventName[] = [
  "invoice generated",
  "invoice issued",
  "invoice sent",
  "invoice marked_paid",
  "invoice voided",
  "invoice overdue_detected",
  "invoice credit_note_issued",
  "invoice basis_drift_detected",
  "usage_snapshot created",
  "pricing_terms updated",
  "dunning_note added",
];

describe("billing emit coverage (Phase 2)", () => {
  test.each(BILLING_EVENTS)("'%s' is registered in EVENT_ROUTING", (event) => {
    expect(EVENT_ROUTING[event]).toBeDefined();
  });

  test.each(BILLING_EVENTS)("'%s' routes to billing_activity_log (ADR-0125)", (event) => {
    expect(EVENT_ROUTING[event].destinations).toContain("billing_activity_log");
  });

  test.each(BILLING_EVENTS)("'%s' is categorised as 'billing'", (event) => {
    expect(EVENT_ROUTING[event].category).toBe("billing");
  });

  test("no billing event routes to activity_trail (profile-scoped actor would break platform-admin writes)", () => {
    for (const event of BILLING_EVENTS) {
      expect(EVENT_ROUTING[event].destinations).not.toContain("activity_trail");
    }
  });

  // ─── Coverage todo (flipped to real assertions in Phase 7) ─────
  // When Server Actions for mark_paid / void / credit_note_issue /
  // dunning_note_add land, populate `billingMutationSites` with entries
  // of the form:
  //
  //   { file: 'apps/web/src/app/platform-admin/billing/_actions/markInvoicePaid.ts',
  //     mutation: 'markInvoicePaidAction',
  //     event: 'invoice marked_paid' }
  //
  // Then switch this block from `test.todo` to `test.each(...)` and assert
  // that dynamic import + invocation triggers emit() with the expected
  // event name. Forcing function — CI fails if a new billing Server Action
  // is added to the codebase without a corresponding mutation-site entry.
  test.todo(
    "every billing Server Action / cron mutation-site calls emit() with a canonical billing event (flips on in Phase 7)",
  );
});
