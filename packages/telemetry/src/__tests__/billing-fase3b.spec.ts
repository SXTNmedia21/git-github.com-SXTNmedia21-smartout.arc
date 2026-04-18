import { describe, test, expect } from "vitest";
import { EVENT_ROUTING, type SmartoutEvent } from "../registry";

// Fase 3B (CSV/PDF-eksport-scope, rewritten 2026-04-18):
// Tester at de to nye eksport-eventsene er registrert og har riktige
// destinasjoner. Ingen PostHog fordi månedlig platform-admin-click er
// lav-volum; billing_activity_log er audit-hjem per ADR-0125.

type EventName = SmartoutEvent["event"];

describe("billing fase 3b event registry", () => {
  test.each<EventName>(["billing ehf_export_generated", "billing accountant_marked_paid"])(
    "'%s' is registered in EVENT_ROUTING",
    (event) => {
      expect(EVENT_ROUTING[event]).toBeDefined();
      expect(EVENT_ROUTING[event].destinations.length).toBeGreaterThan(0);
      expect(EVENT_ROUTING[event].category).toBe("billing");
    },
  );

  test("'billing ehf_export_generated' does NOT route to posthog (low-volume, platform-admin click)", () => {
    expect(EVENT_ROUTING["billing ehf_export_generated"].destinations).not.toContain("posthog");
    expect(EVENT_ROUTING["billing ehf_export_generated"].destinations).toContain(
      "billing_activity_log",
    );
  });

  test("'billing accountant_marked_paid' routes to engine_event (settlement lifecycle)", () => {
    // Regnskapsfører-mark-paid driver samme reconcile-paths som
    // payment-succeeded (Fase 3A reconcileInvoiceOnPayment). engine_event
    // sikrer at ettermark-paid-workflows (faktura-lukking, dunning-stopp)
    // kjører uansett hvilken vei betalingen kom inn.
    expect(EVENT_ROUTING["billing accountant_marked_paid"].destinations).toContain("engine_event");
    expect(EVENT_ROUTING["billing accountant_marked_paid"].destinations).toContain(
      "billing_activity_log",
    );
  });
});
