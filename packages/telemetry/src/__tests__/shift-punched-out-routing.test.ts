// Trigger-wiring regression guard (PLAN-secure-shift-lifecycle.md WS-A2).
//
// shift_lifecycle_v1 is an engine_process whose only auto-start path is
// a `shift.punched_out` row on engine_event. That row only appears if
// EVENT_ROUTING includes `engine_event` for the `shift punched_out`
// telemetry event. This test locks the routing contract so a future
// registry edit cannot silently drop the destination and break the
// entire Phase 1-5 backend chain.

import { describe, test, expect } from "vitest";
import { EVENT_ROUTING } from "../registry";

describe("shift punched_out telemetry routing (WS-A2)", () => {
  const routing = EVENT_ROUTING["shift punched_out"];

  test("event is registered", () => {
    expect(routing).toBeDefined();
  });

  test("routes to engine_event so shift_lifecycle_v1 can auto-start", () => {
    expect(routing.destinations).toContain("engine_event");
  });

  test("also routes to posthog/logger/activity_trail (full visibility)", () => {
    expect(routing.destinations).toContain("posthog");
    expect(routing.destinations).toContain("logger");
    expect(routing.destinations).toContain("activity_trail");
  });

  test("shift punched_in also routes to engine_event (symmetric)", () => {
    expect(EVENT_ROUTING["shift punched_in"].destinations).toContain("engine_event");
  });
});
