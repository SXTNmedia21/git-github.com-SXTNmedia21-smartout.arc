import { describe, test, expect } from "vitest";
import { EVENT_ROUTING, type SmartoutEvent } from "../registry";

type EventName = SmartoutEvent["event"];

describe("Error events", () => {
  const errorEvents: EventName[] = [
    "scrape failed",
    "scrape partial",
    "brreg lookup_failed",
    "ai generation_failed",
    "auth signup_failed",
    "workspace provision_failed",
    "workspace finalize_failed",
    "industry_package load_failed",
  ];

  test.each(errorEvents)("'%s' is registered in EVENT_ROUTING", (event) => {
    expect(EVENT_ROUTING[event]).toBeDefined();
    expect(EVENT_ROUTING[event].destinations).toContain("posthog");
    expect(EVENT_ROUTING[event].destinations).toContain("logger");
  });

  test("pre-workspace errors do NOT route to activity_trail", () => {
    const preWorkspace: EventName[] = [
      "scrape failed",
      "scrape partial",
      "brreg lookup_failed",
      "ai generation_failed",
      "auth signup_failed",
    ];
    for (const event of preWorkspace) {
      expect(EVENT_ROUTING[event].destinations).not.toContain("activity_trail");
    }
  });

  test("post-workspace errors route to activity_trail", () => {
    const postWorkspace: EventName[] = [
      "workspace provision_failed",
      "workspace finalize_failed",
      "industry_package load_failed",
    ];
    for (const event of postWorkspace) {
      expect(EVENT_ROUTING[event].destinations).toContain("activity_trail");
    }
  });

  test("no error event routes to engine_event", () => {
    for (const event of errorEvents) {
      expect(EVENT_ROUTING[event].destinations).not.toContain("engine_event");
    }
  });
});

describe("Botsson response events", () => {
  const botssonEvents: EventName[] = [
    "botsson nudge_shown",
    "botsson nudge_accepted",
    "botsson nudge_dismissed",
    "botsson autofill_applied",
    "escalation triggered",
  ];

  test.each(botssonEvents)("'%s' is registered with category 'agent'", (event) => {
    expect(EVENT_ROUTING[event]).toBeDefined();
    expect(EVENT_ROUTING[event].category).toBe("agent");
  });

  test("no botsson event routes to engine_event (circuit breaker)", () => {
    for (const event of botssonEvents) {
      expect(EVENT_ROUTING[event].destinations).not.toContain("engine_event");
    }
  });
});
