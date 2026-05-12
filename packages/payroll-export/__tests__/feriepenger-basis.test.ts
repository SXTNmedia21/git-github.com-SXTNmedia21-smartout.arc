/**
 * __tests__/feriepenger-basis.test.ts
 *
 * Unit tests for computeFeriepengerBasis — SMA-346 / ADR-0295.
 */
import { describe, it, expect } from "vitest";
import { computeFeriepengerBasis } from "../src/feriepenger";

describe("computeFeriepengerBasis — SMA-346", () => {
  it("computes 12% basis on standard rate", () => {
    expect(computeFeriepengerBasis({ basePayTotal: 16681.3, holidayAllowancePct: 12 })).toBeCloseTo(
      2001.76,
      2,
    );
  });

  it("uses 14.3% for over-60 employees", () => {
    expect(computeFeriepengerBasis({ basePayTotal: 50000, holidayAllowancePct: 14.3 })).toBeCloseTo(
      7150,
      2,
    );
  });

  it("returns 0 for zero base pay", () => {
    expect(computeFeriepengerBasis({ basePayTotal: 0, holidayAllowancePct: 12 })).toBe(0);
  });

  it("rounds to 2 decimals (NOK kroner)", () => {
    expect(computeFeriepengerBasis({ basePayTotal: 12345.678, holidayAllowancePct: 12 })).toBe(
      1481.48,
    );
  });
});
