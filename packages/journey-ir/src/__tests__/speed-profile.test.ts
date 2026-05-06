import { describe, it, expect } from "vitest";
import { SPEED_PROFILES, resolveSpeedMultiplier } from "../speed-profile";

describe("speed profile", () => {
  it("full profile = 1x multiplier", () => {
    expect(resolveSpeedMultiplier("full")).toEqual({
      settle: 1,
      retry: 1,
      timeout: 1,
    });
  });

  it("normal profile slows settle 3x", () => {
    expect(resolveSpeedMultiplier("normal").settle).toBe(3);
  });

  it("ai_companion profile slows settle 8x", () => {
    expect(resolveSpeedMultiplier("ai_companion").settle).toBe(8);
  });

  it("SPEED_PROFILES exposes 3 named profiles", () => {
    expect(Object.keys(SPEED_PROFILES)).toEqual(["full", "normal", "ai_companion"]);
  });

  it("undefined profile falls back to full", () => {
    expect(resolveSpeedMultiplier(undefined)).toEqual(resolveSpeedMultiplier("full"));
  });
});
