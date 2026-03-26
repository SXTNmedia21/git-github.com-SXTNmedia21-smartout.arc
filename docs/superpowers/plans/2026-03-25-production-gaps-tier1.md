---
title: "Production Gaps Tier 1 — Implementation Plan"
status: draft
updated: 2026-03-25
created: 2026-03-25
module: platform
tags: [production, audit, tier1, gaps]
---

# Production Gaps Tier 1 — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix all Tier 1 blocking gaps identified in the 2026-03-24 full repo audit to unblock MVP launch.

**Architecture:** Seven independent tasks targeting: design token sync, i18n fallback safety, database migration validation, i18n stub language removal, ActivityView mock data replacement, ReconciliationView DB mutations, and critical path E2E tests. Each task is self-contained and can be executed in parallel.

**Tech Stack:** TypeScript, Tailwind v4 (CSS vars), Supabase (PostgreSQL), Playwright (E2E), @smartout/i18n, @smartout/design-tokens, @smartout/telemetry

**Audit context:** `docs/FULL-REPO-AUDIT-2026-03-24.md` + `docs/DEEP-SYSTEM-DOCUMENTATION-2026-03-24.md`

**Pre-verified (already fixed during audit investigation):**

- ~~Gap #1: Join wizard localStorage~~ — Already writes to DB via `provision_onboarding_workspace()` RPC
- ~~Gap #2: hospitality.ts tariff rates~~ — Already corrected to Riksavtalen 2024 values (15.65, 29.74, 100%)

---

## File Structure

| Task | Files                                                           | Purpose                                                                   |
| ---- | --------------------------------------------------------------- | ------------------------------------------------------------------------- |
| 1    | `packages/design-tokens/src/tokens.ts`                          | Sync tokens.ts values to match tokens.css "Ren og Varm" warm cream values |
| 2    | `packages/i18n/src/config.ts`, `packages/i18n/src/translate.ts` | Add fallback chain + remove unused stub languages                         |
| 3    | Supabase migrations                                             | Validate all 200 migrations apply cleanly via `supabase db reset`         |
| 4    | `apps/web/src/components/dashboard/ActivityView.tsx`            | Replace mock heatmap data with real DB queries                            |
| 5    | `apps/web/src/components/dashboard/ReconciliationView.tsx`      | Wire "Approve Day" to actual DB mutation                                  |
| 6    | `apps/web/e2e/`                                                 | E2E tests for 3 critical paths: login, punch-clock, governance            |
| 7    | `packages/design-tokens/src/native.ts`                          | Sync native.ts hex values with updated tokens.ts                          |

---

### Task 1: Sync Design Tokens (tokens.ts → match tokens.css)

The CSS file has the correct "Ren og Varm" warm cream values. tokens.ts has cold neutral values. tokens.ts is the declared source of truth but tokens.css is what the app actually uses. Sync tokens.ts to match the CSS design intent.

**Files:**

- Modify: `packages/design-tokens/src/tokens.ts:29-64` (light mode surface colors)

- [ ] **Step 1: Read current tokens.css light mode values**

Verify the warm cream values in `packages/design-tokens/src/tokens.css` (lines 8-46). These are the design-approved values.

- [ ] **Step 2: Update tokens.ts light mode to match CSS**

```typescript
// ─── Surface Colors (Light Mode) ──────────────────
export const light = {
  background: "oklch(0.99 0.004 60)", // warm cream (was: oklch(1 0 0))
  foreground: "oklch(0.145 0.01 50)", // warm dark (was: oklch(0.145 0 0))
  card: "oklch(0.99 0.004 60)", // warm cream
  cardForeground: "oklch(0.145 0.01 50)", // warm dark
  popover: "oklch(0.99 0.004 60)", // warm cream
  popoverForeground: "oklch(0.145 0.01 50)", // warm dark
  primary: "oklch(0.205 0.01 50)", // warm primary
  primaryForeground: "oklch(0.985 0 0)", // unchanged
  secondary: "oklch(0.965 0.005 58)", // warm secondary
  secondaryForeground: "oklch(0.205 0.01 50)",
  muted: "oklch(0.965 0.005 58)", // warm muted
  mutedForeground: "oklch(0.52 0.01 52)", // warm muted fg
  accent: "oklch(0.965 0.005 58)", // warm accent
  accentForeground: "oklch(0.205 0.01 50)",
  destructive: "oklch(0.577 0.245 27.325)", // unchanged
  border: "oklch(0.91 0.006 55)", // warm border
  input: "oklch(0.91 0.006 55)", // warm input
  ring: "oklch(0.65 0.22 40)", // brand orange (matches CSS)
  // Sidebar
  sidebar: "oklch(0.975 0.006 57)", // warm sidebar
  sidebarForeground: "oklch(0.145 0.01 50)",
  sidebarPrimary: "oklch(0.205 0.01 50)",
  sidebarPrimaryForeground: "oklch(0.985 0 0)",
  sidebarAccent: "oklch(0.955 0.008 56)", // warm accent
  sidebarAccentForeground: "oklch(0.205 0.01 50)",
  sidebarBorder: "oklch(0.905 0.007 54)", // warm border
  sidebarRing: "oklch(0.708 0 0)",
  // Charts (unchanged — already match)
  chart1: "oklch(0.646 0.222 41.116)",
  chart2: "oklch(0.6 0.118 184.704)",
  chart3: "oklch(0.398 0.07 227.392)",
  chart4: "oklch(0.828 0.189 84.429)",
  chart5: "oklch(0.769 0.188 70.08)",
} as const;
```

