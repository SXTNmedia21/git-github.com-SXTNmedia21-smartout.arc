import { describe, it, expect } from "vitest";
import { calculate, type Policy } from "./calculate.js";

describe("calculate", () => {
  it("returns empty array when no shifts", () => {
    expect(calculate(1000, [], { method: "equal" })).toEqual([]);
  });

  it("equal split — 4 employees, 1000 kr each gets 250", () => {
    const result = calculate(
      1000,
      [
        { profile_id: "a", role: "x", hours_worked: 4 },
        { profile_id: "b", role: "x", hours_worked: 4 },
        { profile_id: "c", role: "x", hours_worked: 4 },
        { profile_id: "d", role: "x", hours_worked: 4 },
      ],
      { method: "equal" },
    );
    expect(result.length).toBe(4);
    expect(result.every((r) => r.calculated_amount === 250)).toBe(true);
  });

  it("by_hours — proportional to hours", () => {
    const result = calculate(
      1000,
      [
        { profile_id: "a", role: "x", hours_worked: 8 },
        { profile_id: "b", role: "x", hours_worked: 2 },
      ],
      { method: "by_hours" },
    );
    expect(result.find((r) => r.profile_id === "a")?.calculated_amount).toBe(800);
    expect(result.find((r) => r.profile_id === "b")?.calculated_amount).toBe(200);
  });

  it("by_role — applies role weights", () => {
    const result = calculate(
      1000,
      [
        { profile_id: "s1", role: "servitør", hours_worked: 5 },
        { profile_id: "k1", role: "kjøkken", hours_worked: 5 },
      ],
      { method: "by_role", weights: { servitør: 1.0, kjøkken: 0.5 } },
    );
    // points: s1 = 5*1.0 = 5; k1 = 5*0.5 = 2.5; total = 7.5
    // s1 amount = 1000 * 5 / 7.5 = 666.6666... → 666.67
    // k1 amount = 1000 * 2.5 / 7.5 = 333.3333... → 333.33
    // remainder 0.00 (already sums to 1000.00 after rounding)
    const s1 = result.find((r) => r.profile_id === "s1")!;
    const k1 = result.find((r) => r.profile_id === "k1")!;
    expect(s1.calculated_amount + k1.calculated_amount).toBeCloseTo(1000, 2);
    expect(s1.calculated_amount).toBeGreaterThan(k1.calculated_amount);
  });

  it("by_role — unknown role defaults weight 1.0", () => {
    const result = calculate(1000, [{ profile_id: "x", role: "unknown_role", hours_worked: 5 }], {
      method: "by_role",
      weights: { servitør: 1.0 },
    });
    expect(result[0]!.calculated_amount).toBe(1000);
    expect(result[0]!.weight_applied).toBe(1.0);
  });

  it("zero total points returns empty", () => {
    const result = calculate(1000, [{ profile_id: "a", role: "x", hours_worked: 0 }], {
      method: "by_hours",
    });
    expect(result).toEqual([]);
  });

  it("rounding — sum equals input always (single ø-employee remainder)", () => {
    const result = calculate(
      100,
      [
        { profile_id: "a", role: "x", hours_worked: 1 },
        { profile_id: "b", role: "x", hours_worked: 1 },
        { profile_id: "c", role: "x", hours_worked: 1 },
      ],
      { method: "by_hours" },
    );
    const sum = result.reduce((s, r) => s + r.calculated_amount, 0);
    expect(sum).toBeCloseTo(100, 2);
  });

  it("rounding — single employee gets exact amount", () => {
    const result = calculate(123.45, [{ profile_id: "a", role: "x", hours_worked: 5 }], {
      method: "equal",
    });
    expect(result[0]!.calculated_amount).toBe(123.45);
  });

  it("algorithm_snapshot is captured", () => {
    const result = calculate(100, [{ profile_id: "a", role: "x", hours_worked: 5 }], {
      method: "by_hours",
    });
    expect(result[0]!.algorithm_snapshot).toBeDefined();
    expect(result[0]!.algorithm_snapshot.method).toBe("by_hours");
  });
});
