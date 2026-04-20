import { describe, it, expectTypeOf } from "vitest";

import type { SeasonCreated } from "./registry";

describe("SeasonCreated event interface", () => {
  it("accepts color and planning_cycle_id in properties.data", () => {
    const event: SeasonCreated = {
      event: "season created",
      workspace_id: "ws-uuid",
      actor_id: "profile-uuid",
      properties: {
        entity: {
          entity_type: "season",
          entity_id: "season-uuid",
          entity_label: "Sommer",
        },
        data: {
          name: "Sommer",
          status: "draft",
          color: "#f97316",
          planning_cycle_id: "cycle-uuid",
        },
      },
    };
    expectTypeOf(event.properties.data.color).toEqualTypeOf<string | null | undefined>();
    expectTypeOf(event.properties.data.planning_cycle_id).toEqualTypeOf<
      string | null | undefined
    >();
  });
});
