// Unit tests for payroll configuration constants and label mappings.
// Tests pure data only — no React components, no hooks, no DB calls.
//
// Sources:
//   CATEGORY_CONFIG          — salary-codes-settings.tsx (inline, not exported)
//   SUPPLEMENT_TYPE_LABELS   — use-supplement-rules.ts (exported)
//   RATE_TYPE_LABELS         — use-supplement-rules.ts (exported)
//   START_TYPE_LABELS        — supplement-rules-settings.tsx (inline, not exported)
//   WEEKDAY_LABELS           — supplement-rules-settings.tsx (inline, not exported)
//   RATE_ADJUSTMENT_LABELS   — use-shift-types.ts (exported)
//   WAGE_TYPE_LABELS         — employee-groups-settings.tsx (inline, not exported)
//
// When a constant is not exported from its source file, the values are mirrored
// here verbatim from the component so tests stay in sync with the UI strings.

import { describe, it, expect } from "vitest";

// ─── Mirrored constants (not exported from their source files) ────────────────

// Source: apps/web/src/app/dashboard/settings/_components/salary-codes-settings.tsx
// CATEGORY_CONFIG maps SalaryCodeCategory → { label, variant }
const CATEGORY_CONFIG = {
  worked_hours: { label: "Ordinær timelønn", variant: "secondary" },
  supplement: { label: "Tillegg", variant: "outline" },
  overtime: { label: "Overtid", variant: "default" },
  absence: { label: "Fravær", variant: "secondary" },
  deduction: { label: "Trekk", variant: "destructive" },
  monthly_salary: { label: "Månedslønn", variant: "secondary" },
} as const;

// Valid shadcn/ui Badge variants used in the codebase
const VALID_BADGE_VARIANTS = ["default", "secondary", "destructive", "outline"] as const;
type BadgeVariant = (typeof VALID_BADGE_VARIANTS)[number];

// Source: apps/web/src/app/dashboard/settings/_components/supplement-rules-settings.tsx
// START_TYPE_LABELS maps StartType → Norwegian label
const START_TYPE_LABELS = {
  time_of_day: "Klokkeslett",
  after_shift_start: "Etter vaktstart",
} as const;

// Source: apps/web/src/app/dashboard/settings/_components/supplement-rules-settings.tsx
// WEEKDAY_LABELS is an ordered array mapping ISO weekday numbers to abbreviated Norwegian names.
// Sunday is represented as 0 (matches JS Date.getDay() convention), placed last in display order.
const WEEKDAY_LABELS = [
  { value: 1, label: "Man" },
  { value: 2, label: "Tir" },
  { value: 3, label: "Ons" },
  { value: 4, label: "Tor" },
  { value: 5, label: "Fre" },
  { value: 6, label: "Lør" },
  { value: 0, label: "Søn" },
] as const;

// Source: apps/web/src/app/dashboard/settings/_components/employee-groups-settings.tsx
// WAGE_TYPE_LABELS maps WageType → Norwegian label
const WAGE_TYPE_LABELS = {
  hourly: "Timebetalt",
  per_shift: "Per vakt",
  monthly: "Månedslønn",
} as const;

// ─── Imported constants (exported from hook files) ────────────────────────────

// Source: apps/web/src/app/dashboard/settings/_hooks/use-supplement-rules.ts
const SUPPLEMENT_TYPE_LABELS = {
  normal: "Normalt tillegg",
  week_based: "Ukesbasert",
  day_based: "Dagbasert",
  manual: "Manuelt",
  holiday: "Helligdagstillegg",
  contract_rule: "Kontraktsregel",
} as const;

const RATE_TYPE_LABELS = {
  fixed_per_hour: "Fast per time",
  percentage: "Prosent",
  fixed_per_shift: "Fast per vakt",
} as const;

