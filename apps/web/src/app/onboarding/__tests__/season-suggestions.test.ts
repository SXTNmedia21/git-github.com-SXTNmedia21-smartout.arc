import { describe, it, expect } from "vitest";
import { suggestSeason } from "../lib/season-suggestions";

describe("suggestSeason", () => {
  it("suggests Vår for March", () => {
    const result = suggestSeason(new Date("2026-03-15"));
    expect(result.name).toBe("Vår 2026");
    expect(result.startDate).toBe("2026-03-01");
    expect(result.endDate).toBe("2026-05-31");
  });

  it("suggests Sommer for July", () => {
    const result = suggestSeason(new Date("2026-07-01"));
    expect(result.name).toBe("Sommer 2026");
    expect(result.startDate).toBe("2026-06-01");
    expect(result.endDate).toBe("2026-08-31");
  });

  it("suggests Høst for October", () => {
    const result = suggestSeason(new Date("2026-10-15"));
    expect(result.name).toBe("Høst 2026");
  });

  it("suggests Vinter for January", () => {
    const result = suggestSeason(new Date("2026-01-10"));
    expect(result.name).toBe("Vinter 2026");
    expect(result.startDate).toBe("2026-01-01");
    expect(result.endDate).toBe("2026-02-28");
  });

  it("handles leap year February", () => {
    const result = suggestSeason(new Date("2028-01-10"));
    expect(result.endDate).toBe("2028-02-29");
  });
});
