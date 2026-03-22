/**
 * Tests for calculateSupplements() — Norwegian wage supplement stacking engine.
 *
 * Covers the four canonical stacking rules from the spec:
 * 1. Kveld + Helg → additive (both apply)
 * 2. Kveld + Helligdag → additive (both apply)
 * 3. Helg + Helligdag → helligdag wins (highest rate replaces weekend rate)
 * 4. Kveld + Helg + Helligdag → kveld + helligdag (helligdag replaces helg, kveld stacks)
 *
 * Cross-midnight shifts split at 00:00. Each segment is evaluated independently
 * for day-of-week and holiday status.
 *
 * Break time is subtracted proportionally from qualifying hours — only paid time qualifies.
 *
 * Verified test dates (UTC day-of-week):
 *   2026-03-23 = Monday     (plain weekday)
 *   2026-03-27 = Friday     (weekday, no holiday)
 *   2026-03-28 = Saturday   (weekend)
 *   2026-05-01 = Friday     (Labour Day — Friday holiday)
 *   2026-05-17 = Sunday     (National Day — Sunday holiday → helligdag wins over helg)
 *   2026-12-25 = Friday     (Christmas Day — Friday holiday)
 */

import {
  calculateSupplements,
  getDayOfWeek,
  isWeekend,
  timeToMinutes,
  getOverlapMinutes,
  splitCrossMidnight,
} from "../supplements";
import type { SupplementRule, SupplementInput } from "../supplements";

// ---------------------------------------------------------------------------
// Shared test fixtures
// ---------------------------------------------------------------------------

/** A standard kveld (evening) rule: 18:00–00:00, all weekdays, fixed rate */
const kveldsRule: SupplementRule = {
  id: "kveld-1",
  name: "Kveldsavgift",
  supplementType: "evening",
  startTime: "18:00:00",
  endTime: "00:00:00",
  rate: 50,
  rateType: "fixed_per_hour",
  isActive: true,
  appliesToWeekdays: [0, 1, 2, 3, 4, 5, 6],
  appliesToWeekends: true,
};

/** Weekend (helg) rule: applies all day on Sat/Sun */
const helgRule: SupplementRule = {
  id: "helg-1",
  name: "Helgetillegg",
  supplementType: "weekend",
  startTime: "00:00:00",
  endTime: "00:00:00", // midnight-to-midnight = full day
  rate: 30,
  rateType: "fixed_per_hour",
  isActive: true,
  appliesToWeekdays: [0, 6], // Sun=0, Sat=6
  appliesToWeekends: true,
};

/** Holiday (helligdag) rule: applies all day on public holidays */
const helligdagRule: SupplementRule = {
  id: "helligdag-1",
  name: "Helligdagstillegg",
  supplementType: "holiday",
  startTime: "00:00:00",
  endTime: "00:00:00",
  rate: 100,
  rateType: "fixed_per_hour",
  isActive: true,
  appliesToWeekdays: [0, 1, 2, 3, 4, 5, 6],
  appliesToWeekends: true,
};

const allRules = [kveldsRule, helgRule, helligdagRule];

// ---------------------------------------------------------------------------
// Helper functions
// ---------------------------------------------------------------------------

describe("getDayOfWeek", () => {
  it("returns 1 for Monday 2026-03-23", () => {
    expect(getDayOfWeek("2026-03-23")).toBe(1);
  });

  it("returns 5 for Friday 2026-03-27", () => {
    expect(getDayOfWeek("2026-03-27")).toBe(5);
  });

  it("returns 6 for Saturday 2026-03-28", () => {
    expect(getDayOfWeek("2026-03-28")).toBe(6);
  });

  it("returns 0 for Sunday 2026-05-17", () => {
    expect(getDayOfWeek("2026-05-17")).toBe(0);
  });

  it("returns 5 for Friday 2026-12-25", () => {
    expect(getDayOfWeek("2026-12-25")).toBe(5);
  });
});

describe("isWeekend", () => {
  it("returns false for Monday (1)", () => expect(isWeekend(1)).toBe(false));
  it("returns false for Friday (5)", () => expect(isWeekend(5)).toBe(false));
  it("returns true for Saturday (6)", () => expect(isWeekend(6)).toBe(true));
  it("returns true for Sunday (0)", () => expect(isWeekend(0)).toBe(true));
});

describe("timeToMinutes", () => {
  it("converts 00:00:00 to 0", () => expect(timeToMinutes("00:00:00")).toBe(0));
  it("converts 08:30:00 to 510", () => expect(timeToMinutes("08:30:00")).toBe(510));
  it("converts 18:00:00 to 1080", () => expect(timeToMinutes("18:00:00")).toBe(1080));
  it("converts 23:59:00 to 1439", () => expect(timeToMinutes("23:59:00")).toBe(1439));
});

