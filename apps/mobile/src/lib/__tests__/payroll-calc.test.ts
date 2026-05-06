/**
 * Tests for calculateShiftEarnings() — earnings calculation from shift work.
 *
 * Pure function, no DB or async dependencies. Calculates base pay, supplements,
 * and total earnings based on hourly rate, worked time, and supplement types.
 *
 * Two supplement types:
 * - fixed_per_hour: amount = hours × rate (e.g., evening premium)
 * - percentage: amount = hourlyRate × hours × (rate / 100) (e.g., 100% bonus)
 *
 * Tariff fixtures source: Riksavtalen 2025-mellomoppgjør (effective 2025-04-01)
 */

import { calculateShiftEarnings } from "../payroll-calc";
import type { EarningsInput, EarningsResult, SupplementEarning } from "../payroll-calc";

describe("calculateShiftEarnings", () => {
  describe("base pay calculation", () => {
    it("calculates base pay from hourly rate × hours", () => {
      const input: EarningsInput = {
        hourlyRate: 200,
        workedMinutes: 420, // 7 hours
        supplements: [],
      };

      const result = calculateShiftEarnings(input);

      expect(result.basePay).toBe(1400); // 200 × 7
      expect(result.total).toBe(1400);
    });

    it("handles partial hours correctly", () => {
      const input: EarningsInput = {
        hourlyRate: 200,
        workedMinutes: 90, // 1.5 hours
        supplements: [],
      };

      const result = calculateShiftEarnings(input);

      expect(result.basePay).toBe(300); // 200 × 1.5
      expect(result.total).toBe(300);
    });

    it("returns zero base pay for zero worked minutes", () => {
      const input: EarningsInput = {
        hourlyRate: 200,
        workedMinutes: 0,
        supplements: [],
      };

      const result = calculateShiftEarnings(input);

      expect(result.basePay).toBe(0);
      expect(result.supplementPay).toBe(0);
      expect(result.total).toBe(0);
    });

    it("calculates base pay with decimal hourly rates", () => {
      const input: EarningsInput = {
        hourlyRate: 199.5,
        workedMinutes: 480, // 8 hours
        supplements: [],
      };

      const result = calculateShiftEarnings(input);

      expect(result.basePay).toBe(1596); // 199.5 × 8
      expect(result.total).toBe(1596);
    });
  });

  describe("fixed_per_hour supplements", () => {
    it("adds fixed-per-hour supplement amounts", () => {
      const supplement: SupplementEarning = {
        type: "kveldstillegg",
        hours: 2,
        rate: 16.01,
        rateType: "fixed_per_hour",
      };

      const input: EarningsInput = {
        hourlyRate: 200,
        workedMinutes: 420, // 7 hours
        supplements: [supplement],
      };

      const result = calculateShiftEarnings(input);

      expect(result.basePay).toBe(1400);
      expect(result.supplementPay).toBe(32.02); // 16.01 × 2
      expect(result.total).toBe(1432.02);
      expect(result.supplementDetails).toContainEqual({
        type: "kveldstillegg",
        amount: 32.02,
      });
    });

    it("handles multiple fixed-per-hour supplements", () => {
      const supplements: SupplementEarning[] = [
        {
          type: "kveldstillegg",
          hours: 2,
          rate: 16.01,
          rateType: "fixed_per_hour",
        },
        {
          type: "helgetillegg",
          hours: 1,
          rate: 30.42,
          rateType: "fixed_per_hour",
        },
      ];

      const input: EarningsInput = {
        hourlyRate: 200,
        workedMinutes: 420,
        supplements,
      };

      const result = calculateShiftEarnings(input);

      expect(result.basePay).toBe(1400);
      expect(result.supplementPay).toBe(32.02 + 30.42); // 62.44
      expect(result.total).toBe(1462.44);
      expect(result.supplementDetails).toHaveLength(2);
    });

    it("handles zero hours on fixed-per-hour supplement", () => {
      const supplement: SupplementEarning = {
        type: "kveldstillegg",
        hours: 0,
        rate: 16.01,
        rateType: "fixed_per_hour",
      };

      const input: EarningsInput = {
        hourlyRate: 200,
        workedMinutes: 420,
        supplements: [supplement],
      };

      const result = calculateShiftEarnings(input);

      expect(result.basePay).toBe(1400);
      expect(result.supplementPay).toBe(0);
      expect(result.total).toBe(1400);
    });
  });

  describe("percentage supplements", () => {
    it("adds percentage supplement amounts", () => {
      const supplement: SupplementEarning = {
        type: "bonus",
        hours: 7,
        rate: 100, // 100% of hourly rate
        rateType: "percentage",
      };

      const input: EarningsInput = {
        hourlyRate: 200,
        workedMinutes: 420,
        supplements: [supplement],
      };

      const result = calculateShiftEarnings(input);

      expect(result.basePay).toBe(1400);
      expect(result.supplementPay).toBe(1400); // 200 × 7 × (100 / 100)
      expect(result.total).toBe(2800);
      expect(result.supplementDetails).toContainEqual({
        type: "bonus",
        amount: 1400,
      });
    });

    it("calculates percentage supplement with fractional rates", () => {
      const supplement: SupplementEarning = {
        type: "overtime_multiplier",
        hours: 2,
        rate: 50, // 50% increase
        rateType: "percentage",
      };

      const input: EarningsInput = {
        hourlyRate: 200,
        workedMinutes: 420,
        supplements: [supplement],
      };

      const result = calculateShiftEarnings(input);

      expect(result.basePay).toBe(1400);
      expect(result.supplementPay).toBe(200); // 200 × 2 × (50 / 100)
      expect(result.total).toBe(1600);
    });

    it("handles zero hours on percentage supplement", () => {
      const supplement: SupplementEarning = {
        type: "bonus",
        hours: 0,
        rate: 100,
        rateType: "percentage",
      };

      const input: EarningsInput = {
        hourlyRate: 200,
        workedMinutes: 420,
        supplements: [supplement],
      };

      const result = calculateShiftEarnings(input);

      expect(result.basePay).toBe(1400);
      expect(result.supplementPay).toBe(0);
      expect(result.total).toBe(1400);
    });
  });

  describe("combined supplements", () => {
    it("combines multiple supplements (mixed types)", () => {
      const supplements: SupplementEarning[] = [
        {
          type: "kveldstillegg",
          hours: 2,
          rate: 16.01,
          rateType: "fixed_per_hour",
        },
        {
          type: "helgetillegg",
          hours: 5,
          rate: 100, // 100% = double rate
          rateType: "percentage",
        },
      ];

      const input: EarningsInput = {
        hourlyRate: 200,
        workedMinutes: 420, // 7 hours total
        supplements,
      };

      const result = calculateShiftEarnings(input);

      expect(result.basePay).toBe(1400); // 200 × 7
      // kveldstillegg: 16.01 × 2 = 32.02
      // helgetillegg: 200 × 5 × (100 / 100) = 1000
      expect(result.supplementPay).toBeCloseTo(1032.02);
      expect(result.total).toBeCloseTo(2432.02);
      expect(result.supplementDetails).toHaveLength(2);
    });

    it("returns correct supplementDetails array format", () => {
      const supplements: SupplementEarning[] = [
        {
          type: "kveldstillegg",
          hours: 2,
          rate: 16.01,
          rateType: "fixed_per_hour",
        },
        {
          type: "helg",
          hours: 3,
          rate: 50,
          rateType: "percentage",
        },
      ];

      const input: EarningsInput = {
        hourlyRate: 200,
        workedMinutes: 420,
        supplements,
      };

      const result = calculateShiftEarnings(input);

      expect(result.supplementDetails).toEqual([
        { type: "kveldstillegg", amount: 32.02 },
        { type: "helg", amount: 300 }, // 200 × 3 × (50 / 100)
      ]);
    });
  });

  describe("numeric precision", () => {
    it("calculates with decimal precision for mixed fractional inputs", () => {
      const supplement: SupplementEarning = {
        type: "bonus",
        hours: 1,
        rate: 33.33,
        rateType: "fixed_per_hour",
      };

      const input: EarningsInput = {
        hourlyRate: 200.5,
        workedMinutes: 77, // 1.283... hours
        supplements: [supplement],
      };

      const result = calculateShiftEarnings(input);

      // Just verify calculations work with decimals (don't test string representation)
      expect(result.basePay).toBeGreaterThan(0);
      expect(result.supplementPay).toBeCloseTo(33.33, 2);
      expect(result.total).toBe(result.basePay + result.supplementPay);
    });

    it("handles very small amounts correctly", () => {
      const input: EarningsInput = {
        hourlyRate: 200,
        workedMinutes: 1, // 1 minute
        supplements: [],
      };

      const result = calculateShiftEarnings(input);

      expect(result.basePay).toBeCloseTo(3.333333, 5);
      expect(result.total).toBeCloseTo(3.333333, 5);
    });
  });

  describe("edge cases", () => {
    it("returns empty supplementDetails array when no supplements", () => {
      const input: EarningsInput = {
        hourlyRate: 200,
        workedMinutes: 420,
        supplements: [],
      };

      const result = calculateShiftEarnings(input);

      expect(result.supplementDetails).toEqual([]);
      expect(result.supplementPay).toBe(0);
    });

    it("handles single-supplement input", () => {
      const input: EarningsInput = {
        hourlyRate: 200,
        workedMinutes: 420,
        supplements: [
          {
            type: "bonus",
            hours: 1,
            rate: 50,
            rateType: "percentage",
          },
        ],
      };

      const result = calculateShiftEarnings(input);

      expect(result.supplementPay).toBe(100); // 200 × 1 × (50 / 100)
      expect(result.supplementDetails).toHaveLength(1);
    });

    it("type property from supplement is preserved in supplementDetails", () => {
      const supplements: SupplementEarning[] = [
        {
          type: "custom_supplement_name_123",
          hours: 1,
          rate: 10,
          rateType: "fixed_per_hour",
        },
      ];

      const input: EarningsInput = {
        hourlyRate: 200,
        workedMinutes: 60,
        supplements,
      };

      const result = calculateShiftEarnings(input);

      expect(result.supplementDetails[0]?.type).toBe("custom_supplement_name_123");
    });
  });
});
