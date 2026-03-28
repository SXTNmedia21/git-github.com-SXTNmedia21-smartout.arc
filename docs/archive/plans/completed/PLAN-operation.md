---
title: "Plan — Module 15 Season Planning MVP"
status: draft
updated: 2026-03-06
created: 2026-03-06
module: operations
tags: [plan, season, budget, factors, staffing]
---

# Module 15: Season Planning & Budget Engine — MVP Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build the Season Planning MVP — season-level budget targets, day/hour distribution factors, and a calculation engine that produces revenue targets per day/hour and staffing needs. Replace the placeholder season page with a functional planning UI.

**Architecture:** 3 new tables (`season_budget`, `day_factor`, `hour_factor`) extending the existing `season` table. Pure TypeScript calculation functions (testable with vitest). TanStack Query hooks following established dashboard patterns. Tab-based admin UI on the existing `/dashboard/season` route. Calculations use existing `operating_hours` table for open/close times.

**Tech Stack:** Supabase (PostgreSQL, RLS), TypeScript (strict), Zod schemas, vitest (unit tests for calculations), TanStack Query, Next.js App Router (client components), shadcn/ui, Tailwind v4, Recharts (bar charts for factor visualization).

**Source Documents:**

- `docs/modules/SMARTOUT_MODULE_15_SEASON_PLANNING.md` — Full spec (§1-14)
- `supabase/migrations/00002_structure_tables.sql:7-28` — Existing `season` table
- `supabase/migrations/20260302152749_add_dashboard_evolution_tables.sql` — Existing `operating_hours` + `workspace_budget` tables
- `apps/web/src/app/dashboard/_hooks/use-budget.ts` — Existing budget hook pattern
- `apps/web/src/app/dashboard/season/page.tsx` — Placeholder to replace

**Existing Infrastructure:**

- `season` table EXISTS with `draft`/`active`/`archived` lifecycle, workspace scoping, RLS
- `operating_hours` table EXISTS with per-weekday open/close times per workspace/location
- `workspace_budget` table EXISTS — operational period-based targets (separate from season budget)
- `workspace_kpi_target` table EXISTS — strategic KPI benchmarks
- Season sidebar nav EXISTS at `/dashboard/season` (wired in DashboardShell.tsx)
- TanStack Query hook patterns EXIST in `apps/web/src/app/dashboard/_hooks/`
- vitest configured in `apps/web/package.json`

**Key Design Decisions:**

| #   | Decision                                    | Choice                                  | Rationale                                                                                                                                |
| --- | ------------------------------------------- | --------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | `season_budget` vs reuse `workspace_budget` | NEW table, 1:1 with season              | `workspace_budget` is operational targets per date. `season_budget` is strategic planning per season. Different granularity and purpose. |
| 2   | Hour factor dependency on open hours        | Use existing `operating_hours`          | Already has workspace + location + day_of_week + open/close times. No need for new `department_schedule` table for MVP.                  |
| 3   | Calculation location                        | Pure TypeScript functions in `apps/web` | Client-side calculations are fast enough for MVP (7 day factors × N hours). No Edge Function needed until we cache pre-computed targets. |
| 4   | Date overrides                              | OUT of MVP                              | Module 15 spec §12 puts this in Phase 2.                                                                                                 |
| 5   | Factor learning                             | OUT of MVP                              | Module 15 spec §12 puts this in Phase 2. Needs 90+ days of historical data.                                                              |
| 6   | Alcohol model                               | OUT of MVP                              | Module 15 spec §12 puts this in Phase 2.                                                                                                 |

**MVP Scope (from spec §12):**

- Season budget (total target, labor %, avg hourly wage, base price per guest)
- Day factors (7 weekday values)
- Hour factors (per open hour)
- Calculation: day target, hour target, staffing need per hour
- Display in season planning page

**Out of scope:**

- Monthly breakdown with slider UI
- Date overrides for holidays/events
- Alcohol model with seasonal factors
- Factor learning and AI recommendations
- Multi-department budgets (kitchen vs bar vs service)
- Scenario planning
- Season setup wizard integration (onboarding)

---

## Phase 1: Database — Tables & RLS

> Creates 3 tables + 1 enum. Follows patterns from `20260301300000_schedule_shift_table.sql`.

### Task 1: Create season_budget migration

**Files:**

- Create: `supabase/migrations/20260306100000_season_planning_tables.sql`

**Step 1: Write the migration**

