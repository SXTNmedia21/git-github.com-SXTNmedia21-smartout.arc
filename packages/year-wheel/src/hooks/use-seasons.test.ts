import { describe, it, expect } from "vitest";

import type { CreateSeasonInput } from "./use-seasons";

describe("CreateSeasonInput", () => {
  it("accepts optional color and planningCycleId", () => {
    const input: CreateSeasonInput = {
      name: "Sommer 2026",
      startDate: "2026-06-01",
      endDate: "2026-08-31",
      color: "#f97316",
      planningCycleId: "cycle-uuid",
    };
    expect(input.name).toBe("Sommer 2026");
    expect(input.color).toBe("#f97316");
    expect(input.planningCycleId).toBe("cycle-uuid");
  });

  it("requires startDate + endDate (tightened in Phase 7)", () => {
    // After the year-wheel redesign Phase 7 cleanup, startDate and endDate
    // became required. The quick-create sheet always supplies both (pre-filled
    // from the canvas draw). `duplicateYear` uses a direct INSERT and doesn't
    // constrain this shape. See docs/superpowers/plans/2026-04-20-year-wheel-redesign.md §7.1.
    const input: CreateSeasonInput = {
      name: "Draft",
      startDate: "2026-01-01",
      endDate: "2026-12-31",
    };
    expect(input.startDate).toBe("2026-01-01");
    expect(input.endDate).toBe("2026-12-31");
  });
});
