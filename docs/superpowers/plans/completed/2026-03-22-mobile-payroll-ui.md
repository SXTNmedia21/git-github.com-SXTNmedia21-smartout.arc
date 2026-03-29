---
title: Mobile Payroll UI Implementation Plan
status: done
updated: 2026-03-26
created: 2026-03-22
module: payroll
tags: [mobile, payroll, react-native, implementation]
---

# Mobile Payroll UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build 6 employee-facing payroll surfaces in the React Native mobile app — home card, absence balance, timebank, absence request, payslip, and supplement badges.

**Architecture:** Pure functions for all business logic (supplements, absence projection, earnings calc). TanStack Query hooks for data. Cross-schema queries via `supabase.schema("payroll")`. All UI follows existing `createStyles()` + haptics + Norwegian strings pattern.

**Tech Stack:** React Native, Expo, TypeScript, TanStack Query v5, Supabase JS v2, expo-haptics, expo-router, lucide-react-native

**Spec:** `docs/superpowers/specs/2026-03-22-mobile-payroll-ui-design.md`

**Dependency:** This plan assumes the payroll-foundation feature is merged and the `payroll` schema exists in Supabase (23 tables, 16 enums from `supabase/migrations/20260422100*.sql`). Types must be regenerated before starting.

---

## File Map

### Pure Functions (no deps, fully testable)

| File                                        | Responsibility                                                    |
| ------------------------------------------- | ----------------------------------------------------------------- |
| `apps/mobile/src/lib/supplements.ts`        | Shift → applicable supplements with stacking rules                |
| `apps/mobile/src/lib/absence-projection.ts` | Balance projection with holidays, overlaps, instance limits       |
| `apps/mobile/src/lib/payroll-calc.ts`       | Live earnings estimate (hourly rate × elapsed time + supplements) |
| `apps/mobile/src/lib/trust-labels.ts`       | Canonical trust tier labeling (estimate/recorded/settled)         |

### Query Hooks

| File                                                       | Responsibility                                                    |
| ---------------------------------------------------------- | ----------------------------------------------------------------- |
| `apps/mobile/src/hooks/queries/use-payroll-summary.ts`     | Aggregated home card data (single hook, multiple queries batched) |
| `apps/mobile/src/hooks/queries/use-absence-balance.ts`     | Absence quotas + ledger entries                                   |
| `apps/mobile/src/hooks/queries/use-timebank-balance.ts`    | Timebank entries + computed balance                               |
| `apps/mobile/src/hooks/queries/use-supplement-rules.ts`    | Workspace supplement rules + holidays (cached)                    |
| `apps/mobile/src/hooks/queries/use-payslips.ts`            | Payroll periods + calculations + lines                            |
| `apps/mobile/src/hooks/queries/use-my-absence-requests.ts` | Employee's schedule_absence records                               |

### Mutation Hooks

| File                                                     | Responsibility                             |
| -------------------------------------------------------- | ------------------------------------------ |
| `apps/mobile/src/hooks/mutations/use-request-absence.ts` | Submit absence request to schedule_absence |
| `apps/mobile/src/hooks/mutations/use-cancel-absence.ts`  | Cancel pending absence request             |

### UI Components

| File                                                          | Responsibility                        |
| ------------------------------------------------------------- | ------------------------------------- |
| `apps/mobile/src/components/payroll/SupplementBadges.tsx`     | Color-coded badge strip for ShiftCard |
| `apps/mobile/src/components/payroll/PayrollHomeCard.tsx`      | Adaptive home card with 4 phase modes |
| `apps/mobile/src/components/payroll/AbsenceBalanceScreen.tsx` | Balance list + ledger detail          |
| `apps/mobile/src/components/payroll/TimebankScreen.tsx`       | TOIL balance banner + ledger          |
| `apps/mobile/src/components/payroll/AbsenceRequestScreen.tsx` | Balance-first request form + history  |
| `apps/mobile/src/components/payroll/PayslipScreen.tsx`        | Min lønn detail + period list         |

### Modified Files

| File                                                  | Change                                        |
| ----------------------------------------------------- | --------------------------------------------- |
| `apps/mobile/src/constants/strings.ts`                | Add `payroll` section (~60 new strings)       |
| `apps/mobile/src/components/shift/ShiftCard.tsx`      | Add SupplementBadges below shift details      |
| `apps/mobile/src/components/home/SettingsSheet.tsx`   | Add "Lønn & fravær" section with 4 menu items |
| `apps/mobile/src/components/home/NoShiftView.tsx`     | Add PayrollHomeCard below next shift card     |
| `apps/mobile/src/components/home/BeforeShiftView.tsx` | Add PayrollHomeCard below confirm action      |
| `apps/mobile/src/components/home/DuringShiftView.tsx` | Add PayrollHomeCard below punch out button    |
| `apps/mobile/src/components/home/AfterShiftView.tsx`  | Add PayrollHomeCard below hours confirmation  |

### Route Files (expo-router file-based routing)

| File                                                 | Screen Component       |
| ---------------------------------------------------- | ---------------------- |
| `apps/mobile/src/app/(app)/(me)/absence-request.tsx` | `AbsenceRequestScreen` |
| `apps/mobile/src/app/(app)/(me)/absence-balance.tsx` | `AbsenceBalanceScreen` |
| `apps/mobile/src/app/(app)/(me)/timebank.tsx`        | `TimebankScreen`       |
| `apps/mobile/src/app/(app)/(me)/payslip.tsx`         | `PayslipScreen`        |

### Test Files

| File                                                       | Tests                                           |
| ---------------------------------------------------------- | ----------------------------------------------- |
| `apps/mobile/src/lib/__tests__/supplements.test.ts`        | Stacking, cross-midnight, breaks, holidays      |
| `apps/mobile/src/lib/__tests__/absence-projection.test.ts` | Workdays, holidays, overlaps, instance limits   |
| `apps/mobile/src/lib/__tests__/payroll-calc.test.ts`       | Earnings calculation, supplement amounts        |
| `apps/mobile/src/lib/__tests__/trust-labels.test.ts`       | Trust tier resolution per phase and data source |

---

## Task 0: Pre-flight — Verify Schema + Regenerate Types

**Files:**

- Verify: `supabase/migrations/20260422100*.sql` (7 migration files exist)
- Regenerate: `packages/supabase/src/database.types.ts`

- [ ] **Step 1: Verify payroll schema exists**

Run: `docker exec -i $(docker ps -q -f name=supabase_db) psql -U postgres -c "SELECT count(*) FROM pg_tables WHERE schemaname = 'payroll';"`
Expected: count = 23

- [ ] **Step 2: Regenerate TypeScript types with payroll schema**

Run: `cd /home/sxtnl/dev/wt-5 && npx supabase gen types typescript --local --schema public --schema payroll > packages/supabase/src/database.types.ts`

- [ ] **Step 3: Verify payroll types exist in generated file**

Run: `grep -c "payroll" packages/supabase/src/database.types.ts`
Expected: > 0

- [ ] **Step 4: Commit if types changed**

```bash
git add packages/supabase/src/database.types.ts
git commit -m "chore: regenerate types with payroll schema for mobile"
```