All 3 tables go in one migration (they're tightly coupled and deploy together).

```sql
-- ============================================
-- 20260306100000_season_planning_tables.sql
-- Module 15: Season Planning & Budget Engine (MVP)
-- Creates 3 tables:
--   season_budget  — 1:1 with season, revenue targets + labor model
--   day_factor     — per-weekday revenue distribution factors
--   hour_factor    — per-hour revenue distribution factors
-- Source: docs/modules/SMARTOUT_MODULE_15_SEASON_PLANNING.md
-- ============================================

-- ── Enum ──────────────────────────────────────
CREATE TYPE public.budget_status AS ENUM ('draft', 'active', 'locked');

-- ── season_budget ─────────────────────────────
-- Strategic season-level planning: total target, labor model, base pricing.
-- 1:1 with season. NOT the same as workspace_budget (operational per-date targets).
CREATE TABLE public.season_budget (
  season_budget_id     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  season_id            UUID NOT NULL REFERENCES public.season(season_id) ON DELETE CASCADE,
  workspace_id         UUID NOT NULL REFERENCES public.workspace(workspace_id) ON DELETE CASCADE,

  -- Revenue target
  total_target_revenue DECIMAL NOT NULL DEFAULT 0,

  -- Base pricing
  base_price_per_guest DECIMAL,
  season_price_factor  DECIMAL NOT NULL DEFAULT 1.0,

  -- Labor target
  target_labor_percentage DECIMAL NOT NULL DEFAULT 0.30,
  avg_hourly_wage         DECIMAL,

  -- Status (mirrors season lifecycle)
  status               public.budget_status NOT NULL DEFAULT 'draft',

  created_by           UUID REFERENCES public.profile(profile_id),
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- One budget per season
  CONSTRAINT uq_season_budget_season UNIQUE (season_id)
);

COMMENT ON TABLE public.season_budget IS 'Season-level financial planning. 1:1 with season. Module 15.';
COMMENT ON COLUMN public.season_budget.total_target_revenue IS 'Total NOK revenue target for the entire season period.';
COMMENT ON COLUMN public.season_budget.target_labor_percentage IS 'Target labor cost as fraction of revenue (0.30 = 30%).';
COMMENT ON COLUMN public.season_budget.season_price_factor IS 'Multiplier on base_price_per_guest for this season (e.g. 1.2 for Christmas).';

-- RLS
ALTER TABLE public.season_budget ENABLE ROW LEVEL SECURITY;

CREATE POLICY "jwt_read_season_budget" ON public.season_budget
  FOR SELECT USING (workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid())));

CREATE POLICY "jwt_write_season_budget" ON public.season_budget
  FOR ALL USING (is_admin_in_workspace(auth.uid(), workspace_id));

CREATE POLICY "api_key_read_season_budget" ON public.season_budget
  FOR SELECT USING (workspace_id = get_api_workspace_id());

-- Indexes
CREATE INDEX idx_season_budget_workspace ON public.season_budget(workspace_id);
CREATE INDEX idx_season_budget_season ON public.season_budget(season_id);

-- Trigger
CREATE TRIGGER set_season_budget_updated_at
  BEFORE UPDATE ON public.season_budget
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ── day_factor ────────────────────────────────
-- Per-weekday revenue distribution. Relative factors (not percentages).
-- Factor 2.5 = 2.5× the baseline. System normalizes at calculation time.
CREATE TABLE public.day_factor (
  day_factor_id   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  season_budget_id UUID NOT NULL REFERENCES public.season_budget(season_budget_id) ON DELETE CASCADE,
  workspace_id    UUID NOT NULL REFERENCES public.workspace(workspace_id) ON DELETE CASCADE,

  weekday         INTEGER NOT NULL CHECK (weekday BETWEEN 0 AND 6),
  factor          DECIMAL NOT NULL DEFAULT 1.0 CHECK (factor > 0),

  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- One factor per weekday per budget
  CONSTRAINT uq_day_factor_weekday UNIQUE (season_budget_id, weekday)
);

COMMENT ON TABLE public.day_factor IS 'Per-weekday revenue distribution factors. 0=Mon...6=Sun. Module 15.';
COMMENT ON COLUMN public.day_factor.factor IS 'Relative weight. Higher = more revenue expected. Normalized at calc time.';

-- RLS
ALTER TABLE public.day_factor ENABLE ROW LEVEL SECURITY;

CREATE POLICY "jwt_read_day_factor" ON public.day_factor
  FOR SELECT USING (workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid())));

CREATE POLICY "jwt_write_day_factor" ON public.day_factor
  FOR ALL USING (is_admin_in_workspace(auth.uid(), workspace_id));

CREATE POLICY "api_key_read_day_factor" ON public.day_factor
  FOR SELECT USING (workspace_id = get_api_workspace_id());

-- Indexes
CREATE INDEX idx_day_factor_budget ON public.day_factor(season_budget_id);

-- Trigger
CREATE TRIGGER set_day_factor_updated_at
  BEFORE UPDATE ON public.day_factor
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ── hour_factor ───────────────────────────────
-- Per-hour revenue distribution within a day.
-- Only relevant for open hours. Factor 2.4 at 19:00 = peak dinner.
CREATE TABLE public.hour_factor (
  hour_factor_id   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  season_budget_id UUID NOT NULL REFERENCES public.season_budget(season_budget_id) ON DELETE CASCADE,
  workspace_id     UUID NOT NULL REFERENCES public.workspace(workspace_id) ON DELETE CASCADE,

  hour             INTEGER NOT NULL CHECK (hour BETWEEN 0 AND 23),
  factor           DECIMAL NOT NULL DEFAULT 1.0 CHECK (factor > 0),

  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- One factor per hour per budget
  CONSTRAINT uq_hour_factor_hour UNIQUE (season_budget_id, hour)
);

COMMENT ON TABLE public.hour_factor IS 'Per-hour revenue distribution factors. 0-23 hour slots. Module 15.';
COMMENT ON COLUMN public.hour_factor.factor IS 'Relative weight within day. 19:00 peak might be 2.4, 15:00 quiet might be 0.6.';

-- RLS
ALTER TABLE public.hour_factor ENABLE ROW LEVEL SECURITY;

CREATE POLICY "jwt_read_hour_factor" ON public.hour_factor
  FOR SELECT USING (workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid())));

CREATE POLICY "jwt_write_hour_factor" ON public.hour_factor
  FOR ALL USING (is_admin_in_workspace(auth.uid(), workspace_id));

CREATE POLICY "api_key_read_hour_factor" ON public.hour_factor
  FOR SELECT USING (workspace_id = get_api_workspace_id());

-- Indexes
CREATE INDEX idx_hour_factor_budget ON public.hour_factor(season_budget_id);

-- Trigger
CREATE TRIGGER set_hour_factor_updated_at
  BEFORE UPDATE ON public.hour_factor
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
```

**Step 2: Run migration locally**

```bash
cd /home/sxtnl/dev/wt-1 && npx supabase db reset
```

Expected: Migration applies cleanly with all 3 tables created.

**Step 3: Verify tables exist**

```bash
cd /home/sxtnl/dev/wt-1 && npx supabase db lint
```

Expected: No errors.

**Step 4: Commit**

```bash
git add supabase/migrations/20260306100000_season_planning_tables.sql
git commit -m "feat(season): add season_budget, day_factor, hour_factor tables (Module 15 MVP)"
```

---

### Task 2: Regenerate TypeScript types

**Files:**

- Modify: `packages/supabase/src/database.types.ts` (auto-generated)

**Step 1: Generate types from local DB**

```bash
cd /home/sxtnl/dev/wt-1 && npx supabase gen types typescript --local > packages/supabase/src/database.types.ts
```

**Step 2: Verify new types exist**

Search the generated file for `season_budget`, `day_factor`, `hour_factor`. All 3 should appear as TypeScript interfaces with correct column types.

**Step 3: Run typecheck**

```bash
cd /home/sxtnl/dev/wt-1 && pnpm turbo typecheck
```

Expected: 0 errors. The new types don't break anything since nothing references them yet.

**Step 4: Commit**

```bash
git add packages/supabase/src/database.types.ts
git commit -m "chore: regenerate database types with season planning tables"
```

---

## Phase 2: Calculation Engine — Pure TypeScript + Tests

> Pure functions with zero database dependencies. Testable with vitest. This is the brains of Module 15.

### Task 3: Write calculation engine tests

**Files:**

- Create: `apps/web/src/lib/season-calculations.test.ts`

**Step 1: Write failing tests for all 3 calculations**

These tests encode the formulas from Module 15 spec §5.1–5.3.

```typescript
import { describe, it, expect } from "vitest";
import {
  calculateDayTargets,
  calculateHourTargets,
  calculateStaffingNeed,
  type DayFactorInput,
  type HourFactorInput,
  type OperatingHoursInput,
} from "./season-calculations";

describe("calculateDayTargets", () => {
  const dayFactors: DayFactorInput[] = [
    { weekday: 0, factor: 1.0 }, // Mon
    { weekday: 1, factor: 1.1 }, // Tue
    { weekday: 2, factor: 1.2 }, // Wed
    { weekday: 3, factor: 1.4 }, // Thu
    { weekday: 4, factor: 2.2 }, // Fri
    { weekday: 5, factor: 2.5 }, // Sat
    { weekday: 6, factor: 1.3 }, // Sun
  ];

  it("distributes total target across season days using factors", () => {
    const result = calculateDayTargets({
      totalTargetRevenue: 700_000,
      startDate: "2026-04-06", // Monday
      endDate: "2026-04-12", // Sunday — exactly 7 days
      dayFactors,
    });

    expect(result).toHaveLength(7);

    // Average factor = (1.0+1.1+1.2+1.4+2.2+2.5+1.3) / 7 = 10.7 / 7 ≈ 1.5286
    // Base daily = 700000 / 7 = 100000
    // Monday target = 100000 × (1.0 / 1.5286) ≈ 65421
    // Saturday target = 100000 × (2.5 / 1.5286) ≈ 163551
    const monday = result.find((d) => d.date === "2026-04-06");
    const saturday = result.find((d) => d.date === "2026-04-11");

    expect(monday).toBeDefined();
    expect(saturday).toBeDefined();
    expect(monday!.target).toBeCloseTo(65421, -1); // within 10 NOK
    expect(saturday!.target).toBeCloseTo(163551, -1);

    // Total should equal original target
    const total = result.reduce((sum, d) => sum + d.target, 0);
    expect(total).toBeCloseTo(700_000, 0);
  });

  it("handles 2-week season with correct weekday mapping", () => {
    const result = calculateDayTargets({
      totalTargetRevenue: 1_000_000,
      startDate: "2026-04-06", // Mon
      endDate: "2026-04-19", // Sun — 14 days
      dayFactors,
    });

    expect(result).toHaveLength(14);

    // Both Mondays should have same target
    const mon1 = result.find((d) => d.date === "2026-04-06");
    const mon2 = result.find((d) => d.date === "2026-04-13");
    expect(mon1!.target).toBeCloseTo(mon2!.target, 0);

    // Total = 1M
    const total = result.reduce((sum, d) => sum + d.target, 0);
    expect(total).toBeCloseTo(1_000_000, 0);
  });

  it("returns empty array if no day factors provided", () => {
    const result = calculateDayTargets({
      totalTargetRevenue: 500_000,
      startDate: "2026-04-06",
      endDate: "2026-04-12",
      dayFactors: [],
    });
    // Falls back to equal distribution
    expect(result).toHaveLength(7);
    expect(result[0].target).toBeCloseTo(500_000 / 7, 0);
  });
});

describe("calculateHourTargets", () => {
  const hourFactors: HourFactorInput[] = [
    { hour: 10, factor: 0.4 },
    { hour: 11, factor: 0.7 },
    { hour: 12, factor: 1.3 },
    { hour: 13, factor: 1.0 },
    { hour: 14, factor: 0.8 },
    { hour: 15, factor: 0.6 },
    { hour: 16, factor: 0.9 },
    { hour: 17, factor: 1.5 },
    { hour: 18, factor: 2.0 },
    { hour: 19, factor: 2.4 },
    { hour: 20, factor: 2.2 },
    { hour: 21, factor: 1.1 },
  ];

  const operatingHours: OperatingHoursInput = {
    openHour: 10,
    closeHour: 22, // 10:00-22:00 = 12 open hours
  };

  it("distributes day target across open hours using factors", () => {
    const dayTarget = 100_000;
    const result = calculateHourTargets({
      dayTarget,
      hourFactors,
      operatingHours,
    });

    // Only open hours should have targets
    expect(result).toHaveLength(12);
    expect(result[0].hour).toBe(10);
    expect(result[result.length - 1].hour).toBe(21);

    // Sum should equal day target
    const total = result.reduce((sum, h) => sum + h.target, 0);
    expect(total).toBeCloseTo(dayTarget, 0);

    // Peak hour (19:00, factor 2.4) should be highest
    const peak = result.find((h) => h.hour === 19);
    const quiet = result.find((h) => h.hour === 15);
    expect(peak!.target).toBeGreaterThan(quiet!.target);
  });

  it("handles missing hour factors by defaulting to 1.0", () => {
    const result = calculateHourTargets({
      dayTarget: 120_000,
      hourFactors: [{ hour: 12, factor: 2.0 }], // only lunch defined
      operatingHours: { openHour: 10, closeHour: 14 }, // 4 hours
    });

    expect(result).toHaveLength(4);

    // hour 12 has factor 2.0, others default to 1.0
    // Sum of factors: 1.0 + 1.0 + 2.0 + 1.0 = 5.0
    // hour 12 target = 120000 × (2.0 / 5.0) = 48000
    const lunch = result.find((h) => h.hour === 12);
    expect(lunch!.target).toBeCloseTo(48_000, 0);

    const total = result.reduce((sum, h) => sum + h.target, 0);
    expect(total).toBeCloseTo(120_000, 0);
  });
});

describe("calculateStaffingNeed", () => {
  it("calculates staff needed from revenue target and labor %", () => {
    const result = calculateStaffingNeed({
      hourTarget: 50_000,
      targetLaborPercentage: 0.3,
      avgHourlyWage: 250,
    });

    // max_labor_cost = 50000 × 0.30 = 15000
    // staff_needed = 15000 / 250 = 60
    // Wait, that's 60 staff per hour? Let me recalculate.
    // Actually the hourTarget is for ONE hour.
    // If the hour earns 50000 NOK and labor should be 30%, that's 15000 NOK for labor in that hour.
    // At 250 NOK/hour wage, that's 60 people. That seems high but it's correct math.
    // In reality, hour targets would be much smaller (e.g. 8333 NOK/hour for a 100K day / 12 hours)
    expect(result.maxLaborCost).toBeCloseTo(15_000, 0);
    expect(result.staffNeeded).toBeCloseTo(60, 1);
  });

  it("returns 0 staff when no wage data", () => {
    const result = calculateStaffingNeed({
      hourTarget: 50_000,
      targetLaborPercentage: 0.3,
      avgHourlyWage: 0,
    });

    expect(result.staffNeeded).toBe(0);
    expect(result.maxLaborCost).toBeCloseTo(15_000, 0);
  });

  it("handles realistic restaurant numbers", () => {
    // A restaurant doing 100K/day, open 12 hours, peak hour = ~12500 NOK
    const result = calculateStaffingNeed({
      hourTarget: 12_500,
      targetLaborPercentage: 0.3,
      avgHourlyWage: 220,
    });

    // 12500 × 0.30 = 3750 / 220 = 17.05 staff
    expect(result.staffNeeded).toBeCloseTo(17.05, 1);
  });
});
```

**Step 2: Run tests — verify they fail**

```bash
cd /home/sxtnl/dev/wt-1 && pnpm --filter web test -- src/lib/season-calculations.test.ts
```

Expected: FAIL — module `./season-calculations` not found.

**Step 3: Commit the tests**

```bash
git add apps/web/src/lib/season-calculations.test.ts
git commit -m "test(season): add calculation engine tests for day targets, hour targets, staffing"
```

---

### Task 4: Implement calculation engine

**Files:**

- Create: `apps/web/src/lib/season-calculations.ts`

**Step 1: Write the implementation**

```typescript
/**
 * Season Planning Calculation Engine (Module 15 MVP)
 *
 * Pure functions — no database or React dependencies.
 * Implements spec §5.1 (day targets), §5.2 (hour targets), §5.3 (staffing).
 *
 * Source: docs/modules/SMARTOUT_MODULE_15_SEASON_PLANNING.md
 */

export type DayFactorInput = {
  weekday: number; // 0=Mon...6=Sun
  factor: number;
};

export type HourFactorInput = {
  hour: number; // 0-23
  factor: number;
};

export type OperatingHoursInput = {
  openHour: number; // e.g. 10
  closeHour: number; // e.g. 22 (exclusive — 22 means last open hour is 21)
};

export type DayTarget = {
  date: string; // YYYY-MM-DD
  weekday: number; // 0=Mon...6=Sun
  target: number; // NOK
};

export type HourTarget = {
  hour: number;
  target: number; // NOK
  factor: number;
};

export type StaffingResult = {
  maxLaborCost: number;
  staffNeeded: number;
};

/**
 * §5.1 Revenue Target Per Day
 *
 * Distributes total season target across all days using weekday factors.
 * Factors are relative (not percentages) — system normalizes.
 *
 * Formula:
 *   avg_factor = mean(all day factors for days in season)
 *   day_target = base_daily × (weekday_factor / avg_factor)
 *
 * where base_daily = total_target / season_days
 */
export function calculateDayTargets(input: {
  totalTargetRevenue: number;
  startDate: string;
  endDate: string;
  dayFactors: DayFactorInput[];
}): DayTarget[] {
  const { totalTargetRevenue, startDate, endDate, dayFactors } = input;

  // Build factor lookup (weekday → factor), default 1.0
  const factorMap = new Map<number, number>();
  for (const df of dayFactors) {
    factorMap.set(df.weekday, df.factor);
  }

  // Generate all dates in range
  const dates: { date: string; weekday: number }[] = [];
  const start = new Date(startDate + "T00:00:00");
  const end = new Date(endDate + "T00:00:00");

  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    // JS: 0=Sun...6=Sat → convert to 0=Mon...6=Sun
    const jsDay = d.getDay();
    const weekday = jsDay === 0 ? 6 : jsDay - 1;
    dates.push({
      date: d.toISOString().split("T")[0],
      weekday,
    });
  }

  if (dates.length === 0) return [];

  // Calculate average factor across actual season days
  const factors = dates.map((d) => factorMap.get(d.weekday) ?? 1.0);
  const avgFactor = factors.reduce((sum, f) => sum + f, 0) / factors.length;

  const baseDailyTarget = totalTargetRevenue / dates.length;

  return dates.map((d, i) => ({
    date: d.date,
    weekday: d.weekday,
    target: baseDailyTarget * (factors[i] / avgFactor),
  }));
}

/**
 * §5.2 Revenue Target Per Hour
 *
 * Distributes a single day's target across open hours using hour factors.
 *
 * Formula:
 *   hour_target = day_target × (hour_factor / Σ active_hour_factors)
 */
export function calculateHourTargets(input: {
  dayTarget: number;
  hourFactors: HourFactorInput[];
  operatingHours: OperatingHoursInput;
}): HourTarget[] {
  const { dayTarget, hourFactors, operatingHours } = input;
  const { openHour, closeHour } = operatingHours;

  // Build factor lookup (hour → factor), default 1.0
  const factorMap = new Map<number, number>();
  for (const hf of hourFactors) {
    factorMap.set(hf.hour, hf.factor);
  }

  // Generate open hours
  const hours: number[] = [];
  for (let h = openHour; h < closeHour; h++) {
    hours.push(h);
  }

  if (hours.length === 0) return [];

  // Get factors for open hours only
  const activeFactors = hours.map((h) => factorMap.get(h) ?? 1.0);
  const totalFactors = activeFactors.reduce((sum, f) => sum + f, 0);

  return hours.map((h, i) => ({
    hour: h,
    target: dayTarget * (activeFactors[i] / totalFactors),
    factor: activeFactors[i],
  }));
}

/**
 * §5.3 Staffing Need Per Hour
 *
 * Formula:
 *   max_labor_cost = hour_target × target_labor_pct
 *   staff_needed = max_labor_cost / avg_hourly_wage
 */
export function calculateStaffingNeed(input: {
  hourTarget: number;
  targetLaborPercentage: number;
  avgHourlyWage: number;
}): StaffingResult {
  const { hourTarget, targetLaborPercentage, avgHourlyWage } = input;

  const maxLaborCost = hourTarget * targetLaborPercentage;
  const staffNeeded = avgHourlyWage > 0 ? maxLaborCost / avgHourlyWage : 0;

  return { maxLaborCost, staffNeeded };
}
```

**Step 2: Run tests — verify they pass**

```bash
cd /home/sxtnl/dev/wt-1 && pnpm --filter web test -- src/lib/season-calculations.test.ts
```

Expected: ALL PASS.

**Step 3: Commit**

```bash
git add apps/web/src/lib/season-calculations.ts
git commit -m "feat(season): implement calculation engine — day targets, hour targets, staffing"
```

---

## Phase 3: TanStack Query Hooks

> Follows patterns from `apps/web/src/app/dashboard/_hooks/use-budget.ts`. One hook per concern.

### Task 5: Add season query keys to factory

**Files:**

- Modify: `apps/web/src/app/dashboard/_hooks/dashboard-keys.ts`

**Step 1: Add season key factories**

Add these entries to the `dashboardKeys` object:

```typescript
// Season Planning (Module 15)
seasonBudget: (workspaceId: string, seasonId: string) =>
  ["dashboard", "season-budget", workspaceId, seasonId] as const,

seasonBudgets: (workspaceId: string) =>
  ["dashboard", "season-budgets", workspaceId] as const,

dayFactors: (workspaceId: string, seasonBudgetId: string) =>
  ["dashboard", "day-factors", workspaceId, seasonBudgetId] as const,

hourFactors: (workspaceId: string, seasonBudgetId: string) =>
  ["dashboard", "hour-factors", workspaceId, seasonBudgetId] as const,

seasons: (workspaceId: string) =>
  ["dashboard", "seasons", workspaceId] as const,

operatingHours: (workspaceId: string) =>
  ["dashboard", "operating-hours", workspaceId] as const,
```

**Step 2: Commit**

```bash
git add apps/web/src/app/dashboard/_hooks/dashboard-keys.ts
git commit -m "feat(season): add season planning query keys to factory"
```

---

### Task 6: Create useSeasons hook

**Files:**

- Create: `apps/web/src/app/dashboard/season/_hooks/use-seasons.ts`

**Step 1: Write the hook**

```typescript
"use client";

import { useQuery } from "@tanstack/react-query";
import { useWorkspaceOptional } from "@/lib/workspace-context";
import { createClient } from "@smartout/supabase/client";
import { dashboardKeys } from "../../_hooks/dashboard-keys";

export type Season = {
  season_id: string;
  name: string;
  slug: string;
  season_type: string;
  start_date: string | null;
  end_date: string | null;
  status: "draft" | "active" | "archived";
  is_default: boolean;
  color: string | null;
  icon: string | null;
  description: string | null;
};

export function useSeasons() {
  const ctx = useWorkspaceOptional();
  const wsId = ctx?.workspace.workspace_id;
  const supabase = createClient();

  const query = useQuery({
    queryKey: dashboardKeys.seasons(wsId ?? "none"),
    queryFn: async (): Promise<Season[]> => {
      const { data, error } = await supabase
        .from("season")
        .select(
          "season_id, name, slug, season_type, start_date, end_date, status, is_default, color, icon, description",
        )
        .eq("workspace_id", wsId!)
        .order("start_date", { ascending: false });

      if (error) throw error;
      return (data ?? []) as Season[];
    },
    enabled: !!wsId,
  });

  return {
    seasons: query.data ?? [],
    isLoading: query.isLoading,
    error: query.error,
  };
}
```

**Step 2: Commit**

```bash
mkdir -p apps/web/src/app/dashboard/season/_hooks
git add apps/web/src/app/dashboard/season/_hooks/use-seasons.ts
git commit -m "feat(season): add useSeasons hook"
```

---

### Task 7: Create useSeasonBudget hook

**Files:**

- Create: `apps/web/src/app/dashboard/season/_hooks/use-season-budget.ts`

**Step 1: Write the hook**

```typescript
"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useWorkspaceOptional } from "@/lib/workspace-context";
import { createClient } from "@smartout/supabase/client";
import { dashboardKeys } from "../../_hooks/dashboard-keys";
import { toast } from "sonner";

export type SeasonBudget = {
  season_budget_id: string;
  season_id: string;
  total_target_revenue: number;
  base_price_per_guest: number | null;
  season_price_factor: number;
  target_labor_percentage: number;
  avg_hourly_wage: number | null;
  status: "draft" | "active" | "locked";
};

type UpsertSeasonBudgetInput = {
  season_id: string;
  total_target_revenue: number;
  base_price_per_guest?: number | null;
  season_price_factor?: number;
  target_labor_percentage?: number;
  avg_hourly_wage?: number | null;
};

export function useSeasonBudget(seasonId: string | null) {
  const ctx = useWorkspaceOptional();
  const wsId = ctx?.workspace.workspace_id;
  const supabase = createClient();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: dashboardKeys.seasonBudget(wsId ?? "none", seasonId ?? "none"),
    queryFn: async (): Promise<SeasonBudget | null> => {
      const { data, error } = await supabase
        .from("season_budget")
        .select(
          "season_budget_id, season_id, total_target_revenue, base_price_per_guest, season_price_factor, target_labor_percentage, avg_hourly_wage, status",
        )
        .eq("workspace_id", wsId!)
        .eq("season_id", seasonId!)
        .maybeSingle();

      if (error) throw error;
      return data as SeasonBudget | null;
    },
    enabled: !!wsId && !!seasonId,
  });

  const upsertBudget = useMutation({
    mutationFn: async (input: UpsertSeasonBudgetInput) => {
      // Check if budget already exists
      const existing = query.data;

      if (existing) {
        const { error } = await supabase
          .from("season_budget")
          .update({
            total_target_revenue: input.total_target_revenue,
            base_price_per_guest: input.base_price_per_guest ?? null,
            season_price_factor: input.season_price_factor ?? 1.0,
            target_labor_percentage: input.target_labor_percentage ?? 0.3,
            avg_hourly_wage: input.avg_hourly_wage ?? null,
            updated_at: new Date().toISOString(),
          })
          .eq("season_budget_id", existing.season_budget_id);

        if (error) throw error;
      } else {
        const { error } = await supabase.from("season_budget").insert({
          season_id: input.season_id,
          workspace_id: wsId!,
          total_target_revenue: input.total_target_revenue,
          base_price_per_guest: input.base_price_per_guest ?? null,
          season_price_factor: input.season_price_factor ?? 1.0,
          target_labor_percentage: input.target_labor_percentage ?? 0.3,
          avg_hourly_wage: input.avg_hourly_wage ?? null,
        });

        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: dashboardKeys.seasonBudget(wsId!, seasonId!),
      });
      toast.success("Sesongbudsjett lagret");
    },
    onError: (err) => {
      toast.error(`Kunne ikke lagre budsjett: ${err.message}`);
    },
  });

  return {
    budget: query.data ?? null,
    isLoading: query.isLoading,
    upsertBudget,
  };
}
```

**Step 2: Commit**

```bash
git add apps/web/src/app/dashboard/season/_hooks/use-season-budget.ts
git commit -m "feat(season): add useSeasonBudget hook with upsert mutation"
```

---

### Task 8: Create useDayFactors hook

**Files:**

- Create: `apps/web/src/app/dashboard/season/_hooks/use-day-factors.ts`

**Step 1: Write the hook**

```typescript
"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useWorkspaceOptional } from "@/lib/workspace-context";
import { createClient } from "@smartout/supabase/client";
import { dashboardKeys } from "../../_hooks/dashboard-keys";
import { toast } from "sonner";

export type DayFactor = {
  day_factor_id: string;
  weekday: number;
  factor: number;
};

const WEEKDAY_LABELS = ["Man", "Tir", "Ons", "Tor", "Fre", "Lør", "Søn"] as const;

/** Default restaurant profile: weekend-heavy */
export const DEFAULT_DAY_FACTORS: { weekday: number; factor: number }[] = [
  { weekday: 0, factor: 1.0 }, // Man
  { weekday: 1, factor: 1.1 }, // Tir
  { weekday: 2, factor: 1.2 }, // Ons
  { weekday: 3, factor: 1.4 }, // Tor
  { weekday: 4, factor: 2.2 }, // Fre
  { weekday: 5, factor: 2.5 }, // Lør
  { weekday: 6, factor: 1.3 }, // Søn
];

export { WEEKDAY_LABELS };

export function useDayFactors(seasonBudgetId: string | null) {
  const ctx = useWorkspaceOptional();
  const wsId = ctx?.workspace.workspace_id;
  const supabase = createClient();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: dashboardKeys.dayFactors(wsId ?? "none", seasonBudgetId ?? "none"),
    queryFn: async (): Promise<DayFactor[]> => {
      const { data, error } = await supabase
        .from("day_factor")
        .select("day_factor_id, weekday, factor")
        .eq("workspace_id", wsId!)
        .eq("season_budget_id", seasonBudgetId!)
        .order("weekday");

      if (error) throw error;
      return (data ?? []) as DayFactor[];
    },
    enabled: !!wsId && !!seasonBudgetId,
  });

  const saveDayFactors = useMutation({
    mutationFn: async (factors: { weekday: number; factor: number }[]) => {
      // Delete existing + insert new (simpler than individual upserts for 7 rows)
      const { error: deleteError } = await supabase
        .from("day_factor")
        .delete()
        .eq("season_budget_id", seasonBudgetId!)
        .eq("workspace_id", wsId!);

      if (deleteError) throw deleteError;

      const rows = factors.map((f) => ({
        season_budget_id: seasonBudgetId!,
        workspace_id: wsId!,
        weekday: f.weekday,
        factor: f.factor,
      }));

      const { error: insertError } = await supabase.from("day_factor").insert(rows);
      if (insertError) throw insertError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: dashboardKeys.dayFactors(wsId!, seasonBudgetId!),
      });
      toast.success("Dagfaktorer lagret");
    },
    onError: (err) => {
      toast.error(`Kunne ikke lagre dagfaktorer: ${err.message}`);
    },
  });

  return {
    dayFactors: query.data ?? [],
    isLoading: query.isLoading,
    saveDayFactors,
  };
}
```

**Step 2: Commit**

```bash
git add apps/web/src/app/dashboard/season/_hooks/use-day-factors.ts
git commit -m "feat(season): add useDayFactors hook with save mutation"
```

---

### Task 9: Create useHourFactors hook

**Files:**

- Create: `apps/web/src/app/dashboard/season/_hooks/use-hour-factors.ts`

**Step 1: Write the hook**

```typescript
"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useWorkspaceOptional } from "@/lib/workspace-context";
import { createClient } from "@smartout/supabase/client";
import { dashboardKeys } from "../../_hooks/dashboard-keys";
import { toast } from "sonner";

export type HourFactor = {
  hour_factor_id: string;
  hour: number;
  factor: number;
};

/** Default restaurant profile: lunch + dinner peaks */
export const DEFAULT_HOUR_FACTORS: { hour: number; factor: number }[] = [
  { hour: 10, factor: 0.4 },
  { hour: 11, factor: 0.7 },
  { hour: 12, factor: 1.3 },
  { hour: 13, factor: 1.0 },
  { hour: 14, factor: 0.8 },
  { hour: 15, factor: 0.6 },
  { hour: 16, factor: 0.9 },
  { hour: 17, factor: 1.5 },
  { hour: 18, factor: 2.0 },
  { hour: 19, factor: 2.4 },
  { hour: 20, factor: 2.2 },
  { hour: 21, factor: 1.1 },
];

export function useHourFactors(seasonBudgetId: string | null) {
  const ctx = useWorkspaceOptional();
  const wsId = ctx?.workspace.workspace_id;
  const supabase = createClient();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: dashboardKeys.hourFactors(wsId ?? "none", seasonBudgetId ?? "none"),
    queryFn: async (): Promise<HourFactor[]> => {
      const { data, error } = await supabase
        .from("hour_factor")
        .select("hour_factor_id, hour, factor")
        .eq("workspace_id", wsId!)
        .eq("season_budget_id", seasonBudgetId!)
        .order("hour");

      if (error) throw error;
      return (data ?? []) as HourFactor[];
    },
    enabled: !!wsId && !!seasonBudgetId,
  });

  const saveHourFactors = useMutation({
    mutationFn: async (factors: { hour: number; factor: number }[]) => {
      const { error: deleteError } = await supabase
        .from("hour_factor")
        .delete()
        .eq("season_budget_id", seasonBudgetId!)
        .eq("workspace_id", wsId!);

      if (deleteError) throw deleteError;

      const rows = factors.map((f) => ({
        season_budget_id: seasonBudgetId!,
        workspace_id: wsId!,
        hour: f.hour,
        factor: f.factor,
      }));

      const { error: insertError } = await supabase.from("hour_factor").insert(rows);
      if (insertError) throw insertError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: dashboardKeys.hourFactors(wsId!, seasonBudgetId!),
      });
      toast.success("Timefaktorer lagret");
    },
    onError: (err) => {
      toast.error(`Kunne ikke lagre timefaktorer: ${err.message}`);
    },
  });

  return {
    hourFactors: query.data ?? [],
    isLoading: query.isLoading,
    saveHourFactors,
  };
}
```

**Step 2: Commit**

```bash
git add apps/web/src/app/dashboard/season/_hooks/use-hour-factors.ts
git commit -m "feat(season): add useHourFactors hook with save mutation"
```

---

### Task 10: Create useOperatingHours hook

**Files:**

- Create: `apps/web/src/app/dashboard/season/_hooks/use-operating-hours.ts`

**Step 1: Write the hook**

This reads the existing `operating_hours` table (created in dashboard-evolution migration).

```typescript
"use client";

import { useQuery } from "@tanstack/react-query";
import { useWorkspaceOptional } from "@/lib/workspace-context";
import { createClient } from "@smartout/supabase/client";
import { dashboardKeys } from "../../_hooks/dashboard-keys";

export type OperatingHoursRow = {
  id: string;
  day_of_week: number;
  open_time: string; // "08:00:00"
  close_time: string; // "22:00:00"
  is_closed: boolean;
  location_id: string | null;
};

export function useOperatingHours() {
  const ctx = useWorkspaceOptional();
  const wsId = ctx?.workspace.workspace_id;
  const supabase = createClient();

  const query = useQuery({
    queryKey: dashboardKeys.operatingHours(wsId ?? "none"),
    queryFn: async (): Promise<OperatingHoursRow[]> => {
      const { data, error } = await supabase
        .from("operating_hours")
        .select("id, day_of_week, open_time, close_time, is_closed, location_id")
        .eq("workspace_id", wsId!)
        .is("location_id", null) // workspace-level hours (no location filter for MVP)
        .order("day_of_week");

      if (error) throw error;
      return (data ?? []) as OperatingHoursRow[];
    },
    enabled: !!wsId,
  });

  return {
    operatingHours: query.data ?? [],
    isLoading: query.isLoading,
  };
}

/** Extract open/close hour integers from a time string like "10:00:00" */
export function parseTimeToHour(time: string): number {
  return parseInt(time.split(":")[0], 10);
}
```

**Step 2: Commit**

```bash
git add apps/web/src/app/dashboard/season/_hooks/use-operating-hours.ts
git commit -m "feat(season): add useOperatingHours hook for open/close times"
```

---

### Task 11: Create hooks barrel export

**Files:**

- Create: `apps/web/src/app/dashboard/season/_hooks/index.ts`

**Step 1: Write barrel export**

```typescript
export { useSeasons } from "./use-seasons";
export type { Season } from "./use-seasons";

export { useSeasonBudget } from "./use-season-budget";
export type { SeasonBudget } from "./use-season-budget";

export { useDayFactors, DEFAULT_DAY_FACTORS, WEEKDAY_LABELS } from "./use-day-factors";
export type { DayFactor } from "./use-day-factors";

export { useHourFactors, DEFAULT_HOUR_FACTORS } from "./use-hour-factors";
export type { HourFactor } from "./use-hour-factors";

export { useOperatingHours, parseTimeToHour } from "./use-operating-hours";
export type { OperatingHoursRow } from "./use-operating-hours";
```

**Step 2: Commit**

```bash
git add apps/web/src/app/dashboard/season/_hooks/index.ts
git commit -m "feat(season): add hooks barrel export"
```

---

## Phase 4: Season Planning UI

> Replaces the placeholder page with a tab-based planning interface. Follows patterns from operations page and organization page.

### Task 12: Create SeasonSelector component

**Files:**

- Create: `apps/web/src/app/dashboard/season/_components/SeasonSelector.tsx`

**Step 1: Write the component**

A dropdown/select for picking which season to plan. Shows season name, status badge, and dates.

```tsx
"use client";

import { useSeasons, type Season } from "../_hooks";

type Props = {
  selectedSeasonId: string | null;
  onSelect: (seasonId: string) => void;
  isDark: boolean;
};

export function SeasonSelector({ selectedSeasonId, onSelect, isDark }: Props) {
  const { seasons, isLoading } = useSeasons();

  if (isLoading) {
    return (
      <div
        className={`h-10 w-64 animate-pulse rounded-xl ${isDark ? "bg-zinc-800" : "bg-zinc-200"}`}
      />
    );
  }

  if (seasons.length === 0) {
    return (
      <p className={`text-sm ${isDark ? "text-zinc-500" : "text-zinc-400"}`}>
        Ingen sesonger opprettet enn&aring;.
      </p>
    );
  }

  const statusColors: Record<string, string> = {
    draft: "text-yellow-400 bg-yellow-500/10 border-yellow-500/20",
    active: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20",
    archived: "text-zinc-400 bg-zinc-500/10 border-zinc-500/20",
  };

  return (
    <div className="flex items-center gap-3">
      <select
        value={selectedSeasonId ?? ""}
        onChange={(e) => onSelect(e.target.value)}
        className={`rounded-xl border px-4 py-2 text-sm font-medium transition-colors outline-none ${
          isDark
            ? "border-zinc-700 bg-zinc-900 text-white focus:border-blue-500"
            : "border-zinc-300 bg-white text-zinc-900 focus:border-blue-500"
        }`}
      >
        <option value="" disabled>
          Velg sesong...
        </option>
        {seasons.map((s) => (
          <option key={s.season_id} value={s.season_id}>
            {s.name} ({s.status})
          </option>
        ))}
      </select>

      {selectedSeasonId &&
        (() => {
          const selected = seasons.find((s) => s.season_id === selectedSeasonId);
          if (!selected) return null;
          return (
            <span
              className={`rounded border px-2 py-0.5 text-xs font-bold ${statusColors[selected.status] ?? statusColors.draft}`}
            >
              {selected.status.toUpperCase()}
            </span>
          );
        })()}
    </div>
  );
}
```

**Step 2: Commit**

```bash
mkdir -p apps/web/src/app/dashboard/season/_components
git add apps/web/src/app/dashboard/season/_components/SeasonSelector.tsx
git commit -m "feat(season): add SeasonSelector dropdown component"
```

---

### Task 13: Create BudgetSetupTab component

**Files:**

- Create: `apps/web/src/app/dashboard/season/_components/BudgetSetupTab.tsx`

**Step 1: Write the component**

Form for configuring the season budget's core numbers: total target, labor %, wage, base price.

```tsx
"use client";

import { useState, useEffect } from "react";
import { useSeasonBudget } from "../_hooks";

type Props = {
  seasonId: string;
  isDark: boolean;
};

export function BudgetSetupTab({ seasonId, isDark }: Props) {
  const { budget, isLoading, upsertBudget } = useSeasonBudget(seasonId);

  const [totalTarget, setTotalTarget] = useState("");
  const [laborPct, setLaborPct] = useState("30");
  const [hourlyWage, setHourlyWage] = useState("");
  const [basePrice, setBasePrice] = useState("");

  // Sync form with loaded data
  useEffect(() => {
    if (budget) {
      setTotalTarget(String(budget.total_target_revenue));
      setLaborPct(String(Math.round(budget.target_labor_percentage * 100)));
      setHourlyWage(budget.avg_hourly_wage != null ? String(budget.avg_hourly_wage) : "");
      setBasePrice(budget.base_price_per_guest != null ? String(budget.base_price_per_guest) : "");
    }
  }, [budget]);

  const handleSave = () => {
    const target = parseFloat(totalTarget);
    if (isNaN(target) || target <= 0) return;

    upsertBudget.mutate({
      season_id: seasonId,
      total_target_revenue: target,
      target_labor_percentage: (parseFloat(laborPct) || 30) / 100,
      avg_hourly_wage: hourlyWage ? parseFloat(hourlyWage) : null,
      base_price_per_guest: basePrice ? parseFloat(basePrice) : null,
    });
  };

  const cardClass = isDark
    ? "rounded-2xl border border-zinc-800 bg-[#0c0c0e] p-6"
    : "rounded-2xl border border-zinc-200 bg-white p-6";

  const inputClass = isDark
    ? "w-full rounded-xl border border-zinc-700 bg-zinc-900 px-4 py-3 text-white outline-none focus:border-blue-500"
    : "w-full rounded-xl border border-zinc-300 bg-zinc-50 px-4 py-3 text-zinc-900 outline-none focus:border-blue-500";

  const labelClass = `mb-2 block text-xs font-bold tracking-wider uppercase ${isDark ? "text-zinc-500" : "text-zinc-400"}`;

  if (isLoading) {
    return <div className={`${cardClass} h-64 animate-pulse`} />;
  }

  return (
    <div className={cardClass}>
      <h3 className={`mb-6 text-lg font-bold ${isDark ? "text-white" : "text-zinc-900"}`}>
        Budsjettoppsett
      </h3>

      <div className="grid gap-6 md:grid-cols-2">
        <div>
          <label className={labelClass}>Total omsetningsm&aring;l (NOK)</label>
          <input
            type="number"
            value={totalTarget}
            onChange={(e) => setTotalTarget(e.target.value)}
            placeholder="f.eks. 5000000"
            className={inputClass}
          />
          <p className={`mt-1 text-xs ${isDark ? "text-zinc-600" : "text-zinc-400"}`}>
            Totalt for hele sesongen
          </p>
        </div>

        <div>
          <label className={labelClass}>M&aring;l l&oslash;nnsandel (%)</label>
          <input
            type="number"
            value={laborPct}
            onChange={(e) => setLaborPct(e.target.value)}
            placeholder="30"
            min="0"
            max="100"
            className={inputClass}
          />
          <p className={`mt-1 text-xs ${isDark ? "text-zinc-600" : "text-zinc-400"}`}>
            Andel av omsetning til l&oslash;nn (typisk 25-35%)
          </p>
        </div>

        <div>
          <label className={labelClass}>Gj.snitt timesl&oslash;nn (NOK)</label>
          <input
            type="number"
            value={hourlyWage}
            onChange={(e) => setHourlyWage(e.target.value)}
            placeholder="f.eks. 220"
            className={inputClass}
          />
          <p className={`mt-1 text-xs ${isDark ? "text-zinc-600" : "text-zinc-400"}`}>
            Brukes til bemanningsberegning
          </p>
        </div>

        <div>
          <label className={labelClass}>Snittpris per gjest (NOK)</label>
          <input
            type="number"
            value={basePrice}
            onChange={(e) => setBasePrice(e.target.value)}
            placeholder="f.eks. 450"
            className={inputClass}
          />
          <p className={`mt-1 text-xs ${isDark ? "text-zinc-600" : "text-zinc-400"}`}>
            Gjennomsnittlig kuvert uten drikke
          </p>
        </div>
      </div>

      <div className="mt-8 flex justify-end">
        <button
          onClick={handleSave}
          disabled={upsertBudget.isPending || !totalTarget}
          className="rounded-xl bg-blue-600 px-6 py-3 text-sm font-bold text-white transition-colors hover:bg-blue-500 disabled:opacity-50"
        >
          {upsertBudget.isPending ? "Lagrer..." : "Lagre budsjett"}
        </button>
      </div>
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add apps/web/src/app/dashboard/season/_components/BudgetSetupTab.tsx
git commit -m "feat(season): add BudgetSetupTab form component"
```

---

### Task 14: Create DayFactorsTab component

**Files:**

- Create: `apps/web/src/app/dashboard/season/_components/DayFactorsTab.tsx`

**Step 1: Write the component**

7 weekday factor inputs with visual bar representation showing relative weights.

```tsx
"use client";

import { useState, useEffect, useMemo } from "react";
import { useDayFactors, DEFAULT_DAY_FACTORS, WEEKDAY_LABELS } from "../_hooks";

type Props = {
  seasonBudgetId: string;
  isDark: boolean;
};

export function DayFactorsTab({ seasonBudgetId, isDark }: Props) {
  const { dayFactors, isLoading, saveDayFactors } = useDayFactors(seasonBudgetId);

  const [factors, setFactors] =
    useState<{ weekday: number; factor: number }[]>(DEFAULT_DAY_FACTORS);

  // Sync with loaded data
  useEffect(() => {
    if (dayFactors.length > 0) {
      setFactors(dayFactors.map((df) => ({ weekday: df.weekday, factor: df.factor })));
    }
  }, [dayFactors]);

  const maxFactor = useMemo(() => Math.max(...factors.map((f) => f.factor), 1), [factors]);

  const updateFactor = (weekday: number, value: string) => {
    const num = parseFloat(value);
    if (isNaN(num) || num <= 0) return;
    setFactors((prev) => prev.map((f) => (f.weekday === weekday ? { ...f, factor: num } : f)));
  };

  const handleSave = () => {
    saveDayFactors.mutate(factors);
  };

  const applyTemplate = (template: "restaurant" | "hotel" | "flat") => {
    const templates: Record<string, { weekday: number; factor: number }[]> = {
      restaurant: DEFAULT_DAY_FACTORS,
      hotel: [
        { weekday: 0, factor: 1.0 },
        { weekday: 1, factor: 1.0 },
        { weekday: 2, factor: 1.1 },
        { weekday: 3, factor: 1.1 },
        { weekday: 4, factor: 1.3 },
        { weekday: 5, factor: 1.4 },
        { weekday: 6, factor: 1.1 },
      ],
      flat: Array.from({ length: 7 }, (_, i) => ({ weekday: i, factor: 1.0 })),
    };
    setFactors(templates[template]);
  };

  const cardClass = isDark
    ? "rounded-2xl border border-zinc-800 bg-[#0c0c0e] p-6"
    : "rounded-2xl border border-zinc-200 bg-white p-6";

  if (isLoading) {
    return <div className={`${cardClass} h-64 animate-pulse`} />;
  }

  return (
    <div className={cardClass}>
      <div className="mb-6 flex items-center justify-between">
        <h3 className={`text-lg font-bold ${isDark ? "text-white" : "text-zinc-900"}`}>
          Dagfaktorer
        </h3>
        <div className="flex gap-2">
          {(["restaurant", "hotel", "flat"] as const).map((t) => (
            <button
              key={t}
              onClick={() => applyTemplate(t)}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                isDark
                  ? "border border-zinc-700 text-zinc-400 hover:bg-zinc-800 hover:text-white"
                  : "border border-zinc-300 text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900"
              }`}
            >
              {t === "restaurant" ? "Restaurant" : t === "hotel" ? "Hotell" : "Flat"}
            </button>
          ))}
        </div>
      </div>

      <p className={`mb-6 text-sm ${isDark ? "text-zinc-500" : "text-zinc-400"}`}>
        Relative vekter per ukedag. H&oslash;yere = mer omsetning forventet. Systemet normaliserer
        automatisk.
      </p>

      <div className="space-y-3">
        {factors.map((f) => {
          const barWidth = (f.factor / maxFactor) * 100;
          return (
            <div key={f.weekday} className="flex items-center gap-4">
              <span
                className={`w-10 text-sm font-bold ${isDark ? "text-zinc-400" : "text-zinc-500"}`}
              >
                {WEEKDAY_LABELS[f.weekday]}
              </span>
              <div className="flex-1">
                <div className={`h-8 rounded-lg ${isDark ? "bg-zinc-900" : "bg-zinc-100"}`}>
                  <div
                    className="flex h-full items-center rounded-lg bg-blue-600/20 px-3 transition-all"
                    style={{ width: `${barWidth}%` }}
                  >
                    <span className="text-xs font-bold text-blue-400">{f.factor.toFixed(1)}x</span>
                  </div>
                </div>
              </div>
              <input
                type="number"
                value={f.factor}
                onChange={(e) => updateFactor(f.weekday, e.target.value)}
                step="0.1"
                min="0.1"
                className={`w-20 rounded-lg border px-3 py-1.5 text-center text-sm font-medium outline-none ${
                  isDark
                    ? "border-zinc-700 bg-zinc-900 text-white focus:border-blue-500"
                    : "border-zinc-300 bg-white text-zinc-900 focus:border-blue-500"
                }`}
              />
            </div>
          );
        })}
      </div>

      <div className="mt-8 flex justify-end">
        <button
          onClick={handleSave}
          disabled={saveDayFactors.isPending}
          className="rounded-xl bg-blue-600 px-6 py-3 text-sm font-bold text-white transition-colors hover:bg-blue-500 disabled:opacity-50"
        >
          {saveDayFactors.isPending ? "Lagrer..." : "Lagre dagfaktorer"}
        </button>
      </div>
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add apps/web/src/app/dashboard/season/_components/DayFactorsTab.tsx
git commit -m "feat(season): add DayFactorsTab with visual bars and templates"
```

---

### Task 15: Create HourFactorsTab component

**Files:**

- Create: `apps/web/src/app/dashboard/season/_components/HourFactorsTab.tsx`

**Step 1: Write the component**

Per-hour factor inputs filtered to open hours, with visual distribution bars.

```tsx
"use client";

