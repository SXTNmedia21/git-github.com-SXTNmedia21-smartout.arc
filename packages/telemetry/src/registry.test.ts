import { describe, it, expect, expectTypeOf } from "vitest";

import { EVENT_ROUTING } from "./registry";
import type {
  SeasonCreated,
  SeasonDrawStarted,
  SeasonDrawCompleted,
  SeasonDrawCancelled,
  SeasonSidebarFilterChanged,
  SeasonYearWheelViewed,
  SeasonTabChanged,
} from "./registry";

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

describe("year-wheel canvas events are registered", () => {
  it.each([
    "season draw_started",
    "season draw_completed",
    "season draw_cancelled",
    "season sidebar_filter_changed",
    "season year_wheel_viewed",
    "season tab_changed",
  ] as const)("%s is in EVENT_ROUTING", (name) => {
    expect(EVENT_ROUTING[name]).toBeDefined();
    expect(EVENT_ROUTING[name].destinations.length).toBeGreaterThan(0);
  });

  it("season draw_completed is categorized as operations", () => {
    expect(EVENT_ROUTING["season draw_completed"].category).toBe("operations");
  });

  it("view/click events are categorized as navigation", () => {
    for (const name of [
      "season draw_started",
      "season draw_cancelled",
      "season sidebar_filter_changed",
      "season year_wheel_viewed",
      "season tab_changed",
    ] as const) {
      expect(EVENT_ROUTING[name].category).toBe("navigation");
    }
  });

  it("no new event routes to activity_trail", () => {
    for (const name of [
      "season draw_started",
      "season draw_completed",
      "season draw_cancelled",
      "season sidebar_filter_changed",
      "season year_wheel_viewed",
      "season tab_changed",
    ] as const) {
      expect(EVENT_ROUTING[name].destinations).not.toContain("activity_trail");
    }
  });

  it("interfaces expose the documented payload shapes", () => {
    expectTypeOf<SeasonDrawStarted["properties"]["data"]>().toEqualTypeOf<{
      year: number;
      lane: number;
    }>();
    expectTypeOf<SeasonDrawCompleted["properties"]["data"]>().toEqualTypeOf<{
      start: string;
      end: string;
      lane: number;
    }>();
    expectTypeOf<SeasonDrawCancelled["properties"]["data"]["reason"]>().toEqualTypeOf<
      "short_drag" | "esc" | "mouse_exit" | "sheet_abandoned"
    >();
    expectTypeOf<SeasonSidebarFilterChanged["properties"]["data"]["filter"]>().toEqualTypeOf<
      "all" | "active" | "draft" | "archived"
    >();
    expectTypeOf<SeasonYearWheelViewed["properties"]["data"]>().toEqualTypeOf<{
      year: number;
      seasons_count: number;
    }>();
    expectTypeOf<SeasonTabChanged["properties"]["data"]>().toEqualTypeOf<{
      from: string;
      to: string;
    }>();
  });
});
