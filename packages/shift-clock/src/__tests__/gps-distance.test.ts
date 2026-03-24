import { describe, it, expect } from "vitest";
import { calculateGPSDistance } from "../utils/gps-distance";

describe("calculateGPSDistance", () => {
  it("returns 0 for identical points", () => {
    expect(calculateGPSDistance(59.9139, 10.7522, 59.9139, 10.7522)).toBe(0);
  });

  it("calculates distance between two known Oslo points (~1km)", () => {
    const distance = calculateGPSDistance(59.9109, 10.753, 59.9113, 10.7306);
    expect(distance).toBeGreaterThan(1000);
    expect(distance).toBeLessThan(1300);
  });

  it("returns distance in meters", () => {
    const distance = calculateGPSDistance(59.9139, 10.7522, 59.9148, 10.7522);
    expect(distance).toBeGreaterThan(80);
    expect(distance).toBeLessThan(120);
  });
});