describe("getOverlapMinutes", () => {
  it("returns 0 when ranges do not overlap", () => {
    expect(getOverlapMinutes(0, 60, 120, 180)).toBe(0);
  });

  it("returns 60 for identical 1h ranges", () => {
    expect(getOverlapMinutes(60, 120, 60, 120)).toBe(60);
  });

  it("returns partial overlap when one range starts inside another", () => {
    // Shift 17:00–21:00 (1020–1260), Rule 18:00–22:00 (1080–1320) → overlap 18:00–21:00 = 180 min
    expect(getOverlapMinutes(1020, 1260, 1080, 1320)).toBe(180);
  });

  it("returns 0 when end equals start of other range (adjacent, no overlap)", () => {
    expect(getOverlapMinutes(0, 60, 60, 120)).toBe(0);
  });
});

describe("splitCrossMidnight", () => {
  it("returns single segment for same-day shift", () => {
    const segments = splitCrossMidnight("2026-03-23", "10:00:00", "18:00:00");
    expect(segments).toHaveLength(1);
    expect(segments[0]).toEqual({ date: "2026-03-23", start: "10:00:00", end: "18:00:00" });
  });

  it("splits Friday-to-Saturday cross-midnight shift into two segments", () => {
    const segments = splitCrossMidnight("2026-03-27", "22:00:00", "06:00:00");
    expect(segments).toHaveLength(2);
    expect(segments[0]).toEqual({ date: "2026-03-27", start: "22:00:00", end: "00:00:00" });
    expect(segments[1]).toEqual({ date: "2026-03-28", start: "00:00:00", end: "06:00:00" });
  });

  it("handles end time of exactly midnight (00:00:00) as non-cross-midnight", () => {
    // A shift ending at midnight: 18:00–00:00 on same date = one segment
    const segments = splitCrossMidnight("2026-03-23", "18:00:00", "00:00:00");
    expect(segments).toHaveLength(1);
    expect(segments[0]).toEqual({ date: "2026-03-23", start: "18:00:00", end: "00:00:00" });
  });
});

// ---------------------------------------------------------------------------
// calculateSupplements — main engine tests
// ---------------------------------------------------------------------------

