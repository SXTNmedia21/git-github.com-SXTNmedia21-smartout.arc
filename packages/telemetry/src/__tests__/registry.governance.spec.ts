import { describe, test, expect } from "vitest";
import { EVENT_ROUTING, type ActionVerb, type EntityType, type SmartoutEvent } from "../registry";

type EventName = SmartoutEvent["event"];

describe("governance/training event registry (Phase 0)", () => {
  test("includes observer_request, inspection_link, notification_policy entity types", () => {
    // Type-level assertion: these strings must be assignable to EntityType.
    const types: EntityType[] = ["observer_request", "inspection_link", "notification_policy"];
    expect(types).toHaveLength(3);
  });

  test("includes new action verbs (resolved, issued, converted, claimed)", () => {
    const verbs: ActionVerb[] = ["resolved", "issued", "converted", "claimed"];
    expect(verbs).toHaveLength(4);
  });

  test.each<EventName>([
    "policy published",
    "observer_request created",
    "observer_request claimed",
    "observer_request resolved",
    "approval requested",
    "approval resolved",
    "reminder sent",
    "reminder opened",
    "reminder converted",
  ])("'%s' is registered in EVENT_ROUTING", (event) => {
    expect(EVENT_ROUTING[event]).toBeDefined();
    expect(EVENT_ROUTING[event].destinations.length).toBeGreaterThan(0);
  });
});