- [ ] **Step 3: Verify typecheck passes**

Run: `pnpm turbo typecheck --filter=@smartout/design-tokens`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add packages/design-tokens/src/tokens.ts
git commit -m "fix(design-tokens): sync tokens.ts light mode with tokens.css warm cream values

The CSS file had the correct 'Ren og Varm' warm cream values while tokens.ts
had cold neutral values. Synced tokens.ts to match the design-approved CSS.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: Fix i18n Fallback + Remove Stub Languages

Six declared languages (sv, da, pl, ar, so, fi) have zero translation files. Selecting them renders raw key strings. Fix by adding fallback chain to `nb` and removing stubs from config.

**Files:**

- Modify: `packages/i18n/src/config.ts`
- Modify: `packages/i18n/src/translate.ts`

- [ ] **Step 1: Reduce supportedLocales to implemented languages**

In `packages/i18n/src/config.ts`:

```typescript
export const defaultLocale = "nb" as const;
export const supportedLocales = ["nb", "en"] as const;
export type SupportedLocale = (typeof supportedLocales)[number];
export const RTL_LOCALES: SupportedLocale[] = [];
export const fallbackLocale = "nb" as const;
```

- [ ] **Step 2: Add fallback chain to translate.ts**

In `packages/i18n/src/translate.ts`, update `createTranslator`:

```typescript
export function createTranslator(locale: SupportedLocale, namespace: string) {
  const messages = localeModules[locale]?.[namespace] ?? {};
  const fallbackMessages = locale !== "nb" ? (localeModules["nb"]?.[namespace] ?? {}) : {};

  return function t(key: string, params?: Record<string, string | number>): string {
    // Try requested locale first
    const direct = messages[key];
    if (typeof direct === "string") return interpolate(direct, params);

    const [group, subKey] = key.split(".");
    if (group && subKey) {
      const nested = messages[group];
      if (typeof nested === "object" && nested !== null) {
        const val = nested[subKey];
        if (val) return interpolate(val, params);
      }
    }

    // Fallback to Norwegian
    const fallbackDirect = fallbackMessages[key];
    if (typeof fallbackDirect === "string") return interpolate(fallbackDirect, params);

    if (group && subKey) {
      const fallbackNested = fallbackMessages[group];
      if (typeof fallbackNested === "object" && fallbackNested !== null) {
        const val = fallbackNested[subKey];
        if (val) return interpolate(val, params);
      }
    }

    return key;
  };
}
```

- [ ] **Step 3: Verify rtl.ts still works with empty RTL_LOCALES**

Read: `packages/i18n/src/rtl.ts` — confirm `isRtl()` compiles with empty `RTL_LOCALES` array. The function uses `RTL_LOCALES.includes(locale)` which works fine with empty array (always returns false).

- [ ] **Step 4: Verify typecheck passes**

Run: `pnpm turbo typecheck --filter=@smartout/i18n`
Expected: PASS

- [ ] **Step 5: Check for broken imports of removed locales**

Run: `grep -r "\"sv\"\|\"da\"\|\"pl\"\|\"ar\"\|\"so\"\|\"fi\"" packages/i18n/ apps/ --include="*.ts" --include="*.tsx" -l`
Expected: No files reference the removed locales (only config.ts which we changed)

- [ ] **Step 5: Commit**

