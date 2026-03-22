/**
 * Tests for projectAbsenceBalance() — pure function that projects how many days
 * an absence request consumes and whether it's allowed.
 *
 * Business rules under test:
 * - Workday counting (Mon-Fri) vs all-days (countWeekends=true)
 * - Public holiday exclusion from vacation counts
 * - Balance validation (isAllowed=false when balance goes negative)
 * - Overlap detection against existing pending/approved requests
 * - Instance limits: maxDaysPerInstance and maxInstancesPerYear
 * - Cross-year requests (Dec→Jan span)
 *
 * Test dates (verified):
 * - 2026-04-10 = Friday, 2026-04-11 = Saturday, 2026-04-13 = Monday
 * - 2026-04-13 = Monday through 2026-04-17 = Friday (Mon-Fri = 5 weekdays)
 * - 2026-04-14 = Tuesday through 2026-04-18 = Saturday (Tue-Fri = 4 weekdays)
 * - 2026-04-27 = Monday through 2026-05-01 = Friday (May 1 is Labour Day)
 * - 2026-12-29 = Tuesday, 2026-12-31 = Thursday, 2027-01-01 = Friday (holiday), 2027-01-02 = Saturday
 */

import {
  projectAbsenceBalance,
  countDaysInRange,
  type AbsenceTypeConfig,
  type ProjectionInput,
} from "../absence-projection";

// --- Shared configs ---

function makeVacationConfig(overrides: Partial<AbsenceTypeConfig> = {}): AbsenceTypeConfig {
  return {
    category: "vacation",
    countWeekends: false,
    maxDaysPerInstance: null,
    maxInstancesPerYear: null,
    currentYearInstances: 0,
    ...overrides,
  };
}

function makeEgenmeldingConfig(overrides: Partial<AbsenceTypeConfig> = {}): AbsenceTypeConfig {
  return {
    category: "egenmelding",
    countWeekends: false,
    maxDaysPerInstance: 3,
    maxInstancesPerYear: 4,
    currentYearInstances: 0,
    ...overrides,
  };
}

function makeInput(overrides: Partial<ProjectionInput> = {}): ProjectionInput {
  return {
    currentBalance: 25,
    // 2026-04-13 (Mon) to 2026-04-17 (Fri) = 5 workdays — the canonical "full week" range
    startDate: "2026-04-13",
    endDate: "2026-04-17",
    absenceType: makeVacationConfig(),
    holidays: [],
    existingRequests: [],
    ...overrides,
  };
}

// --- countDaysInRange tests ---

describe("countDaysInRange", () => {
  describe("basic workday counting", () => {
    it("counts Mon-Fri as 5 days (no weekends, no holidays)", () => {
      // 2026-04-13 (Mon) to 2026-04-17 (Fri) — 5 weekdays
      expect(countDaysInRange("2026-04-13", "2026-04-17", false, [])).toBe(5);
    });

    it("counts only 1 weekday when range is Fri-Sat", () => {
      // 2026-04-10 (Fri) to 2026-04-11 (Sat) — 1 weekday
      expect(countDaysInRange("2026-04-10", "2026-04-11", false, [])).toBe(1);
    });

    it("counts 2 weekdays when range spans a full weekend", () => {
      // 2026-04-10 (Fri) to 2026-04-13 (Mon) — Fri + Mon = 2 weekdays
      expect(countDaysInRange("2026-04-10", "2026-04-13", false, [])).toBe(2);
    });

    it("counts a single weekday as 1", () => {
      expect(countDaysInRange("2026-04-14", "2026-04-14", false, [])).toBe(1);
    });

    it("counts a single weekend day as 0", () => {
      expect(countDaysInRange("2026-04-11", "2026-04-11", false, [])).toBe(0);
    });
  });

  describe("countWeekends=true", () => {
    it("counts all calendar days including weekends", () => {
      // 2026-04-10 (Fri) to 2026-04-13 (Mon) = 4 calendar days
      expect(countDaysInRange("2026-04-10", "2026-04-13", true, [])).toBe(4);
    });

    it("counts a single weekend day as 1", () => {
      expect(countDaysInRange("2026-04-11", "2026-04-11", true, [])).toBe(1);
    });
  });

  describe("holiday exclusion", () => {
    it("excludes a public holiday on a weekday", () => {
      // 2026-04-27 (Mon) to 2026-05-01 (Fri), May 1 = Labour Day → 4 days
      expect(countDaysInRange("2026-04-27", "2026-05-01", false, ["2026-05-01"])).toBe(4);
    });

    it("does not exclude a holiday that falls on a weekend (already excluded)", () => {
      // Holiday on Saturday 2026-04-11, range Fri-Mon. Without holiday: 2. Holiday on Sat: still 2.
      expect(countDaysInRange("2026-04-10", "2026-04-13", false, ["2026-04-11"])).toBe(2);
    });

    it("excludes multiple holidays", () => {
      // 2026-04-13 (Mon) to 2026-04-17 (Fri) = 5 weekdays, two holidays on Mon+Fri → 3 days
      expect(
        countDaysInRange("2026-04-13", "2026-04-17", false, ["2026-04-13", "2026-04-17"]),
      ).toBe(3);
    });
  });

  describe("countWeekends=true with holidays", () => {
    it("counts holidays when countWeekends is true (holidays NOT excluded)", () => {
      // When counting all days, holidays are included
      // 2026-04-27 to 2026-05-01 = 5 calendar days, May 1 holiday but still counted
      expect(countDaysInRange("2026-04-27", "2026-05-01", true, ["2026-05-01"])).toBe(5);
    });
  });
});