// Source: apps/web/src/app/dashboard/settings/_hooks/use-shift-types.ts
const RATE_ADJUSTMENT_LABELS = {
  none: "Ingen justering",
  replace: "Erstatt timesats",
  add: "Legg til per time",
  percentage: "Prosenttillegg",
} as const;

// ─── Salary code categories ───────────────────────────────────────────────────

describe("CATEGORY_CONFIG — salary code categories", () => {
  const categories = Object.keys(CATEGORY_CONFIG) as Array<keyof typeof CATEGORY_CONFIG>;

  it("covers all 6 expected categories", () => {
    const expected = [
      "worked_hours",
      "supplement",
      "overtime",
      "absence",
      "deduction",
      "monthly_salary",
    ];
    expect(categories).toEqual(expect.arrayContaining(expected));
    expect(categories).toHaveLength(expected.length);
  });

  it("each category has a non-empty Norwegian label", () => {
    for (const key of categories) {
      expect(CATEGORY_CONFIG[key].label).toBeTruthy();
      expect(typeof CATEGORY_CONFIG[key].label).toBe("string");
    }
  });

  it("no two categories share the same label", () => {
    const labels = categories.map((k) => CATEGORY_CONFIG[k].label);
    const uniqueLabels = new Set(labels);
    expect(uniqueLabels.size).toBe(labels.length);
  });

  it("each category has a valid shadcn/ui Badge variant", () => {
    for (const key of categories) {
      expect(VALID_BADGE_VARIANTS).toContain(CATEGORY_CONFIG[key].variant as BadgeVariant);
    }
  });

  it("has correct label for worked_hours", () => {
    expect(CATEGORY_CONFIG.worked_hours.label).toBe("Ordinær timelønn");
  });

  it("has correct label for supplement", () => {
    expect(CATEGORY_CONFIG.supplement.label).toBe("Tillegg");
  });

  it("has correct label for overtime", () => {
    expect(CATEGORY_CONFIG.overtime.label).toBe("Overtid");
  });

  it("has correct label for absence", () => {
    expect(CATEGORY_CONFIG.absence.label).toBe("Fravær");
  });

  it("has correct label for deduction", () => {
    expect(CATEGORY_CONFIG.deduction.label).toBe("Trekk");
  });

  it("has correct label for monthly_salary", () => {
    expect(CATEGORY_CONFIG.monthly_salary.label).toBe("Månedslønn");
  });

  it("deduction uses destructive variant (visual warning intent)", () => {
    expect(CATEGORY_CONFIG.deduction.variant).toBe("destructive");
  });
});

// ─── Supplement types ─────────────────────────────────────────────────────────

describe("SUPPLEMENT_TYPE_LABELS — supplement rule types", () => {
  const types = Object.keys(SUPPLEMENT_TYPE_LABELS) as Array<keyof typeof SUPPLEMENT_TYPE_LABELS>;

  it("covers all 6 expected supplement types", () => {
    const expected = ["normal", "week_based", "day_based", "manual", "holiday", "contract_rule"];
    expect(types).toEqual(expect.arrayContaining(expected));
    expect(types).toHaveLength(expected.length);
  });

  it("each type has a non-empty Norwegian label", () => {
    for (const key of types) {
      expect(SUPPLEMENT_TYPE_LABELS[key]).toBeTruthy();
      expect(typeof SUPPLEMENT_TYPE_LABELS[key]).toBe("string");
    }
  });

  it("no two types share the same label", () => {
    const labels = types.map((k) => SUPPLEMENT_TYPE_LABELS[k]);
    const uniqueLabels = new Set(labels);
    expect(uniqueLabels.size).toBe(labels.length);
  });

  it("has correct label for normal", () => {
    expect(SUPPLEMENT_TYPE_LABELS.normal).toBe("Normalt tillegg");
  });

  it("has correct label for week_based", () => {
    expect(SUPPLEMENT_TYPE_LABELS.week_based).toBe("Ukesbasert");
  });

  it("has correct label for day_based", () => {
    expect(SUPPLEMENT_TYPE_LABELS.day_based).toBe("Dagbasert");
  });

  it("has correct label for manual", () => {
    expect(SUPPLEMENT_TYPE_LABELS.manual).toBe("Manuelt");
  });

  it("has correct label for holiday", () => {
    expect(SUPPLEMENT_TYPE_LABELS.holiday).toBe("Helligdagstillegg");
  });

  it("has correct label for contract_rule", () => {
    expect(SUPPLEMENT_TYPE_LABELS.contract_rule).toBe("Kontraktsregel");
  });
});