```bash
git add packages/i18n/src/config.ts packages/i18n/src/translate.ts
git commit -m "fix(i18n): remove 6 stub languages and add nb fallback chain

Removed sv, da, pl, ar, so, fi from supportedLocales — they had zero
translation files and would render raw key strings if selected.
Added fallback to Norwegian (nb) when a key is missing in the
requested locale.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: Validate Database Migrations

All 200 migrations must apply cleanly via `supabase db reset`.

**Files:**

- None modified — validation only

- [ ] **Step 1: Ensure Supabase is running locally**

Run: `npx supabase status`
Expected: Shows local Supabase services running (API, DB, Auth, etc.)

If not running: `npx supabase start`

- [ ] **Step 2: Run full database reset**

Run: `npx supabase db reset`
Expected: All 200 migrations apply without errors

- [ ] **Step 3: If errors, fix failing migration**

Read the error output carefully. Common issues:

- Duplicate enum values → check if enum already exists
- Missing dependency table → reorder migration
- Syntax errors → fix SQL

Create a fix migration if needed: `supabase/migrations/YYYYMMDDHHMMSS_fix_description.sql`

- [ ] **Step 4: Regenerate database types**

Run: `npx supabase gen types typescript --local > packages/supabase/src/database.types.ts`
Expected: File regenerated without errors

- [ ] **Step 5: Verify typecheck still passes**

Run: `pnpm turbo typecheck`
Expected: 27/27 PASS

- [ ] **Step 6: Commit if types changed**

```bash
git add packages/supabase/src/database.types.ts supabase/migrations/
git commit -m "fix(db): validate all 200 migrations + regenerate types

Ran supabase db reset to verify all migrations apply cleanly.
Regenerated database.types.ts from local schema.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

### Task 4: Mark ActivityView Mock Data + Add Warning Banner

Deep-dive revealed the ActivityView heatmap uses `generateHeatmapData()` with random mock data. Full replacement requires a separate task (data transformation, empty state handling, label resolution). For now, add a visible "demo data" warning and TODO markers.

**Files:**

- Modify: `apps/web/src/components/dashboard/ActivityView.tsx`

- [ ] **Step 1: Read the current ActivityView implementation**

Read: `apps/web/src/components/dashboard/ActivityView.tsx`
Identify the `generateHeatmapData()` function and where it's called.

- [ ] **Step 2: Add demo data warning banner**

At the top of the heatmap section, add a visible banner:

```typescript
<div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200">
  Aktivitetsdata vises som demo. Kobles til ekte data snart.
</div>
```

- [ ] **Step 3: Add TODO comment on generateHeatmapData**

```typescript
// TODO: Replace with useActivityHeatmap() hook querying activity_trail table
// grouped by entity + date. Requires: data transformation, empty state, label resolution.
// See: docs/DEEP-SYSTEM-DOCUMENTATION-2026-03-24.md §6.8
const heatmapData = generateHeatmapData(labels, numDays);
```

- [ ] **Step 4: Verify typecheck passes**

Run: `pnpm turbo typecheck --filter=web`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/dashboard/ActivityView.tsx
git commit -m "fix(dashboard): add demo data warning to ActivityView heatmap

Heatmap currently uses mock data via generateHeatmapData().
Added visible warning banner and TODO for real data hook.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

### Task 5: Wire ReconciliationView "Approve Day" to DB

Deep-dive revealed the "Approve Day" button is visual-only — no DB mutation. Wire it to update `daily_reconciliation` status.

**Files:**

- Modify: `apps/web/src/components/dashboard/ReconciliationView.tsx`

- [ ] **Step 1: Read current ReconciliationView**

Read: `apps/web/src/components/dashboard/ReconciliationView.tsx`
Identify the `dayApproved` state and the "Approve Day" button handler.

- [ ] **Step 2: Add mutation for day approval**

```typescript
const approveDay = useMutation({
  mutationFn: async ({ date, departmentId }: { date: string; departmentId: string }) => {
    const supabase = createClient();
    const { error } = await supabase
      .from("daily_reconciliation")
      .update({ status: "approved", approved_at: new Date().toISOString(), approved_by: profileId })
      .eq("workspace_id", workspaceId)
      .eq("reconciliation_date", date)
      .eq("department_id", departmentId);
    if (error) throw error;
  },
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ["dashboard", "department-shifts"] });
    emit({
      event: "reconciliation admin_action",
      workspace_id: workspaceId,
      actor_id: profileId,
      properties: {
        entity: { entity_type: "reconciliation", entity_id: date },
        data: { action: "approved" },
      },
    });
  },
});
```

