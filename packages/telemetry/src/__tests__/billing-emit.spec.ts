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
  // Fase 1
  "invoice generated",
  "invoice issued",
  "invoice sent",
  "invoice marked_paid",
  "invoice voided",
  "invoice marked_uncollectible",
  "invoice overdue_detected",
  "invoice credit_note_issued",
  "invoice basis_drift_detected",
  "usage_snapshot created",
  "pricing_terms updated",
  "dunning_note added",
  // Fase 2 (ADR-0126 to ADR-0130)
  "invoice dispatched",
  "invoice dispatch failed",
  "invoice dispatch retried",
  "invoice dispatch retry_requested",
  "integration sync succeeded",
  "integration sync failed",
  "integration sync mocked",
  "integration test_connection succeeded",
  "integration test_connection failed",
  "invoice line_item added",
  "invoice line_item edited",
  "invoice line_item removed",
  "invoice adhoc_created",
  "workspace marked_paid",
  "dispatch_rule created",
  "dispatch_rule updated",
  "dispatch_rule deleted",
  "integration created",
  "integration updated",
  "integration deleted",
  "dispatch_rule evaluated",
];

// Fase 2 events that are logger-only by design (no billing_activity_log):
// - `invoice dispatch retried` is high-volume retry debug
// - `integration sync mocked` is ADR-0129 mock-honesty (not audit-worthy)
// - `dispatch_rule evaluated` is debug-only per-cycle summary
const LOGGER_ONLY_FASE_2_EVENTS: EventName[] = [
  "invoice dispatch retried",
  "integration sync mocked",
  "dispatch_rule evaluated",
];

// Fase 2 event-name convention gate: no event name may contain '.'.
// pgTAP enforces this for engine_trigger + billing_dispatch_rule on the
// data side; this assertion covers the registry side.
const FASE_2_EVENTS_FOR_CONVENTION_AUDIT: EventName[] = BILLING_EVENTS.filter(
  (e) =>
    e.startsWith("invoice dispatch") ||
    e.startsWith("integration ") ||
    e.startsWith("invoice line_item") ||
    e === "invoice adhoc_created" ||
    e === "workspace marked_paid" ||
    e.startsWith("dispatch_rule "),
);

describe("billing emit coverage (Phase 2)", () => {
  test.each(BILLING_EVENTS)("'%s' is registered in EVENT_ROUTING", (event) => {
    expect(EVENT_ROUTING[event]).toBeDefined();
  });

  test.each(BILLING_EVENTS)("'%s' routes to billing_activity_log (ADR-0125)", (event) => {
    // Logger-only Fase 2 events (retry debug, mocked audit-honesty,
    // rule-eval debug) are intentionally not routed to billing_activity_log
    // per ADR-0126/ADR-0129 + spec §11.
    if (LOGGER_ONLY_FASE_2_EVENTS.includes(event)) {
      expect(EVENT_ROUTING[event].destinations).not.toContain("billing_activity_log");
      return;
    }
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

  // ─── Fase 2 convention: no event name uses dot-separator ─────
  // Mirrors the CHECK constraint on billing_dispatch_rule.trigger_event +
  // the pgTAP engine_trigger audit (spec §11, ADR-0126). Registry-side
  // enforcement so a future contributor adding `"invoice.dispatched"`
  // (dot) gets a CI failure immediately, not in prod when engine_trigger
  // refuses to match.
  test.each(FASE_2_EVENTS_FOR_CONVENTION_AUDIT)("'%s' uses space-separator (no '.')", (event) => {
    expect(event).not.toContain(".");
  });

  // ─── Fase 2 destination matrix per spec §11 ─────
  // Spec-table-driven assertion: each new event's destinations MUST match
  // the §11 table exactly. This catches silent drift when someone adjusts
  // the routing map without updating the spec (or vice versa).
  const FASE_2_DESTINATIONS: Record<string, string[]> = {
    // Dispatch lifecycle (ADR-0126)
    "invoice dispatched": ["posthog", "logger", "billing_activity_log", "engine_event"],
    "invoice dispatch failed": ["posthog", "logger", "billing_activity_log", "engine_event"],
    "invoice dispatch retried": ["logger"],
    "invoice dispatch retry_requested": ["logger", "billing_activity_log"],
    // Integration sync (ADR-0129)
    "integration sync succeeded": ["posthog", "logger", "billing_activity_log", "engine_event"],
    "integration sync failed": ["posthog", "logger", "billing_activity_log", "engine_event"],
    "integration sync mocked": ["logger"],
    "integration test_connection succeeded": ["logger", "billing_activity_log"],
    "integration test_connection failed": ["logger", "billing_activity_log"],
    // Invoice editing
    "invoice line_item added": ["posthog", "logger", "billing_activity_log"],
    "invoice line_item edited": ["posthog", "logger", "billing_activity_log"],
    "invoice line_item removed": ["posthog", "logger", "billing_activity_log"],
    "invoice adhoc_created": ["posthog", "logger", "billing_activity_log"],
    // Settlement
    "workspace marked_paid": ["posthog", "logger", "billing_activity_log", "engine_event"],
    // Rule CRUD
    "dispatch_rule created": ["posthog", "logger", "billing_activity_log"],
    "dispatch_rule updated": ["posthog", "logger", "billing_activity_log"],
    "dispatch_rule deleted": ["posthog", "logger", "billing_activity_log"],
    // Integration CRUD
    "integration created": ["posthog", "logger", "billing_activity_log"],
    "integration updated": ["posthog", "logger", "billing_activity_log"],
    "integration deleted": ["posthog", "logger", "billing_activity_log"],
    // Debug-only
    "dispatch_rule evaluated": ["logger"],
  };

  test.each(Object.entries(FASE_2_DESTINATIONS))(
    "'%s' destinations match spec §11 table",
    (event, expected) => {
      const routing = EVENT_ROUTING[event as EventName];
      expect(routing).toBeDefined();
      expect([...routing.destinations].sort()).toEqual([...expected].sort());
    },
  );

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