---

## Task 1: Norwegian Strings

**Files:**

- Modify: `apps/mobile/src/constants/strings.ts`

- [ ] **Step 1: Read the existing strings file**

Read `apps/mobile/src/constants/strings.ts` to understand the current structure.

- [ ] **Step 2: Add the `payroll` section**

Add after the `common` section, before the closing `} as const`:

```typescript
payroll: {
  title: "Lønn & fravær",
  absence: "Fravær",
  absenceBalance: "Fraværssaldo",
  timebank: "Timebank",
  myPay: "Min lønn",
  seeAll: "Se alt",
  // Trust labels
  preliminaryEstimate: "Foreløpig estimat",
  registeredTime: "Registrert tid",
  settledInPayroll: "Avregnet i lønn",
  estimateDisclaimer: "Foreløpig estimat basert på planlagt tid og gjeldende satser. Endelig beløp kan avvike.",
  // Absence types
  vacation: "Ferie",
  selfReported: "Egenmelding",
  careDays: "Omsorgsdager",
  // Balance
  daysRemaining: "dager igjen",
  of: "av",
  balanceAfter: "Saldo etter",
  workdays: "virkedager",
  available: "Tilgjengelig",
  lastUpdated: "Sist oppdatert",
  // Request
  requestAbsence: "Søk om fravær",
  absenceType: "Type fravær",
  period: "Periode",
  comment: "Kommentar",
  commentOptional: "Kommentar (valgfritt)",
  sendRequest: "Send søknad",
  myRequests: "Mine søknader",
  pending: "Venter",
  approved: "Godkjent",
  rejected: "Avslått",
  cancelled: "Kansellert",
  cancelRequest: "Kanseller",
  overlapWarning: "Overlapper med eksisterende fravær",
  insufficientBalance: "Ikke nok dager tilgjengelig",
  // Payslip
  lastPaid: "Sist utbetalt",
  netPay: "Utbetalt",
  grossPay: "Bruttolønn",
  baseSalary: "Grunnlønn",
  supplements: "Tillegg",
  overtime: "Overtid",
  taxDeduction: "Skattetrekk",
  workHours: "Arbeidstimer",
  absenceDeduction: "Fraværstrekk",
  downloadPdf: "Last ned PDF",
  previousPeriods: "Tidligere",
  specification: "Spesifikasjon",
  // Supplements
  eveningSupplement: "Kveldstillegg",
  weekendSupplement: "Helgetillegg",
  holidaySupplement: "Helligdagstillegg",
  todaysSupplements: "Dagens tillegg",
  // Home card
  earnedToday: "Opptjent i dag",
  earnedThisShift: "Opptjent denne vakten",
  totalSoFar: "Totalt så langt",
  totalEarned: "Totalt opptjent",
  // Timebank
  availableForToil: "Tilgjengelig for avspasering",
  recentMovements: "Siste bevegelser",
  hours: "timer",
  // Empty states
  noPayData: "Ingen lønnsdata ennå",
  noPayslips: "Ingen lønnsslipp tilgjengelig ennå. Din første lønnsslipp vises her etter første lønnskjøring.",
  noQuotas: "Ingen fraværskvoter er satt opp ennå. Kontakt din leder.",
  noTimebank: "Ingen timer i timebanken ennå.",
},
```

- [ ] **Step 3: Verify types compile**

Run: `cd apps/mobile && npx tsc --noEmit src/constants/strings.ts`
Expected: no errors

- [ ] **Step 4: Commit**

```bash
git add apps/mobile/src/constants/strings.ts
git commit -m "feat(mobile): add Norwegian payroll strings"
```

---

## Task 2: Supplement Engine (Pure Function + Tests)

**Files:**

- Create: `apps/mobile/src/lib/supplements.ts`
- Create: `apps/mobile/src/lib/__tests__/supplements.test.ts`

This is the most logic-heavy pure function. It implements the stacking and precedence rules from the spec. TDD — tests first.

- [ ] **Step 1: Write the test file**

Create `apps/mobile/src/lib/__tests__/supplements.test.ts` with these test groups:

```typescript
/**
 * Tests for getShiftSupplements() — determines which wage supplements
 * apply to a given shift based on workspace rules.
 *
 * Stacking rules (from spec):
 * - Kveld + Helg: stack (additive)
 * - Kveld + Helligdag: stack (additive)
 * - Helg + Helligdag: helligdag wins (highest rate)
 * - Kveld + Helg + Helligdag: kveld + helligdag (helligdag replaces helg)
 */
import { getShiftSupplements, type SupplementInput, type SupplementRule } from "../supplements";

// --- Test helpers ---

function makeRule(overrides: Partial<SupplementRule> = {}): SupplementRule {
  return {
    id: "rule-1",
    name: "Test Rule",
    supplementType: "evening",
    startTime: "21:00:00",
    endTime: "06:00:00",
    rate: 15.65,
    rateType: "fixed_per_hour",
    isActive: true,
    appliesToWeekdays: [1, 2, 3, 4, 5], // Mon-Fri
    appliesToWeekends: false,
    ...overrides,
  };
}

const KVELD_RULE = makeRule({
  id: "kveld",
  name: "Kveldstillegg",
  supplementType: "evening",
  startTime: "21:00:00",
  endTime: "06:00:00",
  rate: 15.65,
});

const HELG_RULE = makeRule({
  id: "helg",
  name: "Helgetillegg",
  supplementType: "weekend",
  startTime: "00:00:00",
  endTime: "23:59:59",
  rate: 29.74,
  appliesToWeekdays: [],
  appliesToWeekends: true,
});

const HELLIGDAG_RULE = makeRule({
  id: "helligdag",
  name: "Helligdagstillegg",
  supplementType: "holiday",
  startTime: "00:00:00",
  endTime: "23:59:59",
  rate: 100, // percentage
  rateType: "percentage",
});

const ALL_RULES = [KVELD_RULE, HELG_RULE, HELLIGDAG_RULE];

// --- Tests ---

describe("getShiftSupplements", () => {
  describe("basic supplement detection", () => {
    it("returns empty array for daytime weekday shift", () => {
      const result = getShiftSupplements({
        shiftDate: "2026-03-23", // Monday
        startTime: "08:00:00",
        endTime: "16:00:00",
        breakMinutes: 30,
        rules: ALL_RULES,
        holidays: [],
      });
      expect(result).toEqual([]);
    });

    it("detects kveldstillegg for evening shift", () => {
      const result = getShiftSupplements({
        shiftDate: "2026-03-23", // Monday
        startTime: "16:00:00",
        endTime: "23:00:00",
        breakMinutes: 0,
        rules: ALL_RULES,
        holidays: [],
      });
      expect(result).toHaveLength(1);
      expect(result[0].type).toBe("kveld");
      expect(result[0].hours).toBe(2); // 21:00-23:00
    });

    it("detects helgetillegg for Saturday shift", () => {
      const result = getShiftSupplements({
        shiftDate: "2026-03-28", // Saturday
        startTime: "10:00:00",
        endTime: "18:00:00",
        breakMinutes: 30,
        rules: ALL_RULES,
        holidays: [],
      });
      expect(result.some((s) => s.type === "helg")).toBe(true);
    });

    it("detects helligdagstillegg on public holiday", () => {
      const result = getShiftSupplements({
        shiftDate: "2026-05-01", // Friday, Labour Day
        startTime: "10:00:00",
        endTime: "18:00:00",
        breakMinutes: 0,
        rules: ALL_RULES,
        holidays: ["2026-05-01"],
      });
      expect(result.some((s) => s.type === "helligdag")).toBe(true);
    });
  });

  describe("stacking rules", () => {
    it("kveld + helg stack (Saturday evening)", () => {
      const result = getShiftSupplements({
        shiftDate: "2026-03-28", // Saturday
        startTime: "16:00:00",
        endTime: "23:00:00",
        breakMinutes: 0,
        rules: ALL_RULES,
        holidays: [],
      });
      const types = result.map((s) => s.type);
      expect(types).toContain("kveld");
      expect(types).toContain("helg");
    });

    it("helg + helligdag: helligdag wins, helg excluded", () => {
      // Sunday that is also a public holiday
      const result = getShiftSupplements({
        shiftDate: "2026-05-17", // Sunday, National Day
        startTime: "10:00:00",
        endTime: "18:00:00",
        breakMinutes: 0,
        rules: ALL_RULES,
        holidays: ["2026-05-17"],
      });
      const types = result.map((s) => s.type);
      expect(types).toContain("helligdag");
      expect(types).not.toContain("helg");
    });

    it("kveld + helligdag stack", () => {
      const result = getShiftSupplements({
        shiftDate: "2026-12-25", // Friday, Christmas Day
        startTime: "16:00:00",
        endTime: "23:00:00",
        breakMinutes: 0,
        rules: ALL_RULES,
        holidays: ["2026-12-25"],
      });
      const types = result.map((s) => s.type);
      expect(types).toContain("kveld");
      expect(types).toContain("helligdag");
    });
  });

  describe("cross-midnight shifts", () => {
    it("splits at 00:00 and evaluates each segment", () => {
      // Friday 22:00 to Saturday 06:00
      const result = getShiftSupplements({
        shiftDate: "2026-03-27", // Friday
        startTime: "22:00:00",
        endTime: "06:00:00",
        breakMinutes: 0,
        rules: ALL_RULES,
        holidays: [],
      });
      // Friday segment (22:00-00:00): kveld (2h)
      // Saturday segment (00:00-06:00): helg (6h) + kveld (6h)
      expect(result.some((s) => s.type === "kveld")).toBe(true);
      expect(result.some((s) => s.type === "helg")).toBe(true);
    });
  });

  describe("break exclusion", () => {
    it("excludes break time from qualifying hours", () => {
      const withBreak = getShiftSupplements({
        shiftDate: "2026-03-23", // Monday
        startTime: "16:00:00",
        endTime: "23:00:00",
        breakMinutes: 30,
        rules: ALL_RULES,
        holidays: [],
      });
      const withoutBreak = getShiftSupplements({
        shiftDate: "2026-03-23",
        startTime: "16:00:00",
        endTime: "23:00:00",
        breakMinutes: 0,
        rules: ALL_RULES,
        holidays: [],
      });
      // kveld hours should be reduced by break proportion
      const kveldWithBreak = withBreak.find((s) => s.type === "kveld");
      const kveldWithoutBreak = withoutBreak.find((s) => s.type === "kveld");
      expect(kveldWithBreak!.hours).toBeLessThan(kveldWithoutBreak!.hours);
    });
  });

  describe("edge cases", () => {
    it("returns empty for inactive rules", () => {
      const inactiveRules = ALL_RULES.map((r) => ({ ...r, isActive: false }));
      const result = getShiftSupplements({
        shiftDate: "2026-03-28", // Saturday evening
        startTime: "16:00:00",
        endTime: "23:00:00",
        breakMinutes: 0,
        rules: inactiveRules,
        holidays: [],
      });
      expect(result).toEqual([]);
    });

    it("returns empty when rules array is empty", () => {
      const result = getShiftSupplements({
        shiftDate: "2026-03-28",
        startTime: "16:00:00",
        endTime: "23:00:00",
        breakMinutes: 0,
        rules: [],
        holidays: [],
      });
      expect(result).toEqual([]);
    });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd apps/mobile && npx jest src/lib/__tests__/supplements.test.ts --no-coverage`
Expected: FAIL — `Cannot find module '../supplements'`

- [ ] **Step 3: Implement `supplements.ts`**

Create `apps/mobile/src/lib/supplements.ts`. Key implementation requirements:

- Export types: `SupplementRule`, `SupplementInput`, `ShiftSupplement`
- `SupplementRule` must have: `id`, `name`, `supplementType` (`"evening" | "weekend" | "holiday"`), `startTime`, `endTime`, `rate`, `rateType` (`"fixed_per_hour" | "percentage"`), `isActive`, `appliesToWeekdays` (number[]), `appliesToWeekends` (boolean)
- Main function: `getShiftSupplements(input: SupplementInput): ShiftSupplement[]`
- Helper: `getDayOfWeek(dateStr: string): number` — 0=Sun, 1=Mon... (UTC)
- Helper: `isWeekend(dayOfWeek: number): boolean` — 0 or 6
- Helper: `splitCrossMidnight(shiftDate, startTime, endTime)` — returns segments
- For each segment: check rules for kveld, helg, helligdag
- Apply stacking precedence: if helligdag applies, remove helg
- Subtract break proportionally from qualifying hours
- Return array of `{ type, label, hours }`

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd apps/mobile && npx jest src/lib/__tests__/supplements.test.ts --no-coverage`
Expected: all tests PASS

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/src/lib/supplements.ts apps/mobile/src/lib/__tests__/supplements.test.ts
git commit -m "feat(mobile): add supplement engine with stacking rules and tests"
```

---

## Task 3: Absence Projection (Pure Function + Tests)

**Files:**

- Create: `apps/mobile/src/lib/absence-projection.ts`
- Create: `apps/mobile/src/lib/__tests__/absence-projection.test.ts`

- [ ] **Step 1: Write the test file**

Create `apps/mobile/src/lib/__tests__/absence-projection.test.ts`:

```typescript
/**
 * Tests for projectAbsenceBalance() — computes how many days a request
 * would consume and whether it's allowed.
 */
import { projectAbsenceBalance, type ProjectionInput } from "../absence-projection";

function makeInput(overrides: Partial<ProjectionInput> = {}): ProjectionInput {
  return {
    currentBalance: 25,
    startDate: "2026-04-14",
    endDate: "2026-04-18",
    absenceType: {
      category: "vacation",
      countWeekends: false,
      maxDaysPerInstance: null,
      maxInstancesPerYear: null,
      currentYearInstances: 0,
    },
    holidays: [],
    existingRequests: [],
    ...overrides,
  };
}

describe("projectAbsenceBalance", () => {
  describe("basic workday counting", () => {
    it("counts weekdays only (Mon-Fri)", () => {
      // Mon 14 - Fri 18 April = 5 weekdays
      const result = projectAbsenceBalance(makeInput());
      expect(result.requestedDays).toBe(5);
      expect(result.balanceAfter).toBe(20);
      expect(result.isAllowed).toBe(true);
    });

    it("excludes weekends from count", () => {
      // Fri 10 - Mon 13 April = 2 weekdays (Fri + Mon)
      const result = projectAbsenceBalance(
        makeInput({
          startDate: "2026-04-10",
          endDate: "2026-04-13",
        }),
      );
      expect(result.requestedDays).toBe(2);
    });

    it("counts weekends when absenceType.countWeekends is true", () => {
      const result = projectAbsenceBalance(
        makeInput({
          startDate: "2026-04-10",
          endDate: "2026-04-13",
          absenceType: {
            category: "vacation",
            countWeekends: true,
            maxDaysPerInstance: null,
            maxInstancesPerYear: null,
            currentYearInstances: 0,
          },
        }),
      );
      expect(result.requestedDays).toBe(4); // Fri, Sat, Sun, Mon
    });
  });

  describe("holiday exclusion", () => {
    it("excludes public holidays from vacation count", () => {
      // Mon-Fri includes May 1 (Labour Day)
      const result = projectAbsenceBalance(
        makeInput({
          startDate: "2026-04-27",
          endDate: "2026-05-01",
          holidays: ["2026-05-01"],
        }),
      );
      expect(result.requestedDays).toBe(4); // Mon-Thu, Fri is holiday
    });
  });

  describe("balance validation", () => {
    it("returns isAllowed=false when insufficient balance", () => {
      const result = projectAbsenceBalance(
        makeInput({
          currentBalance: 3,
        }),
      );
      expect(result.isAllowed).toBe(false);
      expect(result.balanceAfter).toBe(-2);
      expect(result.warnings).toContain("Ikke nok dager tilgjengelig");
    });
  });

  describe("overlap detection", () => {
    it("warns about overlapping pending/approved requests", () => {
      const result = projectAbsenceBalance(
        makeInput({
          existingRequests: [
            { startDate: "2026-04-16", endDate: "2026-04-17", status: "approved" },
          ],
        }),
      );
      expect(result.warnings.some((w) => w.includes("Overlapper"))).toBe(true);
    });

    it("ignores cancelled/rejected requests", () => {
      const result = projectAbsenceBalance(
        makeInput({
          existingRequests: [
            { startDate: "2026-04-16", endDate: "2026-04-17", status: "cancelled" },
          ],
        }),
      );
      expect(result.warnings).toHaveLength(0);
    });
  });

  describe("instance limits (egenmelding)", () => {
    it("warns when max instances per year exceeded", () => {
      const result = projectAbsenceBalance(
        makeInput({
          absenceType: {
            category: "sick_self",
            countWeekends: false,
            maxDaysPerInstance: 3,
            maxInstancesPerYear: 4,
            currentYearInstances: 4, // already at limit
          },
        }),
      );
      expect(result.isAllowed).toBe(false);
    });

    it("warns when request exceeds max days per instance", () => {
      const result = projectAbsenceBalance(
        makeInput({
          startDate: "2026-04-13",
          endDate: "2026-04-17", // 5 weekdays
          absenceType: {
            category: "sick_self",
            countWeekends: false,
            maxDaysPerInstance: 3,
            maxInstancesPerYear: 4,
            currentYearInstances: 0,
          },
        }),
      );
      expect(result.isAllowed).toBe(false);
    });
  });

  describe("cross-year requests", () => {
    it("handles requests spanning Dec-Jan", () => {
      const result = projectAbsenceBalance(
        makeInput({
          startDate: "2026-12-29",
          endDate: "2027-01-02",
          currentBalance: 10,
          holidays: ["2027-01-01"],
        }),
      );
      // Dec 29 (Tue), 30 (Wed), 31 (Thu) = 3 days in 2026
      // Jan 2 (Fri) = 1 day in 2027 (Jan 1 is holiday)
      expect(result.requestedDays).toBe(4);
    });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd apps/mobile && npx jest src/lib/__tests__/absence-projection.test.ts --no-coverage`
Expected: FAIL — `Cannot find module '../absence-projection'`

- [ ] **Step 3: Implement `absence-projection.ts`**

Create `apps/mobile/src/lib/absence-projection.ts`. Key requirements:

- Export types: `ProjectionInput`, `ProjectionResult`, `AbsenceTypeConfig`
- `AbsenceTypeConfig`: `{ category, countWeekends, maxDaysPerInstance, maxInstancesPerYear, currentYearInstances }`
- Main function: `projectAbsenceBalance(input: ProjectionInput): ProjectionResult`
- Helper: `countDaysInRange(start, end, countWeekends, holidays)` — iterate each day, check weekday/weekend + holiday
- Helper: `hasOverlap(start, end, existingRequests)` — check date range intersection
- Returns: `{ requestedDays, balanceAfter, isAllowed, warnings }`

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd apps/mobile && npx jest src/lib/__tests__/absence-projection.test.ts --no-coverage`
Expected: all tests PASS

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/src/lib/absence-projection.ts apps/mobile/src/lib/__tests__/absence-projection.test.ts
git commit -m "feat(mobile): add absence projection with holiday/overlap/instance checks"
```

---

## Task 4: Earnings Calculator (Pure Function + Tests)

**Files:**

- Create: `apps/mobile/src/lib/payroll-calc.ts`
- Create: `apps/mobile/src/lib/__tests__/payroll-calc.test.ts`

- [ ] **Step 1: Write the test file**

Create `apps/mobile/src/lib/__tests__/payroll-calc.test.ts`:

```typescript
/**
 * Tests for calculateShiftEarnings() — estimates earnings for a shift
 * based on hourly rate + applicable supplements.
 *
 * This produces ESTIMATES only (trust tier: "Foreløpig estimat").
 */
import { calculateShiftEarnings, type EarningsInput } from "../payroll-calc";

function makeInput(overrides: Partial<EarningsInput> = {}): EarningsInput {
  return {
    hourlyRate: 200,
    workedMinutes: 420, // 7 hours
    supplements: [],
    ...overrides,
  };
}

describe("calculateShiftEarnings", () => {
  it("calculates base pay from hourly rate × hours", () => {
    const result = calculateShiftEarnings(makeInput());
    expect(result.basePay).toBe(1400); // 200 × 7
  });

  it("adds fixed-per-hour supplement amounts", () => {
    const result = calculateShiftEarnings(
      makeInput({
        supplements: [{ type: "kveld", hours: 2, rate: 15.65, rateType: "fixed_per_hour" }],
      }),
    );
    expect(result.supplementPay).toBeCloseTo(31.3);
    expect(result.total).toBeCloseTo(1431.3);
  });

  it("adds percentage supplement amounts", () => {
    const result = calculateShiftEarnings(
      makeInput({
        supplements: [{ type: "helligdag", hours: 7, rate: 100, rateType: "percentage" }],
      }),
    );
    // 100% of base hourly rate × 7 hours = 200 × 7 = 1400
    expect(result.supplementPay).toBe(1400);
    expect(result.total).toBe(2800);
  });

  it("returns zero for zero worked minutes", () => {
    const result = calculateShiftEarnings(makeInput({ workedMinutes: 0 }));
    expect(result.basePay).toBe(0);
    expect(result.total).toBe(0);
  });

  it("handles partial hours correctly", () => {
    const result = calculateShiftEarnings(makeInput({ workedMinutes: 90 }));
    expect(result.basePay).toBe(300); // 200 × 1.5
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd apps/mobile && npx jest src/lib/__tests__/payroll-calc.test.ts --no-coverage`
Expected: FAIL