describe("calculateSupplements", () => {
  // -------------------------------------------------------------------------
  // Basic supplement detection
  // -------------------------------------------------------------------------

  describe("basic supplement detection", () => {
    it("returns empty array for daytime weekday shift with no qualifying supplements", () => {
      const input: SupplementInput = {
        shiftDate: "2026-03-23", // Monday
        startTime: "09:00:00",
        endTime: "17:00:00",
        breakMinutes: 30,
        rules: allRules,
        holidays: [],
      };
      const result = calculateSupplements(input);
      expect(result).toHaveLength(0);
    });

    it("detects kveld for an evening shift on a weekday", () => {
      // Monday 16:00–23:00 → kveld from 18:00–23:00 = 5h
      const input: SupplementInput = {
        shiftDate: "2026-03-23",
        startTime: "16:00:00",
        endTime: "23:00:00",
        breakMinutes: 0,
        rules: [kveldsRule],
        holidays: [],
      };
      const result = calculateSupplements(input);
      expect(result).toHaveLength(1);
      expect(result[0]!.type).toBe("kveld");
      expect(result[0]!.hours).toBeCloseTo(5);
    });

    it("detects helg for a Saturday daytime shift", () => {
      // Saturday 10:00–18:00 → all 8h qualify as helg
      const input: SupplementInput = {
        shiftDate: "2026-03-28", // Saturday
        startTime: "10:00:00",
        endTime: "18:00:00",
        breakMinutes: 0,
        rules: [helgRule],
        holidays: [],
      };
      const result = calculateSupplements(input);
      expect(result).toHaveLength(1);
      expect(result[0]!.type).toBe("helg");
      expect(result[0]!.hours).toBeCloseTo(8);
    });

    it("detects helligdag for a shift on Labour Day (2026-05-01)", () => {
      // Friday Labour Day — full shift qualifies as helligdag
      const input: SupplementInput = {
        shiftDate: "2026-05-01", // Friday, Labour Day
        startTime: "10:00:00",
        endTime: "18:00:00",
        breakMinutes: 0,
        rules: [helligdagRule],
        holidays: ["2026-05-01"],
      };
      const result = calculateSupplements(input);
      expect(result).toHaveLength(1);
      expect(result[0]!.type).toBe("helligdag");
      expect(result[0]!.hours).toBeCloseTo(8);
    });

    it("does NOT detect helligdag when date is not in holidays list", () => {
      const input: SupplementInput = {
        shiftDate: "2026-03-23",
        startTime: "10:00:00",
        endTime: "18:00:00",
        breakMinutes: 0,
        rules: [helligdagRule],
        holidays: [], // no holidays
      };
      const result = calculateSupplements(input);
      expect(result).toHaveLength(0);
    });
  });

  // -------------------------------------------------------------------------
  // Stacking rules
  // -------------------------------------------------------------------------

  describe("stacking rules", () => {
    it("kveld + helg stack additively (Saturday evening)", () => {
      // Saturday 18:00–23:00 → kveld (5h) + helg (5h) both present
      const input: SupplementInput = {
        shiftDate: "2026-03-28", // Saturday
        startTime: "18:00:00",
        endTime: "23:00:00",
        breakMinutes: 0,
        rules: [kveldsRule, helgRule],
        holidays: [],
      };
      const result = calculateSupplements(input);
      const types = result.map((s) => s.type);
      expect(types).toContain("kveld");
      expect(types).toContain("helg");
      expect(result).toHaveLength(2);
    });

    it("kveld + helligdag stack additively (Christmas Eve evening on a weekday)", () => {
      // Christmas Day 2026-12-25 = Friday, evening shift
      const input: SupplementInput = {
        shiftDate: "2026-12-25", // Friday, Christmas Day
        startTime: "18:00:00",
        endTime: "23:00:00",
        breakMinutes: 0,
        rules: [kveldsRule, helligdagRule],
        holidays: ["2026-12-25"],
      };
      const result = calculateSupplements(input);
      const types = result.map((s) => s.type);
      expect(types).toContain("kveld");
      expect(types).toContain("helligdag");
      expect(result).toHaveLength(2);
    });

    it("helligdag wins over helg when date is both a weekend and a public holiday", () => {
      // 2026-05-17 = Sunday AND National Day → helligdag only, NOT helg
      const input: SupplementInput = {
        shiftDate: "2026-05-17", // Sunday, National Day
        startTime: "10:00:00",
        endTime: "18:00:00",
        breakMinutes: 0,
        rules: [helgRule, helligdagRule],
        holidays: ["2026-05-17"],
      };
      const result = calculateSupplements(input);
      const types = result.map((s) => s.type);
      expect(types).toContain("helligdag");
      expect(types).not.toContain("helg");
      expect(result).toHaveLength(1);
    });

    it("kveld + helg + helligdag: helligdag replaces helg, kveld still stacks", () => {
      // Sunday National Day evening → kveld + helligdag (no helg)
      const input: SupplementInput = {
        shiftDate: "2026-05-17", // Sunday, National Day
        startTime: "18:00:00",
        endTime: "23:00:00",
        breakMinutes: 0,
        rules: allRules,
        holidays: ["2026-05-17"],
      };
      const result = calculateSupplements(input);
      const types = result.map((s) => s.type);
      expect(types).toContain("kveld");
      expect(types).toContain("helligdag");
      expect(types).not.toContain("helg");
      expect(result).toHaveLength(2);
    });
  });

  // -------------------------------------------------------------------------
  // Cross-midnight shifts
  // -------------------------------------------------------------------------

  describe("cross-midnight shifts", () => {
    it("Friday 22:00 → Saturday 06:00 splits into two segments and applies helg to Saturday hours", () => {
      // Friday segment (22:00–00:00): 2h on weekday → kveld only
      // Saturday segment (00:00–06:00): 6h on weekend → helg only (before 18:00, no kveld)
      const input: SupplementInput = {
        shiftDate: "2026-03-27", // Friday
        startTime: "22:00:00",
        endTime: "06:00:00",
        breakMinutes: 0,
        rules: [kveldsRule, helgRule],
        holidays: [],
      };
      const result = calculateSupplements(input);
      const types = result.map((s) => s.type);

      // Both supplement types present
      expect(types).toContain("kveld");
      expect(types).toContain("helg");

      const kveld = result.find((s) => s.type === "kveld")!;
      const helg = result.find((s) => s.type === "helg")!;

      // Friday 22:00–00:00 = 2h kveld
      expect(kveld.hours).toBeCloseTo(2);
      // Saturday 00:00–06:00 = 6h helg (00:00–06:00 not in evening window)
      expect(helg.hours).toBeCloseTo(6);
    });

    it("accumulates kveld hours across both segments when evening spans midnight", () => {
      // Friday 22:00 → Saturday 02:00 cross-midnight
      // Friday 22:00–00:00 = 2h kveld
      // Saturday 00:00–02:00 = 2h helg (not in 18:00+ window)
      const input: SupplementInput = {
        shiftDate: "2026-03-27",
        startTime: "22:00:00",
        endTime: "02:00:00",
        breakMinutes: 0,
        rules: [kveldsRule, helgRule],
        holidays: [],
      };
      const result = calculateSupplements(input);
      const kveld = result.find((s) => s.type === "kveld");
      const helg = result.find((s) => s.type === "helg");

      expect(kveld?.hours).toBeCloseTo(2);
      expect(helg?.hours).toBeCloseTo(2);
    });
  });

  // -------------------------------------------------------------------------
  // Break exclusion
  // -------------------------------------------------------------------------

  describe("break exclusion", () => {
    it("subtracts break proportionally from qualifying hours", () => {
      // Monday 16:00–23:00 = 7h total. 30 min break → paid = 6.5h
      // Kveld window 18:00–23:00 = 5h out of 7h total = 5/7 of paid time
      // Qualifying kveld = 5 * (6.5 / 7) ≈ 4.643h
      const input: SupplementInput = {
        shiftDate: "2026-03-23",
        startTime: "16:00:00",
        endTime: "23:00:00",
        breakMinutes: 30,
        rules: [kveldsRule],
        holidays: [],
      };
      const result = calculateSupplements(input);
      expect(result).toHaveLength(1);
      const kveld = result[0]!;
      // Without break: 5h. After proportional deduction: 5 * (6.5/7) ≈ 4.643
      expect(kveld.hours).toBeCloseTo(5 * (6.5 / 7), 3);
    });

    it("returns 0 qualifying hours when shift is all break (edge case)", () => {
      // 1h shift, 60 min break → 0 paid hours
      const input: SupplementInput = {
        shiftDate: "2026-03-23",
        startTime: "18:00:00",
        endTime: "19:00:00",
        breakMinutes: 60,
        rules: [kveldsRule],
        holidays: [],
      };
      const result = calculateSupplements(input);
      // Either empty or 0 hours
      if (result.length > 0) {
        expect(result[0]!.hours).toBeCloseTo(0);
      } else {
        expect(result).toHaveLength(0);
      }
    });
  });

  // -------------------------------------------------------------------------
  // Edge cases
  // -------------------------------------------------------------------------

  describe("edge cases", () => {
    it("ignores inactive rules", () => {
      const inactiveKveld: SupplementRule = { ...kveldsRule, isActive: false };
      const input: SupplementInput = {
        shiftDate: "2026-03-23",
        startTime: "18:00:00",
        endTime: "23:00:00",
        breakMinutes: 0,
        rules: [inactiveKveld],
        holidays: [],
      };
      const result = calculateSupplements(input);
      expect(result).toHaveLength(0);
    });

    it("returns empty array when no rules are provided", () => {
      const input: SupplementInput = {
        shiftDate: "2026-03-23",
        startTime: "18:00:00",
        endTime: "23:00:00",
        breakMinutes: 0,
        rules: [],
        holidays: [],
      };
      const result = calculateSupplements(input);
      expect(result).toHaveLength(0);
    });

    it("handles shift entirely before evening window — no kveld", () => {
      const input: SupplementInput = {
        shiftDate: "2026-03-23",
        startTime: "07:00:00",
        endTime: "15:00:00",
        breakMinutes: 0,
        rules: [kveldsRule],
        holidays: [],
      };
      const result = calculateSupplements(input);
      expect(result).toHaveLength(0);
    });

    it("computes estimatedAmount when rateType is fixed_per_hour", () => {
      const input: SupplementInput = {
        shiftDate: "2026-03-23",
        startTime: "18:00:00",
        endTime: "23:00:00",
        breakMinutes: 0,
        rules: [kveldsRule], // rate: 50 fixed_per_hour
        holidays: [],
      };
      const result = calculateSupplements(input);
      expect(result).toHaveLength(1);
      const kveld = result[0]!;
      // 5h * 50 NOK/h = 250 NOK
      expect(kveld.estimatedAmount).toBeCloseTo(250);
    });

    it("handles weekend shift on Sunday correctly", () => {
      // 2026-05-17 is Sunday but also a holiday — test pure Sunday without holiday
      // Use a Sunday that is NOT a holiday: 2026-03-22
      const input: SupplementInput = {
        shiftDate: "2026-03-22", // Sunday (getDayOfWeek = 0)
        startTime: "10:00:00",
        endTime: "16:00:00",
        breakMinutes: 0,
        rules: [helgRule],
        holidays: [],
      };
      const result = calculateSupplements(input);
      expect(result).toHaveLength(1);
      expect(result[0]!.type).toBe("helg");
      expect(result[0]!.hours).toBeCloseTo(6);
    });
  });
});