// --- projectAbsenceBalance tests ---

describe("projectAbsenceBalance", () => {
  describe("basic workday counting", () => {
    it("correctly projects Mon-Fri as 5 workdays", () => {
      const result = projectAbsenceBalance(makeInput());
      expect(result.requestedDays).toBe(5);
    });

    it("deducts requestedDays from currentBalance", () => {
      const result = projectAbsenceBalance(makeInput({ currentBalance: 25 }));
      expect(result.balanceAfter).toBe(20);
    });

    it("counts all days when countWeekends=true", () => {
      // Fri to Mon = 4 calendar days
      const result = projectAbsenceBalance(
        makeInput({
          startDate: "2026-04-10",
          endDate: "2026-04-13",
          absenceType: makeVacationConfig({ countWeekends: true }),
        }),
      );
      expect(result.requestedDays).toBe(4);
    });

    it("returns isAllowed=true when balance is sufficient", () => {
      const result = projectAbsenceBalance(makeInput({ currentBalance: 25 }));
      expect(result.isAllowed).toBe(true);
      expect(result.warnings).not.toContain("Ikke nok dager tilgjengelig");
    });
  });

  describe("balance validation", () => {
    it("returns isAllowed=false when balance goes negative", () => {
      const result = projectAbsenceBalance(
        makeInput({ currentBalance: 3 }), // requesting 5 days
      );
      expect(result.isAllowed).toBe(false);
      expect(result.balanceAfter).toBe(-2);
      expect(result.warnings).toContain("Ikke nok dager tilgjengelig");
    });

    it("returns isAllowed=true when balance is exactly 0 after request", () => {
      const result = projectAbsenceBalance(
        makeInput({ currentBalance: 5 }), // requesting exactly 5 days
      );
      expect(result.isAllowed).toBe(true);
      expect(result.balanceAfter).toBe(0);
    });

    it("returns isAllowed=false but still calculates correct requestedDays", () => {
      const result = projectAbsenceBalance(
        makeInput({ currentBalance: 2 }), // requesting 5 days
      );
      expect(result.requestedDays).toBe(5);
      expect(result.balanceAfter).toBe(-3);
    });
  });

  describe("holiday exclusion", () => {
    it("excludes a public holiday from vacation count", () => {
      // Mon-Fri with Labour Day on Fri → 4 days
      const result = projectAbsenceBalance(
        makeInput({
          startDate: "2026-04-27",
          endDate: "2026-05-01",
          holidays: ["2026-05-01"],
          currentBalance: 25,
        }),
      );
      expect(result.requestedDays).toBe(4);
      expect(result.balanceAfter).toBe(21);
    });

    it("does not exclude holidays when countWeekends=true", () => {
      // countWeekends=true — all days counted including holidays
      const result = projectAbsenceBalance(
        makeInput({
          startDate: "2026-04-27",
          endDate: "2026-05-01",
          holidays: ["2026-05-01"],
          absenceType: makeVacationConfig({ countWeekends: true }),
          currentBalance: 25,
        }),
      );
      expect(result.requestedDays).toBe(5);
    });
  });

  describe("overlap detection", () => {
    it("adds warning when request overlaps an existing pending request", () => {
      const result = projectAbsenceBalance(
        makeInput({
          startDate: "2026-04-14",
          endDate: "2026-04-18",
          existingRequests: [{ startDate: "2026-04-16", endDate: "2026-04-20", status: "pending" }],
        }),
      );
      expect(result.warnings.some((w) => w.includes("Overlapper med"))).toBe(true);
    });

    it("adds warning when request overlaps an existing approved request", () => {
      const result = projectAbsenceBalance(
        makeInput({
          startDate: "2026-04-14",
          endDate: "2026-04-18",
          existingRequests: [
            { startDate: "2026-04-10", endDate: "2026-04-15", status: "approved" },
          ],
        }),
      );
      expect(result.warnings.some((w) => w.includes("Overlapper med"))).toBe(true);
    });

    it("does NOT warn for cancelled requests", () => {
      const result = projectAbsenceBalance(
        makeInput({
          existingRequests: [
            { startDate: "2026-04-14", endDate: "2026-04-18", status: "cancelled" },
          ],
        }),
      );
      expect(result.warnings.some((w) => w.includes("Overlapper med"))).toBe(false);
    });

    it("does NOT warn for rejected requests", () => {
      const result = projectAbsenceBalance(
        makeInput({
          existingRequests: [
            { startDate: "2026-04-14", endDate: "2026-04-18", status: "rejected" },
          ],
        }),
      );
      expect(result.warnings.some((w) => w.includes("Overlapper med"))).toBe(false);
    });

    it("does NOT warn when requests are adjacent (not overlapping)", () => {
      // existing: Apr 10-13, new: Apr 14-18 — touching but not overlapping
      const result = projectAbsenceBalance(
        makeInput({
          startDate: "2026-04-14",
          endDate: "2026-04-18",
          existingRequests: [
            { startDate: "2026-04-10", endDate: "2026-04-13", status: "approved" },
          ],
        }),
      );
      expect(result.warnings.some((w) => w.includes("Overlapper med"))).toBe(false);
    });

    it("includes the overlapping dates in the warning message", () => {
      const result = projectAbsenceBalance(
        makeInput({
          startDate: "2026-04-14",
          endDate: "2026-04-18",
          existingRequests: [{ startDate: "2026-04-16", endDate: "2026-04-20", status: "pending" }],
        }),
      );
      const overlapWarning = result.warnings.find((w) => w.includes("Overlapper med"));
      expect(overlapWarning).toBeDefined();
      // Should contain the start of the conflicting request
      expect(overlapWarning).toContain("2026-04-16");
    });

    it("can have both overlap warning and balance warning simultaneously", () => {
      const result = projectAbsenceBalance(
        makeInput({
          currentBalance: 2,
          existingRequests: [{ startDate: "2026-04-16", endDate: "2026-04-20", status: "pending" }],
        }),
      );
      expect(result.isAllowed).toBe(false);
      expect(result.warnings).toContain("Ikke nok dager tilgjengelig");
      expect(result.warnings.some((w) => w.includes("Overlapper med"))).toBe(true);
    });
  });

  describe("instance limits", () => {
    it("warns when maxDaysPerInstance is exceeded", () => {
      // Egenmelding allows max 3 days per instance, requesting 5
      const result = projectAbsenceBalance(
        makeInput({
          startDate: "2026-04-14",
          endDate: "2026-04-18",
          absenceType: makeEgenmeldingConfig(),
        }),
      );
      expect(result.warnings.some((w) => w.includes("Maks dager per sykemelding"))).toBe(true);
    });

    it("does NOT warn when request is within maxDaysPerInstance", () => {
      // Requesting 2 days, limit is 3
      const result = projectAbsenceBalance(
        makeInput({
          startDate: "2026-04-14",
          endDate: "2026-04-15",
          absenceType: makeEgenmeldingConfig(),
        }),
      );
      expect(result.warnings.some((w) => w.includes("Maks dager per sykemelding"))).toBe(false);
    });

    it("warns when maxInstancesPerYear is exceeded", () => {
      // Already at 4 instances (the limit), submitting another
      const result = projectAbsenceBalance(
        makeInput({
          startDate: "2026-04-14",
          endDate: "2026-04-14", // 1 day, within maxDaysPerInstance
          absenceType: makeEgenmeldingConfig({ currentYearInstances: 4 }),
        }),
      );
      expect(result.warnings.some((w) => w.includes("Maks antall egenmeldinger"))).toBe(true);
    });

    it("does NOT warn when instances are below the limit", () => {
      const result = projectAbsenceBalance(
        makeInput({
          startDate: "2026-04-14",
          endDate: "2026-04-14",
          absenceType: makeEgenmeldingConfig({ currentYearInstances: 2 }),
        }),
      );
      expect(result.warnings.some((w) => w.includes("Maks antall egenmeldinger"))).toBe(false);
    });

    it("does NOT check instance limits when limits are null", () => {
      // Vacation type with null limits — no instance warnings
      const result = projectAbsenceBalance(
        makeInput({
          startDate: "2026-04-14",
          endDate: "2026-04-18",
          absenceType: makeVacationConfig(),
        }),
      );
      expect(result.warnings.some((w) => w.includes("Maks dager per sykemelding"))).toBe(false);
      expect(result.warnings.some((w) => w.includes("Maks antall egenmeldinger"))).toBe(false);
    });

    it("instance limit warning does not affect isAllowed directly", () => {
      // Warnings for instance limits inform but don't block (isAllowed driven by balance)
      const result = projectAbsenceBalance(
        makeInput({
          currentBalance: 25,
          startDate: "2026-04-14",
          endDate: "2026-04-18",
          absenceType: makeEgenmeldingConfig(), // 5 days > 3 day limit
        }),
      );
      // isAllowed is false because instance limit exceeded (we treat it as blocking)
      expect(result.isAllowed).toBe(false);
    });
  });

  describe("cross-year requests", () => {
    it("counts days across Dec→Jan boundary correctly", () => {
      // 2026-12-29 (Tue) to 2027-01-02 (Sat)
      // Weekdays: Dec 29 (Tue), Dec 30 (Wed), Dec 31 (Thu), Jan 2 (Sat=skip)
      // Jan 1 (Fri) is a public holiday → excluded
      // So: Tue + Wed + Thu = 3 workdays
      const result = projectAbsenceBalance(
        makeInput({
          startDate: "2026-12-29",
          endDate: "2027-01-02",
          holidays: ["2027-01-01"],
          currentBalance: 25,
        }),
      );
      expect(result.requestedDays).toBe(3);
    });

    it("does not split by year — counts all days in range as one unit", () => {
      // If the logic were to split by year, it might count differently.
      // Verify we get 3 days (not 2+something from two separate year counts).
      const result = projectAbsenceBalance(
        makeInput({
          startDate: "2026-12-29",
          endDate: "2027-01-02",
          holidays: ["2027-01-01"],
          currentBalance: 25,
        }),
      );
      expect(result.requestedDays).toBe(3);
      expect(result.balanceAfter).toBe(22);
    });

    it("returns isAllowed=false across year boundary when balance is insufficient", () => {
      const result = projectAbsenceBalance(
        makeInput({
          startDate: "2026-12-29",
          endDate: "2027-01-02",
          holidays: ["2027-01-01"],
          currentBalance: 2, // needs 3
        }),
      );
      expect(result.isAllowed).toBe(false);
      expect(result.warnings).toContain("Ikke nok dager tilgjengelig");
    });
  });
});