- [ ] **Step 3: Implement `payroll-calc.ts`**

Create `apps/mobile/src/lib/payroll-calc.ts`:

- Export types: `EarningsInput`, `EarningsResult`, `SupplementEarning`
- `EarningsInput`: `{ hourlyRate, workedMinutes, supplements: { type, hours, rate, rateType }[] }`
- `EarningsResult`: `{ basePay, supplementPay, total, supplementDetails: { type, amount }[] }`
- Main function: `calculateShiftEarnings(input: EarningsInput): EarningsResult`

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd apps/mobile && npx jest src/lib/__tests__/payroll-calc.test.ts --no-coverage`
Expected: all tests PASS

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/src/lib/payroll-calc.ts apps/mobile/src/lib/__tests__/payroll-calc.test.ts
git commit -m "feat(mobile): add earnings calculator with supplement support"
```

---

## Task 4b: Trust Labels (Pure Function + Tests)

**Files:**

- Create: `apps/mobile/src/lib/trust-labels.ts`
- Create: `apps/mobile/src/lib/__tests__/trust-labels.test.ts`

Every monetary figure in the UI must be tagged with a trust tier. This function is the canonical source.

- [ ] **Step 1: Write the test file**

Create `apps/mobile/src/lib/__tests__/trust-labels.test.ts`:

```typescript
/**
 * Tests for getTrustLabel() — determines how confidently a monetary figure
 * should be presented to the employee.
 *
 * Three tiers:
 * - estimate: client-side calc, may differ from payroll ("~kr 31")
 * - recorded: from time_entry, not yet processed ("kr 1 443")
 * - settled: from closed payroll period ("kr 21 146")
 */
import { getTrustLabel, type TrustTier, type TrustLabelResult } from "../trust-labels";

describe("getTrustLabel", () => {
  it("returns estimate for before_shift phase", () => {
    const result = getTrustLabel({ phase: "before_shift", dataSource: "calculated" });
    expect(result.tier).toBe("estimate");
    expect(result.prefix).toBe("~");
    expect(result.showDisclaimer).toBe(true);
  });

  it("returns estimate for during_shift phase", () => {
    const result = getTrustLabel({ phase: "during_shift", dataSource: "calculated" });
    expect(result.tier).toBe("estimate");
    expect(result.prefix).toBe("~");
  });

  it("returns recorded for after_shift with time_entry data", () => {
    const result = getTrustLabel({ phase: "after_shift", dataSource: "time_entry" });
    expect(result.tier).toBe("recorded");
    expect(result.prefix).toBe("");
    expect(result.showDisclaimer).toBe(false);
  });

  it("returns settled for payslip data from closed period", () => {
    const result = getTrustLabel({ phase: "no_shift", dataSource: "payroll_period" });
    expect(result.tier).toBe("settled");
    expect(result.prefix).toBe("");
    expect(result.showDisclaimer).toBe(false);
  });

  it("returns settled for absence_quota (generated column = canonical)", () => {
    const result = getTrustLabel({ phase: "no_shift", dataSource: "absence_quota" });
    expect(result.tier).toBe("settled");
  });

  it("returns the correct Norwegian labels", () => {
    const estimate = getTrustLabel({ phase: "before_shift", dataSource: "calculated" });
    expect(estimate.label).toBe("Foreløpig estimat");

    const recorded = getTrustLabel({ phase: "after_shift", dataSource: "time_entry" });
    expect(recorded.label).toBe("Registrert tid");

    const settled = getTrustLabel({ phase: "no_shift", dataSource: "payroll_period" });
    expect(settled.label).toBe("Avregnet i lønn");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd apps/mobile && npx jest src/lib/__tests__/trust-labels.test.ts --no-coverage`
Expected: FAIL — `Cannot find module '../trust-labels'`

- [ ] **Step 3: Implement `trust-labels.ts`**

Create `apps/mobile/src/lib/trust-labels.ts`:

```typescript
/**
 * Trust tier labeling for payroll figures.
 *
 * Every monetary figure shown to an employee carries an implicit promise.
 * This function determines the epistemic status of each figure.
 */

export type TrustTier = "estimate" | "recorded" | "settled";
export type DataSource =
  | "calculated"
  | "time_entry"
  | "payroll_period"
  | "absence_quota"
  | "timebank_entry";
export type ShiftPhase = "no_shift" | "before_shift" | "during_shift" | "after_shift";

export type TrustLabelInput = {
  phase: ShiftPhase;
  dataSource: DataSource;
};

export type TrustLabelResult = {
  tier: TrustTier;
  label: string; // Norwegian display label
  prefix: string; // "~" for estimates, "" otherwise
  showDisclaimer: boolean;
};

const LABELS: Record<TrustTier, string> = {
  estimate: "Foreløpig estimat",
  recorded: "Registrert tid",
  settled: "Avregnet i lønn",
};

export function getTrustLabel(input: TrustLabelInput): TrustLabelResult {
  const tier = resolveTier(input);
  return {
    tier,
    label: LABELS[tier],
    prefix: tier === "estimate" ? "~" : "",
    showDisclaimer: tier === "estimate",
  };
}

function resolveTier({ phase, dataSource }: TrustLabelInput): TrustTier {
  // Settled sources are always settled regardless of phase
  if (dataSource === "payroll_period" || dataSource === "absence_quota") return "settled";

  // Timebank entries are settled (append-only ledger)
  if (dataSource === "timebank_entry") return "settled";

  // Time entry data (actual punched hours) = recorded
  if (dataSource === "time_entry") return "recorded";

  // Calculated figures depend on phase
  if (dataSource === "calculated") {
    if (phase === "before_shift" || phase === "during_shift") return "estimate";
    if (phase === "after_shift") return "recorded"; // calc from time_entry
    return "estimate";
  }

  return "estimate";
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd apps/mobile && npx jest src/lib/__tests__/trust-labels.test.ts --no-coverage`
Expected: all tests PASS

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/src/lib/trust-labels.ts apps/mobile/src/lib/__tests__/trust-labels.test.ts
git commit -m "feat(mobile): add trust tier labeling for payroll figures"
```

---

## Task 5: Query Hooks (Data Layer)

**Files:**

- Create: `apps/mobile/src/hooks/queries/use-payroll-summary.ts`
- Create: `apps/mobile/src/hooks/queries/use-absence-balance.ts`
- Create: `apps/mobile/src/hooks/queries/use-timebank-balance.ts`
- Create: `apps/mobile/src/hooks/queries/use-supplement-rules.ts`
- Create: `apps/mobile/src/hooks/queries/use-payslips.ts`
- Create: `apps/mobile/src/hooks/queries/use-my-absence-requests.ts`

All hooks follow the pattern in `apps/mobile/src/hooks/queries/use-my-shifts.ts`:

- Import `useQuery` from `@tanstack/react-query`
- Import `supabase` from `@/lib/supabase`
- Auth check: `supabase.auth.getUser()` → get profile
- Cross-schema payroll queries: `supabase.schema("payroll").from("table_name")`
- Return typed query result

- [ ] **Step 1: Create `use-supplement-rules.ts`**

Queries `payroll.supplement_rule` + `payroll.holiday_entry`. Cached with `staleTime: Infinity`.

```typescript
// Key patterns:
// supabase.schema("payroll").from("supplement_rule").select("*").eq("workspace_id", workspaceId)
// supabase.schema("payroll").from("holiday_entry").select("holiday_date").gte("holiday_date", startOfYear)
// staleTime: Infinity
// Returns: { rules: SupplementRule[], holidays: string[], isLoading }
```

- [ ] **Step 2: Create `use-absence-balance.ts`**

Queries `payroll.absence_quota` + `payroll.absence_ledger` for current profile + year.

```typescript
// Key patterns:
// supabase.schema("payroll").from("absence_quota").select("*").eq("profile_id", profileId).eq("year", currentYear)
// supabase.schema("payroll").from("absence_ledger").select("*").eq("profile_id", profileId).order("effective_date", { ascending: false }).limit(20)
// staleTime: 5 minutes
```

- [ ] **Step 3: Create `use-timebank-balance.ts`**

Queries `payroll.timebank_entry`. Computes balance client-side (tech debt — noted in spec).

```typescript
// Key patterns:
// supabase.schema("payroll").from("timebank_entry").select("*").eq("profile_id", profileId).order("effective_date", { ascending: false })
// Client-side: sum accrual/carry_over/adjustment minus withdrawal/expiry/payout
// Returns: { balance: number, entries: TimebankEntry[], isLoading }
```

- [ ] **Step 4: Create `use-payslips.ts`**

Queries `payroll.period` + `payroll.calculation` + `payroll.calculation_line`.

```typescript
// Key patterns:
// supabase.schema("payroll").from("period").select("*").eq("workspace_id", wsId).in("status", ["closed", "exported"]).order("period_start", { ascending: false })
// supabase.schema("payroll").from("calculation").select("*").eq("profile_id", profileId).eq("period_id", periodId)
// supabase.schema("payroll").from("calculation_line").select("*").eq("calculation_id", calcId).order("sort_order")
// Returns: { periods, currentCalculation, lines, isLoading }
```

- [ ] **Step 5: Create `use-my-absence-requests.ts`**

Queries `schedule_absence` (public schema) for current profile.

```typescript
// Key patterns:
// supabase.from("schedule_absence").select("*").eq("employee_id", profileId).order("start_date", { ascending: false }).limit(20)
// Returns: { requests: ScheduleAbsence[], isLoading }
```

- [ ] **Step 6: Create `use-payroll-summary.ts`**

Aggregated hook for home card. Makes direct Supabase queries (does NOT call other hooks — avoids hook composition issues). Uses `useQuery` with a single `queryFn` that runs `Promise.all` internally.

```typescript
// Pattern: single useQuery with composite queryFn
// queryKey: ["payroll-summary", profileId]
// staleTime: 5 * 60 * 1000 (5 minutes)
//
// queryFn runs Promise.all([
//   supabase.schema("payroll").from("absence_quota").select("*").eq("profile_id", pid).eq("year", currentYear),
//   supabase.schema("payroll").from("timebank_entry").select("hours, entry_type").eq("profile_id", pid),
//   supabase.schema("payroll").from("period").select("*, calculation(*)").eq("workspace_id", wsId).eq("status", "exported").order("period_end", { ascending: false }).limit(1),
//   supabase.schema("payroll").from("supplement_rule").select("*").eq("workspace_id", wsId),
//   supabase.schema("payroll").from("holiday_entry").select("holiday_date").gte("holiday_date", startOfYear),
// ])
//
// Timebank balance computed client-side from entries (tech debt — noted in spec)
//
// Returns typed PayrollSummary:
// {
//   absenceBalances: { category, remaining, total }[] | null,
//   timebankHours: number | null,
//   lastSettledPay: { amount, periodName, paymentDate } | null,
//   supplementRules: SupplementRule[],
//   holidays: string[],
//   hourlyRate: number | null,
// }
```

- [ ] **Step 7: Verify typecheck**

Run: `cd apps/mobile && npx tsc --noEmit`
Expected: no type errors in new hook files

- [ ] **Step 8: Commit**

```bash
git add apps/mobile/src/hooks/queries/use-*.ts
git commit -m "feat(mobile): add payroll query hooks (summary, absence, timebank, payslips, supplements)"
```

---

## Task 6: Mutation Hooks

**Files:**

- Create: `apps/mobile/src/hooks/mutations/use-request-absence.ts`
- Create: `apps/mobile/src/hooks/mutations/use-cancel-absence.ts`

Follow pattern from `apps/mobile/src/hooks/mutations/use-punch.ts`:

- Use `enqueue()` from `@/lib/sync/queue` for offline-first
- Optimistically update TanStack Query cache
- Import `useQueryClient` for cache invalidation

- [ ] **Step 1: Create `use-request-absence.ts`**

Follow offline-first pattern from `apps/mobile/src/hooks/mutations/use-punch.ts`:

```typescript
// Uses enqueue() from @/lib/sync/queue for offline-first (same as use-punch.ts)
// Uses useQueryClient for optimistic cache updates
//
// Flow:
// 1. getProfileContext() — same helper as use-punch.ts
// 2. Build payload: { schedule_absence fields, status: "pending" }
// 3. enqueue("request_absence", payload)
// 4. Optimistically add to ["my-absence-requests"] cache
// 5. Invalidate ["absence-balance"] query
//
// MANDATORY: emit() call after successful enqueue
// import { emit } from "@smartout/telemetry"
// emit("absence.request_submitted", { absence_type, start_date, end_date, days })
```

- [ ] **Step 2: Create `use-cancel-absence.ts`**

```typescript
// Same offline-first pattern with enqueue()
//
// Flow:
// 1. enqueue("cancel_absence", { schedule_absence_id, status: "cancelled" })
// 2. Optimistically update status in ["my-absence-requests"] cache
// 3. Invalidate ["absence-balance"] query
//
// Guard: only works when current status = "pending"
//
// MANDATORY: emit() call
// emit("absence.request_cancelled", { schedule_absence_id })
```

**Note:** The `request_absence` and `cancel_absence` action types must be added to `apps/mobile/src/lib/sync/action-map.ts` for the sync worker to know how to process them.

- [ ] **Step 3: Commit**

```bash
git add apps/mobile/src/hooks/mutations/use-request-absence.ts apps/mobile/src/hooks/mutations/use-cancel-absence.ts
git commit -m "feat(mobile): add absence request and cancel mutation hooks"
```

---

## Task 7: SupplementBadges Component

**Files:**

- Create: `apps/mobile/src/components/payroll/SupplementBadges.tsx`
- Modify: `apps/mobile/src/components/shift/ShiftCard.tsx`

- [ ] **Step 1: Create `SupplementBadges.tsx`**

Small presentational component. Takes `ShiftSupplement[]` and renders color-coded badges.

```typescript
// Props: { supplements: ShiftSupplement[] }
// Renders horizontal View with gap, each badge is a View with:
//   - kveld: purple bg rgba(139,92,246,0.15), text #a78bfa
//   - helg: orange bg rgba(249,115,22,0.15), text #fb923c
//   - helligdag: red bg rgba(239,68,68,0.15), text #f87171
// Returns null if supplements is empty
// Uses createStyles pattern
```

- [ ] **Step 2: Integrate into ShiftCard**

Read `apps/mobile/src/components/shift/ShiftCard.tsx` first.

Add below the `details` row (before `confirmRow`):

- Import `SupplementBadges` and `getShiftSupplements`
- Import `useSupplementRules` hook
- Call `getShiftSupplements()` with shift data + rules
- Render `<SupplementBadges supplements={supplements} />` if non-empty

- [ ] **Step 3: Verify no type errors**

Run: `cd apps/mobile && npx tsc --noEmit`

- [ ] **Step 4: Commit**

```bash
git add apps/mobile/src/components/payroll/SupplementBadges.tsx apps/mobile/src/components/shift/ShiftCard.tsx
git commit -m "feat(mobile): add supplement badges to shift cards"
```

---

## Task 8: PayrollHomeCard Component

**Files:**

- Create: `apps/mobile/src/components/payroll/PayrollHomeCard.tsx`

The most complex UI component — 4 phase modes with different content.

- [ ] **Step 1: Create `PayrollHomeCard.tsx`**

```typescript
// Props:
type PayrollHomeCardProps = {
  phase: "no_shift" | "before_shift" | "during_shift" | "after_shift";
  shift: ScheduleShift | null;
  timeEntry: TimeEntry | null;
  summary: PayrollSummary | null; // from usePayrollSummary hook
};
// PayrollSummary contains: absenceBalances, timebankHours, lastSettledPay,
// supplementRules, holidays, hourlyRate (see use-payroll-summary.ts)