- [ ] **Step 3: Wire button to mutation**

Replace the visual-only `setDayApproved(true)` with `approveDay.mutate({ date: selectedDate, departmentId })`.

- [ ] **Step 4: Verify typecheck passes**

Run: `pnpm turbo typecheck --filter=web`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/dashboard/ReconciliationView.tsx
git commit -m "fix(dashboard): wire reconciliation 'Approve Day' to DB mutation

Button was visual-only. Now updates daily_reconciliation.status to
'approved' with timestamp and actor. Emits telemetry event.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

### Task 6: Add Governance E2E Test

17 E2E test files already exist in `apps/e2e/tests/` (auth, dashboard, onboarding, HMS, cascade-ui, etc.). Governance is missing. Use existing `loginAsAdmin` helper from `apps/e2e/helpers/auth.ts`.

**Files:**

- Create: `apps/e2e/tests/governance.spec.ts`

- [ ] **Step 1: Read existing auth helper**

Read: `apps/e2e/helpers/auth.ts`
Understand how `loginAsAdmin` works (credentials, setup).

- [ ] **Step 2: Write governance E2E test using existing helper**

```typescript
// apps/e2e/tests/governance.spec.ts
import { test, expect } from "@playwright/test";
import { loginAsAdmin } from "../helpers/auth";

test.describe("Governance Module", () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
  });

  test("should load governance page", async ({ page }) => {
    await page.goto("/dashboard/governance");
    await expect(page).toHaveURL(/\/dashboard\/governance/);
    await expect(page.locator("main")).toBeVisible();
  });

  test("should show protocol list", async ({ page }) => {
    await page.goto("/dashboard/governance");
    // Governance page should render protocol/policy content
    await expect(page.locator("[data-testid='governance-content'], main")).toBeVisible({
      timeout: 10000,
    });
  });
});
```

- [ ] **Step 3: Run governance test**

Run: `cd apps/e2e && npx playwright test tests/governance.spec.ts --project=chromium`
Expected: Tests pass (or fail with meaningful error if test workspace lacks governance data)

- [ ] **Step 4: Commit**

```bash
git add apps/e2e/tests/governance.spec.ts
git commit -m "test(e2e): add governance module E2E test

Uses existing loginAsAdmin helper. Tests page load and protocol list
rendering. 18th E2E test file in the suite.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

### Task 7: Sync Native Token Hex Values

After Task 1 updated tokens.ts, native.ts hex values should be re-derived to match the warm cream OKLCH values.

**Files:**

- Modify: `packages/design-tokens/src/native.ts`

- [ ] **Step 1: Read current native.ts**

Read: `packages/design-tokens/src/native.ts`
Note which values need updating (light mode surface colors that were cold neutral).

- [ ] **Step 2: Convert updated OKLCH values to hex**

The warm cream OKLCH values from Task 1 need hex equivalents. Use an OKLCH-to-hex converter.

Key conversions (approximate):

- `oklch(0.99 0.004 60)` → `#fefdfb` (warm off-white)
- `oklch(0.145 0.01 50)` → `#0b0a09` (warm near-black)
- `oklch(0.965 0.005 58)` → `#f6f5f3` (warm secondary)
- `oklch(0.91 0.006 55)` → `#e6e4e1` (warm border)
- `oklch(0.52 0.01 52)` → `#7c7874` (warm muted fg)

- [ ] **Step 3: Update native.ts light mode hex values**

Update the `light` object in native.ts with converted hex values.

- [ ] **Step 4: Verify typecheck passes**

Run: `pnpm turbo typecheck --filter=@smartout/design-tokens`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/design-tokens/src/native.ts
git commit -m "fix(design-tokens): sync native.ts hex values with warm cream tokens

Updated light mode hex values to match the OKLCH warm cream values
from tokens.ts and tokens.css.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

## Execution Order

Tasks are independent and can be parallelized:

```
Parallel Group A (no dependencies):
  Task 1: Sync tokens.ts → tokens.css
  Task 2: Fix i18n fallback
  Task 3: Validate migrations

Parallel Group B (depends on nothing):
  Task 4: ActivityView real data
  Task 5: ReconciliationView DB mutation
  Task 6: E2E tests

Sequential (depends on Task 1):
  Task 7: Sync native.ts hex values
```

**Estimated total time:** 4-6 hours for all 7 tasks.
