import { describe, test, expect } from "vitest";
import { EVENT_ROUTING, type EntityType, type SmartoutEvent } from "../registry";

// Fase 3B B1.3 (2026-04-17): asserts the 9 new events from spec §9 are
// registered with the correct destinations. Mirrors the Fase 3A test
// structure so future batches fail-loud if an event goes missing.
//
// ADR-0136: Vault token storage drives no events directly — OAuth
//           lifecycle events below subsume Vault read/write audit.
// ADR-0137: EHF transport via Tickstar — 'ehf submission_*' events.
// ADR-0138: integration_poll_payments as separate process —
//           'integration poll_*' events.

type EventName = SmartoutEvent["event"];

describe("billing fase 3b event registry", () => {
  test.each<EventName>([
    "integration oauth_initiated",
    "integration oauth_connected",
    "integration oauth_failed",
    "integration poll_started",
    "integration poll_found_payment",
    "integration poll_no_match",
    "ehf submission_sent",
    "ehf submission_failed",
    "ehf validation_error",
  ])("'%s' is registered in EVENT_ROUTING", (event) => {
    expect(EVENT_ROUTING[event]).toBeDefined();
    expect(EVENT_ROUTING[event].destinations.length).toBeGreaterThan(0);
    expect(EVENT_ROUTING[event].category).toBe("billing");
  });

  test("'integration oauth_connected' routes to engine_event (workflow hook)", () => {
    // Downstream workflows (first-sync kickoff, notification) pick up
    // the billing_integration row via engine_event fan-out.
    expect(EVENT_ROUTING["integration oauth_connected"].destinations).toContain("engine_event");
  });

  test("'integration oauth_failed' routes to posthog (alerting on OAuth outage)", () => {
    expect(EVENT_ROUTING["integration oauth_failed"].destinations).toContain("posthog");
  });

  test("'integration poll_started' is logger-only (ADR-0138 high-volume)", () => {
    // One row per integration per cron cycle is noise — PostHog would
    // drown, and the reconcile audit lives in billing_activity_log via
    // the matched-payment events instead.
    expect(EVENT_ROUTING["integration poll_started"].destinations).toEqual(["logger"]);
  });

  test("'integration poll_no_match' is logger-only (ADR-0138 high-volume)", () => {
    // Unmatched vendor payments are normal background; platform-admin
    // surfaces them via queries, not via alerting channels.
    expect(EVENT_ROUTING["integration poll_no_match"].destinations).toEqual(["logger"]);
  });

  test("'integration poll_found_payment' routes to engine_event (settlement parity)", () => {
    // Matched payments drive Fase 3A reconcileInvoiceOnPayment via the
    // engine_event → state_machine path. Keeping the destination set in
    // lock-step with 'payment succeeded' preserves settlement audit.
    expect(EVENT_ROUTING["integration poll_found_payment"].destinations).toContain("engine_event");
  });

  test("'ehf submission_sent' routes to engine_event (delivery lifecycle)", () => {
    // Peppol is async — `submission_sent` only confirms Tickstar
    // accepted the handoff. Downstream webhooks (future) advance the
    // invoice_dispatch state.
    expect(EVENT_ROUTING["ehf submission_sent"].destinations).toContain("engine_event");
  });

  test("'ehf submission_failed' routes to posthog (outage alerting)", () => {
    expect(EVENT_ROUTING["ehf submission_failed"].destinations).toContain("posthog");
  });

  test("'ehf validation_error' does NOT route to posthog (per-rule cardinality)", () => {
    // Schematron surfaces per-rule detail that operators need to
    // diagnose failures, but PostHog cardinality would be too high if
    // every rule hit ended up there. Alerting comes via the parent
    // 'ehf submission_failed' event.
    expect(EVENT_ROUTING["ehf validation_error"].destinations).not.toContain("posthog");
    expect(EVENT_ROUTING["ehf validation_error"].destinations).toContain("billing_activity_log");
  });

  test("billing_integration_oauth_state entity_type is registered", () => {
    // Type-level assertion — must be assignable to EntityType.
    const types: EntityType[] = ["billing_integration_oauth_state"];
    expect(types).toHaveLength(1);
  });
});