// Uses: createStyles, expo-haptics, expo-router, strings.payroll
// Imports: getTrustLabel from "@/lib/trust-labels"
// Imports: getShiftSupplements from "@/lib/supplements"
// Imports: calculateShiftEarnings from "@/lib/payroll-calc"
// Imports: SupplementBadges from "@/components/payroll/SupplementBadges"
//
// TRUST LABELS — every monetary figure calls getTrustLabel():
//
// no_shift:
//   - absenceBalances → getTrustLabel({ phase, dataSource: "absence_quota" }) → settled
//   - timebankHours → getTrustLabel({ phase, dataSource: "timebank_entry" }) → settled
//   - lastSettledPay → getTrustLabel({ phase, dataSource: "payroll_period" }) → settled
//   - "Se alt >" pressable → router.push("/(app)/(me)/payslip")
//
// before_shift:
//   - supplements from getShiftSupplements(shift, rules, holidays)
//   - estimated amount → getTrustLabel({ phase, dataSource: "calculated" }) → estimate
//   - Shows "~kr XX" with muted color + disclaimer caption
//
// during_shift:
//   - Live timer: useEffect + 60s setInterval
//   - Running total from calculateShiftEarnings({ hourlyRate, workedMinutes, supplements })
//   - getTrustLabel({ phase, dataSource: "calculated" }) → estimate
//   - Pulsing dot (Animated.View with opacity loop)
//   - Shows "~kr XX" with disclaimer
//
// after_shift:
//   - Earned from actual time_entry (punch_in → punch_out)
//   - getTrustLabel({ phase: "after_shift", dataSource: "time_entry" }) → recorded
//   - Shows "kr XX" (no ~ prefix, no disclaimer)
//
// Empty state: summary === null → "Ingen lønnsdata ennå" with link to Meg
//
// Card style: gradient top border per phase (spec colors)
// Animation: FadeInUp from react-native-reanimated (matches NoShiftView)
```

- [ ] **Step 2: Verify typecheck**

Run: `cd apps/mobile && npx tsc --noEmit`

- [ ] **Step 3: Commit**

```bash
git add apps/mobile/src/components/payroll/PayrollHomeCard.tsx
git commit -m "feat(mobile): add adaptive PayrollHomeCard with 4 phase modes"
```

---

## Task 9: Integrate PayrollHomeCard into Home Views

**Files:**

- Modify: `apps/mobile/src/components/home/NoShiftView.tsx`
- Modify: `apps/mobile/src/components/home/BeforeShiftView.tsx`
- Modify: `apps/mobile/src/components/home/DuringShiftView.tsx`
- Modify: `apps/mobile/src/components/home/AfterShiftView.tsx`

- [ ] **Step 1: Read all 4 home view files**

Read each file to understand their current layout and props.

- [ ] **Step 2: Add PayrollHomeCard to NoShiftView**

After the next shift card (or empty state), add:

```tsx
<PayrollHomeCard phase="no_shift" shift={nextShift} timeEntry={null} {...payrollSummaryProps} />
```

The `payrollSummaryProps` come from `usePayrollSummary()` called in the parent or passed down.

- [ ] **Step 3: Add PayrollHomeCard to BeforeShiftView**

After the `ShiftCardRich` and confirm action, add the card with `phase="before_shift"`.

- [ ] **Step 4: Add PayrollHomeCard to DuringShiftView**

After the punch-out button, add the card with `phase="during_shift"`.

- [ ] **Step 5: Add PayrollHomeCard to AfterShiftView**

After the hours confirmation section, add the card with `phase="after_shift"`.

- [ ] **Step 6: Verify typecheck**

Run: `cd apps/mobile && npx tsc --noEmit`

- [ ] **Step 7: Commit**

```bash
git add apps/mobile/src/components/home/NoShiftView.tsx apps/mobile/src/components/home/BeforeShiftView.tsx apps/mobile/src/components/home/DuringShiftView.tsx apps/mobile/src/components/home/AfterShiftView.tsx
git commit -m "feat(mobile): integrate PayrollHomeCard into all 4 home phase views"
```

---

## Task 10: Detail Screens (AbsenceBalance, Timebank, Payslip)

**Files:**

- Create: `apps/mobile/src/components/payroll/AbsenceBalanceScreen.tsx`
- Create: `apps/mobile/src/components/payroll/TimebankScreen.tsx`
- Create: `apps/mobile/src/components/payroll/PayslipScreen.tsx`

These are read-only detail screens accessible from Meg tab.

- [ ] **Step 1: Create `AbsenceBalanceScreen.tsx`**

```typescript
// Uses useAbsenceBalance(profileId)
// Top: balance rows per absence type (from absence_quota.remaining_days)
//   - Green when > 20% remaining, amber < 20%, red = 0
//   - Format: "Ferie — 18 av 25 dager"
// Bottom: "Siste bevegelser" section with ledger entries
//   - Each: description, effective_date, +/- days (green/red)
// Empty state: strings.payroll.noQuotas
// Loading: skeleton placeholders
// Nav bar: "< Meg" back + "Fraværssaldo" title
// All text from strings.payroll
```

- [ ] **Step 2: Create `TimebankScreen.tsx`**

```typescript
// Uses useTimebankBalance(profileId)
// Top: blue balance banner (big number + "Tilgjengelig for avspasering")
// Bottom: ledger entries (accrual=green, withdrawal=red, carry_over=green)
// Empty state: strings.payroll.noTimebank
// "Sist oppdatert" timestamp at bottom
```

- [ ] **Step 3: Create `PayslipScreen.tsx`**

```typescript
// Uses usePayslips(profileId)
// Top: net pay hero (big "kr XX XXX" + "Utbetalt" + payment date badge)
//   - PDF button ONLY shown when document URL exists
// Vacation strip: "Feriedager igjen i 2026: 18 av 25"
// Breakdown: arbeidstimer, grunnlønn, tillegg (with badges), overtid, bruttolønn, skattetrekk, utbetalt
//   - All figures labeled "Avregnet i lønn" (trust tier: settled)
// "Tidligere" section: previous period cards (tappable, show same detail)
// Empty state: strings.payroll.noPayslips
// Only shows periods with status IN ('closed', 'exported')
```

- [ ] **Step 4: Verify typecheck**

Run: `cd apps/mobile && npx tsc --noEmit`

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/src/components/payroll/AbsenceBalanceScreen.tsx apps/mobile/src/components/payroll/TimebankScreen.tsx apps/mobile/src/components/payroll/PayslipScreen.tsx
git commit -m "feat(mobile): add absence balance, timebank, and payslip detail screens"
```