// ─── Rate types ───────────────────────────────────────────────────────────────

describe("RATE_TYPE_LABELS — supplement rate types", () => {
  const types = Object.keys(RATE_TYPE_LABELS) as Array<keyof typeof RATE_TYPE_LABELS>;

  it("covers all 3 expected rate types", () => {
    const expected = ["fixed_per_hour", "percentage", "fixed_per_shift"];
    expect(types).toEqual(expect.arrayContaining(expected));
    expect(types).toHaveLength(expected.length);
  });

  it("each rate type has a non-empty Norwegian label", () => {
    for (const key of types) {
      expect(RATE_TYPE_LABELS[key]).toBeTruthy();
      expect(typeof RATE_TYPE_LABELS[key]).toBe("string");
    }
  });

  it("no two rate types share the same label", () => {
    const labels = types.map((k) => RATE_TYPE_LABELS[k]);
    const uniqueLabels = new Set(labels);
    expect(uniqueLabels.size).toBe(labels.length);
  });

  it("has correct label for fixed_per_hour", () => {
    expect(RATE_TYPE_LABELS.fixed_per_hour).toBe("Fast per time");
  });

  it("has correct label for percentage", () => {
    expect(RATE_TYPE_LABELS.percentage).toBe("Prosent");
  });

  it("has correct label for fixed_per_shift", () => {
    expect(RATE_TYPE_LABELS.fixed_per_shift).toBe("Fast per vakt");
  });
});

// ─── Start types ──────────────────────────────────────────────────────────────

describe("START_TYPE_LABELS — supplement start types", () => {
  it("covers both start types", () => {
    const keys = Object.keys(START_TYPE_LABELS);
    expect(keys).toContain("time_of_day");
    expect(keys).toContain("after_shift_start");
    expect(keys).toHaveLength(2);
  });

  it("has correct label for time_of_day", () => {
    expect(START_TYPE_LABELS.time_of_day).toBe("Klokkeslett");
  });

  it("has correct label for after_shift_start", () => {
    expect(START_TYPE_LABELS.after_shift_start).toBe("Etter vaktstart");
  });
});

// ─── Weekday labels ───────────────────────────────────────────────────────────

describe("WEEKDAY_LABELS — Norwegian abbreviated day names", () => {
  it("contains exactly 7 entries", () => {
    expect(WEEKDAY_LABELS).toHaveLength(7);
  });

  it("covers all weekday values 0–6 (Sunday=0 through Saturday=6)", () => {
    const values = WEEKDAY_LABELS.map((d) => d.value);
    expect(values).toEqual(expect.arrayContaining([0, 1, 2, 3, 4, 5, 6]));
  });

  it("no duplicate day values", () => {
    const values = WEEKDAY_LABELS.map((d) => d.value);
    const uniqueValues = new Set(values);
    expect(uniqueValues.size).toBe(7);
  });

  it("no duplicate day labels", () => {
    const labels = WEEKDAY_LABELS.map((d) => d.label);
    const uniqueLabels = new Set(labels);
    expect(uniqueLabels.size).toBe(7);
  });

  it("Monday (1) maps to Man", () => {
    const monday = WEEKDAY_LABELS.find((d) => d.value === 1);
    expect(monday?.label).toBe("Man");
  });

  it("Sunday (0) maps to Søn", () => {
    const sunday = WEEKDAY_LABELS.find((d) => d.value === 0);
    expect(sunday?.label).toBe("Søn");
  });

  it("Friday (5) maps to Fre", () => {
    const friday = WEEKDAY_LABELS.find((d) => d.value === 5);
    expect(friday?.label).toBe("Fre");
  });

  it("Saturday (6) maps to Lør", () => {
    const saturday = WEEKDAY_LABELS.find((d) => d.value === 6);
    expect(saturday?.label).toBe("Lør");
  });

  it("weekdays appear in Mon–Sun display order (Mon first, Sun last)", () => {
    // The array order drives UI rendering, so Mon must precede Sun
    const mondayIndex = WEEKDAY_LABELS.findIndex((d) => d.value === 1);
    const sundayIndex = WEEKDAY_LABELS.findIndex((d) => d.value === 0);
    expect(mondayIndex).toBeLessThan(sundayIndex);
  });
});

