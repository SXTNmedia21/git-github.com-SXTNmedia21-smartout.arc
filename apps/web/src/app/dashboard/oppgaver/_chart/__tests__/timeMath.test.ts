import { describe, it, expect } from "vitest";
import { hmToMin, minToHM, DAY_MINUTES, DAY_START_HOUR } from "../timeMath";

describe("timeMath", () => {
  it("DAY_MINUTES = 20*60 (06:00→02:00)", () => {
    expect(DAY_MINUTES).toBe(1200);
  });
  it("DAY_START_HOUR = 6", () => {
    expect(DAY_START_HOUR).toBe(6);
  });
  it("hmToMin handles 06:00", () => {
    expect(hmToMin("06:00")).toBe(360);
  });
  it("hmToMin handles 02:00 (next-day-ish — caller wraps)", () => {
    expect(hmToMin("02:00")).toBe(120);
  });
  it("minToHM round-trip", () => {
    expect(minToHM(hmToMin("14:35"))).toBe("14:35");
  });
});