---

## Task 11: Absence Request Screen

**Files:**

- Create: `apps/mobile/src/components/payroll/AbsenceRequestScreen.tsx`

The most interactive screen — balance cards + request form + projection + history.

- [ ] **Step 1: Create `AbsenceRequestScreen.tsx`**

```typescript
// Uses: useAbsenceBalance, useMyAbsenceRequests, useRequestAbsence, useCancelAbsence
// Also: projectAbsenceBalance from lib/absence-projection
//
// Layout (balance-first, Planday pattern):
//
// Top: 3 balance cards in horizontal ScrollView
//   - Each: category color border, remaining/total, category label
//   - Reads from absence_quota.remaining_days (generated column = canonical)
//
// Form card:
//   - Type picker: select from absence_type (filtered to workspace active types)
//   - Date range: two date pickers (start + end)
//   - Live projection row:
//     - Call projectAbsenceBalance() on every date/type change
//     - Green: "5 virkedager · Saldo etter: 13 dager"
//     - Red: "Ikke nok dager tilgjengelig" (submit disabled)
//     - Overlap warning if applicable
//   - Comment input (optional)
//   - "Send søknad" button (disabled when !projection.isAllowed)
//
// Bottom: "Mine søknader" list
//   - Status badges: Venter (orange), Godkjent (green), Avslått (red)
//   - Swipe-to-cancel on pending items (or cancel button)
//
// Haptics: Medium on submit, Light on cancel, Selection on picker change
// Loading states: skeleton for balance cards, inline spinner for submit
// Error: error card with retry
```

- [ ] **Step 2: Verify typecheck**

Run: `cd apps/mobile && npx tsc --noEmit`

- [ ] **Step 3: Commit**

```bash
git add apps/mobile/src/components/payroll/AbsenceRequestScreen.tsx
git commit -m "feat(mobile): add balance-first absence request screen with projection"
```

---

## Task 12: Meg Tab Integration + Navigation

**Files:**

- Modify: `apps/mobile/src/components/home/SettingsSheet.tsx`

- [ ] **Step 1: Read the SettingsSheet**

Read `apps/mobile/src/components/home/SettingsSheet.tsx` to understand `MENU_ITEMS` array and routing.

- [ ] **Step 2: Add "Lønn & fravær" section**

After the existing menu items (before logout), add a section divider and 4 new items:

```typescript
// Add to MENU_ITEMS or create PAYROLL_MENU_ITEMS:
{ key: "absence", label: "Fravær", icon: CalendarCheck, color: "#22c55e", action: "navigate-absence" },
{ key: "absence-balance", label: "Fraværssaldo", icon: PieChart, color: "#22c55e", action: "navigate-absence-balance" },
{ key: "timebank", label: "Timebank", icon: Clock, color: "#3b82f6", action: "navigate-timebank" },
{ key: "pay", label: "Min lønn", icon: Wallet, color: "#f97316", action: "navigate-pay" },
```

Add section header "Lønn & fravær" between the existing items and the new payroll items.

Update `handleMenuPress` to route:

- `navigate-absence` → `/(app)/(me)/absence-request`
- `navigate-absence-balance` → `/(app)/(me)/absence-balance`
- `navigate-timebank` → `/(app)/(me)/timebank`
- `navigate-pay` → `/(app)/(me)/payslip`

- [ ] **Step 3: Create route files**

Create 4 route files in `apps/mobile/src/app/(app)/(me)/`:

`absence-request.tsx`:

```typescript
import { AbsenceRequestScreen } from "@/components/payroll/AbsenceRequestScreen";
export default AbsenceRequestScreen;
```

`absence-balance.tsx`:

```typescript
import { AbsenceBalanceScreen } from "@/components/payroll/AbsenceBalanceScreen";
export default AbsenceBalanceScreen;
```

`timebank.tsx`:

```typescript
import { TimebankScreen } from "@/components/payroll/TimebankScreen";
export default TimebankScreen;
```

`payslip.tsx`:

```typescript
import { PayslipScreen } from "@/components/payroll/PayslipScreen";
export default PayslipScreen;
```

Check that `apps/mobile/src/app/(app)/(me)/_layout.tsx` exists and uses a Stack navigator. If not, create one that wraps children in a Stack.

- [ ] **Step 4: Verify typecheck**

Run: `cd apps/mobile && npx tsc --noEmit`

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/src/components/home/SettingsSheet.tsx apps/mobile/src/app/(app)/(me)/
git commit -m "feat(mobile): add payroll section to Meg tab with routes"
```

---

## Task 13: Run All Tests + Final Typecheck

- [ ] **Step 1: Run all mobile tests**

Run: `cd apps/mobile && npx jest --no-coverage`
Expected: all tests PASS (existing shift-phase tests + new supplement/absence/earnings tests)

- [ ] **Step 2: Run typecheck**

Run: `cd /home/sxtnl/dev/wt-5 && pnpm turbo typecheck`
Expected: 0 errors

- [ ] **Step 3: Run lint**

Run: `cd /home/sxtnl/dev/wt-5 && pnpm turbo lint`
Expected: 0 new errors

- [ ] **Step 4: Fix any issues found**

If tests fail or typecheck errors exist, fix them now.

- [ ] **Step 5: Final commit if fixes were needed**

```bash
git add -A
git commit -m "fix(mobile): resolve test/typecheck issues from payroll UI integration"
```