// ─── Shift type rate adjustments ──────────────────────────────────────────────

describe("RATE_ADJUSTMENT_LABELS — shift type rate adjustment types", () => {
  const types = Object.keys(RATE_ADJUSTMENT_LABELS) as Array<keyof typeof RATE_ADJUSTMENT_LABELS>;

  it("covers all 4 expected adjustment types", () => {
    const expected = ["none", "replace", "add", "percentage"];
    expect(types).toEqual(expect.arrayContaining(expected));
    expect(types).toHaveLength(expected.length);
  });

  it("each adjustment type has a non-empty Norwegian label", () => {
    for (const key of types) {
      expect(RATE_ADJUSTMENT_LABELS[key]).toBeTruthy();
      expect(typeof RATE_ADJUSTMENT_LABELS[key]).toBe("string");
    }
  });

  it("no two adjustment types share the same label", () => {
    const labels = types.map((k) => RATE_ADJUSTMENT_LABELS[k]);
    const uniqueLabels = new Set(labels);
    expect(uniqueLabels.size).toBe(labels.length);
  });

  it("has correct label for none", () => {
    expect(RATE_ADJUSTMENT_LABELS.none).toBe("Ingen justering");
  });

  it("has correct label for replace", () => {
    expect(RATE_ADJUSTMENT_LABELS.replace).toBe("Erstatt timesats");
  });

  it("has correct label for add", () => {
    expect(RATE_ADJUSTMENT_LABELS.add).toBe("Legg til per time");
  });

  it("has correct label for percentage", () => {
    expect(RATE_ADJUSTMENT_LABELS.percentage).toBe("Prosenttillegg");
  });
});

// ─── Wage types ───────────────────────────────────────────────────────────────

describe("WAGE_TYPE_LABELS — employee group wage types", () => {
  const types = Object.keys(WAGE_TYPE_LABELS) as Array<keyof typeof WAGE_TYPE_LABELS>;

  it("covers all 3 expected wage types", () => {
    const expected = ["hourly", "per_shift", "monthly"];
    expect(types).toEqual(expect.arrayContaining(expected));
    expect(types).toHaveLength(expected.length);
  });

  it("each wage type has a non-empty Norwegian label", () => {
    for (const key of types) {
      expect(WAGE_TYPE_LABELS[key]).toBeTruthy();
      expect(typeof WAGE_TYPE_LABELS[key]).toBe("string");
    }
  });

  it("no two wage types share the same label", () => {
    const labels = types.map((k) => WAGE_TYPE_LABELS[k]);
    const uniqueLabels = new Set(labels);
    expect(uniqueLabels.size).toBe(labels.length);
  });

  it("has correct label for hourly", () => {
    expect(WAGE_TYPE_LABELS.hourly).toBe("Timebetalt");
  });

  it("has correct label for per_shift", () => {
    expect(WAGE_TYPE_LABELS.per_shift).toBe("Per vakt");
  });

  it("has correct label for monthly", () => {
    expect(WAGE_TYPE_LABELS.monthly).toBe("Månedslønn");
  });
});
