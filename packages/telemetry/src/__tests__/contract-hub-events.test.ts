// Contract Hub Redesign — telemetry routing contract
// Council 2026-04-22 Gate G2.
//
// All 10 events must be registered in EVENT_ROUTING and route to all 4
// destinations (activity_trail, engine_event, posthog, logger). If any
// destination is silently dropped, Event Engine consumers for drift chips,
// deprecations, and forks will stop firing without warning — lock the
// routing contract here so the regression surfaces at CI time.

import { describe, test, expect } from "vitest";
import { EVENT_ROUTING, type SmartoutEvent } from "../registry";

type EventName = SmartoutEvent["event"];

const REQUIRED_DESTINATIONS = ["activity_trail", "engine_event", "posthog", "logger"] as const;

const CONTRACT_HUB_EVENTS: EventName[] = [
  // 5 template lifecycle
  "contract_template forked",
  "contract_template clause_updated",
  "contract_template published",
  "contract_template deprecated",
  "contract_template deleted",
  // 3 hub UI
  "contract.hub_viewed",
  "contract.tab_switched",
  "contract.botsson_chip_invoked",
  // 2 drift
  "contract_template.drift_viewed",
  "contract_template.drift_dismissed",
];

describe("contract hub events — Gate G2 routing contract", () => {
  test.each(CONTRACT_HUB_EVENTS)(
    "%s is registered and routes to all 4 destinations",
    (eventName) => {
      const routing = EVENT_ROUTING[eventName];
      expect(routing, `missing registry entry for ${eventName}`).toBeDefined();
      for (const destination of REQUIRED_DESTINATIONS) {
        expect(routing.destinations, `${eventName} missing destination "${destination}"`).toContain(
          destination,
        );
      }
    },
  );

  test.each(CONTRACT_HUB_EVENTS)("%s is categorized as 'contracts'", (eventName) => {
    expect(EVENT_ROUTING[eventName].category).toBe("contracts");
  });

  test("all 10 contract hub events are present (count guard)", () => {
    expect(CONTRACT_HUB_EVENTS).toHaveLength(10);
  });
});
