import { describe, test, expect } from "vitest";
import { EVENT_ROUTING, type EntityType, type SmartoutEvent } from "../registry";

// Fase 3A B1 (2026-04-17): verifies the 7 new events from spec §11 are
// registered with the correct destinations. If this test breaks because
// an event is missing, restore it — the Stripe webhook + dunning engine
// handler rely on the registry as the single source of truth.

type EventName = SmartoutEvent["event"];

describe("billing fase 3a event registry", () => {
  test.each<EventName>([
    "payment initiated",
    "payment succeeded",
    "payment failed",
    "payment refunded",
    "invoice dunning_escalated",
    "invoice credit_note_auto_created",
    "platform_admin_pii_read",
  ])("'%s' is registered in EVENT_ROUTING", (event) => {
    expect(EVENT_ROUTING[event]).toBeDefined();
    expect(EVENT_ROUTING[event].destinations.length).toBeGreaterThan(0);
    expect(EVENT_ROUTING[event].category).toBe("billing");
  });

  test("'payment succeeded' routes to engine_event (dunning suppression hook)", () => {
    expect(EVENT_ROUTING["payment succeeded"].destinations).toContain("engine_event");
  });

  test("'payment failed' routes to posthog (alerting per spec §11)", () => {
    expect(EVENT_ROUTING["payment failed"].destinations).toContain("posthog");
  });

  test("'platform_admin_pii_read' does NOT route to posthog (ADR-0141: audit-only)", () => {
    // PII reads are normal support traffic; flooding PostHog would drown
    // signal from genuinely anomalous events. billing_activity_log IS the
    // alert surface for this event.
    expect(EVENT_ROUTING["platform_admin_pii_read"].destinations).not.toContain("posthog");
    expect(EVENT_ROUTING["platform_admin_pii_read"].destinations).toContain("billing_activity_log");
  });

  test("'invoice dunning_escalated' routes to engine_event (workflow hook)", () => {
    expect(EVENT_ROUTING["invoice dunning_escalated"].destinations).toContain("engine_event");
  });

  test("'invoice credit_note_auto_created' routes to engine_event (ADR-0142 settlement audit)", () => {
    expect(EVENT_ROUTING["invoice credit_note_auto_created"].destinations).toContain(
      "engine_event",
    );
  });

  test("payment entity_types are registered", () => {
    // Type-level assertion: these must be assignable to EntityType.
    const types: EntityType[] = ["payment", "payment_attempt", "dunning_escalation_log"];
    expect(types).toHaveLength(3);
  });
});
