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

  it("remains valid without optional fields (backward compatibility)", () => {
    const input: CreateSeasonInput = { name: "Draft" };
    expect(input.name).toBe("Draft");
  });
});