import { useState, useEffect, useMemo } from "react";
import { useHourFactors, DEFAULT_HOUR_FACTORS } from "../_hooks";
import { useOperatingHours, parseTimeToHour } from "../_hooks";

type Props = {
  seasonBudgetId: string;
  isDark: boolean;
};

export function HourFactorsTab({ seasonBudgetId, isDark }: Props) {
  const {
    hourFactors,
    isLoading: loadingFactors,
    saveHourFactors,
  } = useHourFactors(seasonBudgetId);
  const { operatingHours, isLoading: loadingHours } = useOperatingHours();

  // Derive open hours range from operating_hours table
  const { openHour, closeHour } = useMemo(() => {
    if (operatingHours.length === 0) {
      return { openHour: 10, closeHour: 22 }; // default
    }
    const openTimes = operatingHours.filter((oh) => !oh.is_closed);
    if (openTimes.length === 0) return { openHour: 10, closeHour: 22 };

    const opens = openTimes.map((oh) => parseTimeToHour(oh.open_time));
    const closes = openTimes.map((oh) => parseTimeToHour(oh.close_time));
    return {
      openHour: Math.min(...opens),
      closeHour: Math.max(...closes),
    };
  }, [operatingHours]);

  // Generate hour slots for the open range
  const hourSlots = useMemo(() => {
    const slots: number[] = [];
    for (let h = openHour; h < closeHour; h++) {
      slots.push(h);
    }
    return slots;
  }, [openHour, closeHour]);

  const [factors, setFactors] = useState<{ hour: number; factor: number }[]>([]);

  // Initialize factors from loaded data or defaults
  useEffect(() => {
    if (hourFactors.length > 0) {
      setFactors(hourFactors.map((hf) => ({ hour: hf.hour, factor: hf.factor })));
    } else {
      // Seed from defaults, filtered to open hours
      setFactors(
        hourSlots.map((h) => {
          const def = DEFAULT_HOUR_FACTORS.find((d) => d.hour === h);
          return { hour: h, factor: def?.factor ?? 1.0 };
        }),
      );
    }
  }, [hourFactors, hourSlots]);

  const maxFactor = useMemo(() => Math.max(...factors.map((f) => f.factor), 1), [factors]);

  const updateFactor = (hour: number, value: string) => {
    const num = parseFloat(value);
    if (isNaN(num) || num <= 0) return;
    setFactors((prev) => prev.map((f) => (f.hour === hour ? { ...f, factor: num } : f)));
  };

  const handleSave = () => {
    saveHourFactors.mutate(factors);
  };

  const cardClass = isDark
    ? "rounded-2xl border border-zinc-800 bg-[#0c0c0e] p-6"
    : "rounded-2xl border border-zinc-200 bg-white p-6";

  const isLoading = loadingFactors || loadingHours;

  if (isLoading) {
    return <div className={`${cardClass} h-64 animate-pulse`} />;
  }

  return (
    <div className={cardClass}>
      <h3 className={`mb-2 text-lg font-bold ${isDark ? "text-white" : "text-zinc-900"}`}>
        Timefaktorer
      </h3>
      <p className={`mb-6 text-sm ${isDark ? "text-zinc-500" : "text-zinc-400"}`}>
        Fordeling av daglig omsetning per time ({openHour}:00&ndash;{closeHour}:00). H&oslash;yere
        faktor = mer omsetning forventet den timen.
      </p>

      <div className="space-y-2">
        {factors.map((f) => {
          const barWidth = (f.factor / maxFactor) * 100;
          const isPeak = f.factor >= maxFactor * 0.8;
          const barColor = isPeak ? "bg-emerald-600/30" : "bg-blue-600/20";
          const textColor = isPeak ? "text-emerald-400" : "text-blue-400";

          return (
            <div key={f.hour} className="flex items-center gap-3">
              <span
                className={`w-14 text-right font-mono text-sm ${isDark ? "text-zinc-500" : "text-zinc-400"}`}
              >
                {String(f.hour).padStart(2, "0")}:00
              </span>
              <div className="flex-1">
                <div className={`h-7 rounded-md ${isDark ? "bg-zinc-900" : "bg-zinc-100"}`}>
                  <div
                    className={`flex h-full items-center rounded-md px-2 transition-all ${barColor}`}
                    style={{ width: `${barWidth}%` }}
                  >
                    <span className={`text-xs font-bold ${textColor}`}>{f.factor.toFixed(1)}</span>
                  </div>
                </div>
              </div>
              <input
                type="number"
                value={f.factor}
                onChange={(e) => updateFactor(f.hour, e.target.value)}
                step="0.1"
                min="0.1"
                className={`w-20 rounded-lg border px-3 py-1.5 text-center text-sm font-medium outline-none ${
                  isDark
                    ? "border-zinc-700 bg-zinc-900 text-white focus:border-blue-500"
                    : "border-zinc-300 bg-white text-zinc-900 focus:border-blue-500"
                }`}
              />
            </div>
          );
        })}
      </div>

      <div className="mt-8 flex justify-end">
        <button
          onClick={handleSave}
          disabled={saveHourFactors.isPending}
          className="rounded-xl bg-blue-600 px-6 py-3 text-sm font-bold text-white transition-colors hover:bg-blue-500 disabled:opacity-50"
        >
          {saveHourFactors.isPending ? "Lagrer..." : "Lagre timefaktorer"}
        </button>
      </div>
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add apps/web/src/app/dashboard/season/_components/HourFactorsTab.tsx
git commit -m "feat(season): add HourFactorsTab with open hours integration"
```

---

### Task 16: Create SeasonOverviewTab component

**Files:**

- Create: `apps/web/src/app/dashboard/season/_components/SeasonOverviewTab.tsx`

**Step 1: Write the component**

Shows the calculated outputs: daily targets, hourly peaks, staffing needs. Uses the calculation engine.

```tsx
"use client";

import { useMemo } from "react";
import {
  useSeasonBudget,
  useDayFactors,
  useHourFactors,
  useOperatingHours,
  parseTimeToHour,
} from "../_hooks";
import {
  calculateDayTargets,
  calculateHourTargets,
  calculateStaffingNeed,
} from "@/lib/season-calculations";
import { DollarSign, Users, Clock, TrendingUp } from "lucide-react";

type Props = {
  seasonId: string;
  seasonBudgetId: string;
  seasonStartDate: string | null;
  seasonEndDate: string | null;
  isDark: boolean;
};

export function SeasonOverviewTab({
  seasonId,
  seasonBudgetId,
  seasonStartDate,
  seasonEndDate,
  isDark,
}: Props) {
  const { budget } = useSeasonBudget(seasonId);
  const { dayFactors } = useDayFactors(seasonBudgetId);
  const { hourFactors } = useHourFactors(seasonBudgetId);
  const { operatingHours } = useOperatingHours();

  // Derive operating hours
  const opHours = useMemo(() => {
    if (operatingHours.length === 0) return { openHour: 10, closeHour: 22 };
    const openTimes = operatingHours.filter((oh) => !oh.is_closed);
    if (openTimes.length === 0) return { openHour: 10, closeHour: 22 };
    return {
      openHour: Math.min(...openTimes.map((oh) => parseTimeToHour(oh.open_time))),
      closeHour: Math.max(...openTimes.map((oh) => parseTimeToHour(oh.close_time))),
    };
  }, [operatingHours]);

  // Calculate day targets for first week
  const sampleDayTargets = useMemo(() => {
    if (!budget || !seasonStartDate || !seasonEndDate) return [];

    return calculateDayTargets({
      totalTargetRevenue: budget.total_target_revenue,
      startDate: seasonStartDate,
      endDate: seasonEndDate,
      dayFactors: dayFactors.map((df) => ({ weekday: df.weekday, factor: df.factor })),
    }).slice(0, 7); // First week as sample
  }, [budget, seasonStartDate, seasonEndDate, dayFactors]);

  // Calculate hour targets for peak day (highest day target)
  const peakDayHourTargets = useMemo(() => {
    if (sampleDayTargets.length === 0) return [];
    const peakDay = sampleDayTargets.reduce(
      (max, d) => (d.target > max.target ? d : max),
      sampleDayTargets[0],
    );

    return calculateHourTargets({
      dayTarget: peakDay.target,
      hourFactors: hourFactors.map((hf) => ({ hour: hf.hour, factor: hf.factor })),
      operatingHours: opHours,
    });
  }, [sampleDayTargets, hourFactors, opHours]);

  // Peak hour staffing
  const peakStaffing = useMemo(() => {
    if (peakDayHourTargets.length === 0 || !budget) return null;
    const peakHour = peakDayHourTargets.reduce(
      (max, h) => (h.target > max.target ? h : max),
      peakDayHourTargets[0],
    );

    return {
      hour: peakHour.hour,
      ...calculateStaffingNeed({
        hourTarget: peakHour.target,
        targetLaborPercentage: budget.target_labor_percentage,
        avgHourlyWage: budget.avg_hourly_wage ?? 0,
      }),
    };
  }, [peakDayHourTargets, budget]);

  // Summary stats
  const avgDailyTarget =
    sampleDayTargets.length > 0
      ? sampleDayTargets.reduce((sum, d) => sum + d.target, 0) / sampleDayTargets.length
      : 0;

  const expectedGuests =
    budget?.base_price_per_guest && budget.base_price_per_guest > 0
      ? Math.round(
          avgDailyTarget / (budget.base_price_per_guest * (budget.season_price_factor ?? 1)),
        )
      : null;

  const cardClass = isDark
    ? "rounded-2xl border border-zinc-800 bg-[#0c0c0e] p-6"
    : "rounded-2xl border border-zinc-200 bg-white p-6";

  const metricCardClass = isDark
    ? "flex flex-col justify-between rounded-2xl border border-zinc-800/80 bg-[#121216] p-4"
    : "flex flex-col justify-between rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm";

  if (!budget) {
    return (
      <div className={cardClass}>
        <p className={`text-sm ${isDark ? "text-zinc-500" : "text-zinc-400"}`}>
          Sett opp budsjett f&oslash;rst for &aring; se beregninger.
        </p>
      </div>
    );
  }

  const formatNOK = (n: number) =>
    new Intl.NumberFormat("nb-NO", {
      style: "currency",
      currency: "NOK",
      maximumFractionDigits: 0,
    }).format(n);

  const WEEKDAY_SHORT = ["Man", "Tir", "Ons", "Tor", "Fre", "L\u00f8r", "S\u00f8n"];

  return (
    <div className="space-y-6">
      {/* Metric cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <div className={metricCardClass}>
          <div className="mb-2 flex items-center gap-2">
            <DollarSign className="h-4 w-4 text-emerald-500" />
            <span
              className={`text-xs font-bold tracking-wider uppercase ${isDark ? "text-zinc-500" : "text-zinc-400"}`}
            >
              Sesongm&aring;l
            </span>
          </div>
          <span className={`text-2xl font-extrabold ${isDark ? "text-white" : "text-zinc-900"}`}>
            {formatNOK(budget.total_target_revenue)}
          </span>
        </div>

        <div className={metricCardClass}>
          <div className="mb-2 flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-blue-500" />
            <span
              className={`text-xs font-bold tracking-wider uppercase ${isDark ? "text-zinc-500" : "text-zinc-400"}`}
            >
              Snitt/dag
            </span>
          </div>
          <span className={`text-2xl font-extrabold ${isDark ? "text-white" : "text-zinc-900"}`}>
            {formatNOK(avgDailyTarget)}
          </span>
        </div>

        <div className={metricCardClass}>
          <div className="mb-2 flex items-center gap-2">
            <Users className="h-4 w-4 text-purple-500" />
            <span
              className={`text-xs font-bold tracking-wider uppercase ${isDark ? "text-zinc-500" : "text-zinc-400"}`}
            >
              Topp bemanning
            </span>
          </div>
          <span className={`text-2xl font-extrabold ${isDark ? "text-white" : "text-zinc-900"}`}>
            {peakStaffing ? `${Math.ceil(peakStaffing.staffNeeded)} pers` : "—"}
          </span>
          {peakStaffing && (
            <span className={`text-xs ${isDark ? "text-zinc-500" : "text-zinc-400"}`}>
              kl {peakStaffing.hour}:00
            </span>
          )}
        </div>

        <div className={metricCardClass}>
          <div className="mb-2 flex items-center gap-2">
            <Clock className="h-4 w-4 text-orange-500" />
            <span
              className={`text-xs font-bold tracking-wider uppercase ${isDark ? "text-zinc-500" : "text-zinc-400"}`}
            >
              Gjester/dag
            </span>
          </div>
          <span className={`text-2xl font-extrabold ${isDark ? "text-white" : "text-zinc-900"}`}>
            {expectedGuests ?? "—"}
          </span>
        </div>
      </div>

      {/* Weekly distribution */}
      <div className={cardClass}>
        <h3 className={`mb-4 text-lg font-bold ${isDark ? "text-white" : "text-zinc-900"}`}>
          Ukentlig fordeling (f&oslash;rste uke)
        </h3>
        <div className="flex items-end gap-2">
          {sampleDayTargets.map((d) => {
            const maxTarget = Math.max(...sampleDayTargets.map((t) => t.target));
            const heightPct = maxTarget > 0 ? (d.target / maxTarget) * 100 : 0;
            return (
              <div key={d.date} className="flex flex-1 flex-col items-center gap-1">
                <span className={`text-xs font-bold ${isDark ? "text-zinc-400" : "text-zinc-500"}`}>
                  {formatNOK(d.target)}
                </span>
                <div
                  className="w-full rounded-t-lg bg-blue-600/30 transition-all"
                  style={{ height: `${Math.max(heightPct * 1.5, 8)}px` }}
                />
                <span
                  className={`text-xs font-medium ${isDark ? "text-zinc-500" : "text-zinc-400"}`}
                >
                  {WEEKDAY_SHORT[d.weekday]}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Hourly distribution for peak day */}
      {peakDayHourTargets.length > 0 && (
        <div className={cardClass}>
          <h3 className={`mb-4 text-lg font-bold ${isDark ? "text-white" : "text-zinc-900"}`}>
            Timefordeling (toppdag)
          </h3>
          <div className="flex items-end gap-1">
            {peakDayHourTargets.map((h) => {
              const maxHourTarget = Math.max(...peakDayHourTargets.map((t) => t.target));
              const heightPct = maxHourTarget > 0 ? (h.target / maxHourTarget) * 100 : 0;
              const isPeak = h.target >= maxHourTarget * 0.8;

              return (
                <div key={h.hour} className="flex flex-1 flex-col items-center gap-1">
                  <span
                    className={`text-[10px] font-bold ${isDark ? "text-zinc-500" : "text-zinc-400"}`}
                  >
                    {formatNOK(h.target)}
                  </span>
                  <div
                    className={`w-full rounded-t-md transition-all ${isPeak ? "bg-emerald-600/40" : "bg-blue-600/20"}`}
                    style={{ height: `${Math.max(heightPct * 1.2, 4)}px` }}
                  />
                  <span
                    className={`font-mono text-[10px] ${isDark ? "text-zinc-600" : "text-zinc-400"}`}
                  >
                    {h.hour}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add apps/web/src/app/dashboard/season/_components/SeasonOverviewTab.tsx
git commit -m "feat(season): add SeasonOverviewTab with calculated targets and charts"
```

---

### Task 17: Replace season page placeholder

**Files:**

- Modify: `apps/web/src/app/dashboard/season/page.tsx`

**Step 1: Rewrite the page**

Replace the "Under Construction" placeholder with the full tab-based season planning UI.

```tsx
"use client";

import { useState, useContext } from "react";
import { DashboardContext } from "@/components/dashboard/DashboardShell";
import { SeasonSelector } from "./_components/SeasonSelector";
import { BudgetSetupTab } from "./_components/BudgetSetupTab";
import { DayFactorsTab } from "./_components/DayFactorsTab";
import { HourFactorsTab } from "./_components/HourFactorsTab";
import { SeasonOverviewTab } from "./_components/SeasonOverviewTab";
import { useSeasonBudget, useSeasons } from "./_hooks";
import { Target, BarChart3, Clock, LayoutDashboard } from "lucide-react";

type SeasonTab = "overview" | "budget" | "day-factors" | "hour-factors";

const TABS: { id: SeasonTab; label: string; icon: typeof Target }[] = [
  { id: "overview", label: "Oversikt", icon: LayoutDashboard },
  { id: "budget", label: "Budsjett", icon: Target },
  { id: "day-factors", label: "Dagfaktorer", icon: BarChart3 },
  { id: "hour-factors", label: "Timefaktorer", icon: Clock },
];

export default function SeasonPage() {
  const { isDark } = useContext(DashboardContext);
  const [activeTab, setActiveTab] = useState<SeasonTab>("overview");
  const [selectedSeasonId, setSelectedSeasonId] = useState<string | null>(null);

  const { seasons } = useSeasons();
  const { budget } = useSeasonBudget(selectedSeasonId);
  const selectedSeason = seasons.find((s) => s.season_id === selectedSeasonId);

  return (
    <div className="z-10 flex-1 overflow-y-auto px-10 pt-8 pb-20">
      {/* Header */}
      <div className="mb-6">
        <h1
          className={`mb-2 text-3xl font-extrabold tracking-tight ${isDark ? "text-white" : "text-zinc-900"}`}
        >
          Sesongplanlegging
          <span className="ml-3 rounded border border-blue-500/20 bg-blue-500/10 px-2 py-1 text-xs font-bold text-blue-400">
            MODULE 15
          </span>
        </h1>
        <p className={`text-sm ${isDark ? "text-zinc-400" : "text-zinc-500"}`}>
          Sett omsetningsm&aring;l, dagfaktorer og timefaktorer for sesongen. Systemet beregner
          daglige m&aring;l og bemanningsbehov.
        </p>
      </div>

      {/* Season selector */}
      <div className="mb-6">
        <SeasonSelector
          selectedSeasonId={selectedSeasonId}
          onSelect={setSelectedSeasonId}
          isDark={isDark}
        />
      </div>

      {!selectedSeasonId ? (
        <div
          className={`flex flex-1 flex-col items-center justify-center rounded-2xl border-2 border-dashed p-12 ${
            isDark ? "border-zinc-800 bg-zinc-900/20" : "border-zinc-300 bg-zinc-50"
          }`}
        >
          <p className={`text-sm ${isDark ? "text-zinc-500" : "text-zinc-400"}`}>
            Velg en sesong for &aring; starte planlegging.
          </p>
        </div>
      ) : (
        <>
          {/* Tab navigation */}
          <div
            className={`mb-6 flex gap-1 rounded-xl border p-1 ${
              isDark ? "border-zinc-800 bg-zinc-900/50" : "border-zinc-200 bg-zinc-100"
            }`}
          >
            {TABS.map((tab) => {
              const isActive = activeTab === tab.id;
              const Icon = tab.icon;

              // Disable overview if no budget exists yet
              const isDisabled = tab.id === "overview" && !budget;
              // Disable factor tabs if no budget exists
              const needsBudget =
                (tab.id === "day-factors" || tab.id === "hour-factors") && !budget;

              return (
                <button
                  key={tab.id}
                  onClick={() => !isDisabled && !needsBudget && setActiveTab(tab.id)}
                  disabled={isDisabled || needsBudget}
                  className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-all ${
                    isActive
                      ? isDark
                        ? "bg-zinc-800 text-white shadow"
                        : "bg-white text-zinc-900 shadow"
                      : isDisabled || needsBudget
                        ? isDark
                          ? "cursor-not-allowed text-zinc-700"
                          : "cursor-not-allowed text-zinc-300"
                        : isDark
                          ? "text-zinc-400 hover:text-white"
                          : "text-zinc-500 hover:text-zinc-900"
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  {tab.label}
                </button>
              );
            })}
          </div>

          {/* Tab content */}
          {activeTab === "overview" && budget && (
            <SeasonOverviewTab
              seasonId={selectedSeasonId}
              seasonBudgetId={budget.season_budget_id}
              seasonStartDate={selectedSeason?.start_date ?? null}
              seasonEndDate={selectedSeason?.end_date ?? null}
              isDark={isDark}
            />
          )}
          {activeTab === "budget" && <BudgetSetupTab seasonId={selectedSeasonId} isDark={isDark} />}
          {activeTab === "day-factors" && budget && (
            <DayFactorsTab seasonBudgetId={budget.season_budget_id} isDark={isDark} />
          )}
          {activeTab === "hour-factors" && budget && (
            <HourFactorsTab seasonBudgetId={budget.season_budget_id} isDark={isDark} />
          )}
        </>
      )}
    </div>
  );
}
```

**Step 2: Run typecheck**

```bash
cd /home/sxtnl/dev/wt-1 && pnpm turbo typecheck
```

Expected: 0 errors.

**Step 3: Commit**

```bash
git add apps/web/src/app/dashboard/season/page.tsx
git commit -m "feat(season): replace placeholder with full season planning page (4 tabs)"
```

---

## Phase 5: Verification & Cleanup

### Task 18: Run full test suite

**Step 1: Run calculation tests**

```bash
cd /home/sxtnl/dev/wt-1 && pnpm --filter web test -- src/lib/season-calculations.test.ts
```

Expected: ALL PASS.

**Step 2: Run typecheck**

```bash
cd /home/sxtnl/dev/wt-1 && pnpm turbo typecheck
```

Expected: 0 errors.

**Step 3: Run lint**

```bash
cd /home/sxtnl/dev/wt-1 && pnpm lint
```

Expected: 0 errors on new files.

---

### Task 19: Update worklog and documentation

**Files:**

- Modify: `docs/worklogs/WORKLOG-operation.md`
- Modify: `docs/decisions/0000-decision-log.md`
- Modify: `docs/learnings/0000-learning-log.md`

**Step 1: Update WORKLOG with completed tasks**

Update status, done list, remaining list, decisions table, and log.

**Step 2: Register decisions in decision log**

| #   | Decision                                                                       | Status   |
| --- | ------------------------------------------------------------------------------ | -------- |
| 1   | New season_budget table (not reuse workspace_budget) — different granularity   | accepted |
| 2   | Use existing operating_hours for open/close times — no new department_schedule | accepted |
| 3   | Pure TypeScript calculation engine (not Edge Function) — fast enough for MVP   | accepted |

**Step 3: Register learnings in learning log**

| #   | Learning                                                                               | Impact                          |
| --- | -------------------------------------------------------------------------------------- | ------------------------------- |
| 1   | workspace_budget and season_budget serve different purposes — operational vs strategic | Prevents table design confusion |
| 2   | operating_hours table already provides Module 4 dependency for hour calculations       | Eliminates blocker              |

**Step 4: Commit documentation**

```bash
git add docs/
git commit -m "docs(season): update worklog, decisions, learnings for Module 15 MVP"
```

---

## Summary

| Phase           | Tasks | What it builds                                                         |
| --------------- | ----- | ---------------------------------------------------------------------- |
| 1. Database     | 1-2   | 3 tables + enum + RLS + types                                          |
| 2. Calculations | 3-4   | Pure TS engine with tests (TDD)                                        |
| 3. Hooks        | 5-11  | 5 TanStack Query hooks + key factory                                   |
| 4. UI           | 12-17 | Season selector + 4 tabs (overview, budget, day factors, hour factors) |
| 5. Verify       | 18-19 | Tests, typecheck, lint, docs                                           |

**Total: 19 tasks, ~15 commits**

**Files created:** ~15 new files
**Files modified:** ~3 existing files (dashboard-keys.ts, season/page.tsx, docs)
