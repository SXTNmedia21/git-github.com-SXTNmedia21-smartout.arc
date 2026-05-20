# SM-3 — Planlegging Hub Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enable the Planlegging sidebar item (`/dashboard/planning`) and wire its four canonical tabs — Kalender · Årshjul · Eventer · Bookings — by reusing the already-built `/dashboard/calendar` surface. The existing `/dashboard/calendar` page has all four tabs implemented with real data. SM-3 = create the canonical URL, redirect legacy routes, and flip the sidebar entry from `disabled: true` to live. Zero new data-fetching, zero schema changes.

**Architecture:** Create `/dashboard/planning/page.tsx` as a thin server wrapper that renders the same `CalendarPageShell` already used by `/dashboard/calendar/page.tsx`. Create `/dashboard/planning/kalender/`, `/dashboard/planning/arshjul/`, `/dashboard/planning/eventer/`, `/dashboard/planning/bookings/` as route-segment shims that each redirect to the parent page with a `?tab=<value>` search param (matching the tab-switching logic already in `CalendarPageShell`). Update `sidebar-config.ts`: flip Planlegging to `status: "live"`, `disabled: false`, add `compositeActive: ["/dashboard/calendar"]` so legacy deep-links keep the sidebar entry highlighted. Keep `/dashboard/calendar` alive — no deletions. Add `PLANNING_TAB_DEFS` in `_lib/planning-tabs.ts` mirroring the SM-2 `people-tabs.ts` shape.

**Key recon finding:** `/dashboard/calendar/page.tsx` wraps `CalendarPageShell`, which already renders all four tabs (Kalender, Årshjul, Eventer, Bookinger) with full state, framer-motion transitions, CalendarToolsBridge, and real data hooks. The `TABS` constant inside `CalendarPageShell` uses the four tab values: `"calendar"`, `"year-wheel"`, `"events"`, `"bookings"`. The search-param `?tab=<value>` pattern is already handled via `useSearchParams` inside the shell for the `?new=event` / `?new=booking` flow — the tab=X redirect will use the same `useSearchParams` read already in place; we extend it one more branch.

**Tech Stack:** Next.js 16 App Router, React 19 server components, TypeScript strict. No new dependencies, no migrations, no new DB tables.

**Canonical spec:** `docs/design/sitemap/web/00-CANONICAL.md` §3 (tabs map), §8 (cascade D4+D5), §12 (SM-3 migration row).

**Scope deferred:** Moving `/dashboard/year-wheel` and `/dashboard/season` to live under `/dashboard/planning/*` as canonical children. This is a follow-up sortie (SM-3-followup-absorb). Year-wheel is surfaced as the Årshjul tab inside the shell (already wired via `YearWheelLazy` dynamic import). Season route stays untouched.

---

## File Structure

| Operation | Path | Responsibility |
|---|---|---|
| Create | `apps/web/src/app/dashboard/planning/page.tsx` | Canonical `/dashboard/planning` server shell — `resolveDashboardContext` + renders `CalendarPageShell`. Mirrors `calendar/page.tsx` exactly. |
| Create | `apps/web/src/app/dashboard/planning/loading.tsx` | Skeleton fallback — copy of `calendar/loading.tsx`. |
| Create | `apps/web/src/app/dashboard/planning/kalender/page.tsx` | Route shim — redirects to `/dashboard/planning?tab=calendar`. |
| Create | `apps/web/src/app/dashboard/planning/arshjul/page.tsx` | Route shim — redirects to `/dashboard/planning?tab=year-wheel`. |
| Create | `apps/web/src/app/dashboard/planning/eventer/page.tsx` | Route shim — redirects to `/dashboard/planning?tab=events`. |
| Create | `apps/web/src/app/dashboard/planning/bookings/page.tsx` | Route shim — redirects to `/dashboard/planning?tab=bookings`. |
| Create | `apps/web/src/app/dashboard/_lib/planning-tabs.ts` | `PLANNING_TAB_DEFS` constant — mirrors `people-tabs.ts` shape. |
| Modify | `apps/web/src/app/dashboard/calendar/_components/CalendarPageShell.tsx` | Extend `useEffect` to read `?tab=<value>` and call `setActiveTab`. One-shot on mount. |
| Modify | `apps/web/src/components/dashboard/sidebar-config.ts` | Flip Planlegging: `disabled: false`, `status: "live"`, add `compositeActive: ["/dashboard/calendar"]`. |
| Modify | `packages/i18n/locales/nb/dashboard.json` | Append 5 keys: `planning.tab_kalender`, `planning.tab_arshjul`, `planning.tab_eventer`, `planning.tab_bookings`, `planning.page_description`. |
| Modify | `packages/i18n/locales/en/dashboard.json` | Same 5 keys, English values. |
| Modify | `docs/design/sitemap/web/00-CANONICAL.md` | Mark SM-3 ✅ in §12 migration table. |

No deletions. No file moves. `/dashboard/calendar` stays alive as a registered compositeActive route.

---

## Phase A — Tab-query-param wiring in CalendarPageShell

### Task A1: Extend `useEffect` to accept `?tab=<value>` search param

**Files:**
- Modify: `apps/web/src/app/dashboard/calendar/_components/CalendarPageShell.tsx`

The shell already reads `useSearchParams()` and has a `useEffect` keyed on `newAction`. We add a parallel branch that reads `?tab=<value>` and calls `setActiveTab`.

**Why this phase is first:** The sub-page shims in Phase B redirect to `?tab=<value>`. If the shell doesn't consume that param, clicking Årshjul sub-page would land on Kalender tab. This one-shot read makes deep links work without server-side state.

- [ ] **Step 1: Read the existing useEffect in CalendarPageShell**

Run: `grep -n 'newAction\|useEffect\|searchParams\|setActiveTab' apps/web/src/app/dashboard/calendar/_components/CalendarPageShell.tsx | head -20`

Expected: confirms `newAction` useEffect at roughly lines 119–133 and `setActiveTab` state setter.

- [ ] **Step 2: Locate the exact `useEffect` block**

Run: `sed -n '115,135p' apps/web/src/app/dashboard/calendar/_components/CalendarPageShell.tsx`

Identify the open + close lines of the existing `useEffect` block. We will extend it (not add a second one) to also handle `tab`.

- [ ] **Step 3: Edit the useEffect**

In the existing `useEffect` body, add a `tabParam` branch BEFORE the `newAction` block. The valid tab values are `"calendar"`, `"year-wheel"`, `"events"`, `"bookings"` — exactly matching the `TABS` const already in the file.

Replace the existing `useEffect` with:

```tsx
useEffect(() => {
  // One-shot tab deep-link — consumed from ?tab=<value> then cleared.
  // Used by /dashboard/planning/arshjul etc. shim redirects.
  const tabParam = searchParams?.get("tab");
  const VALID_TABS = ["calendar", "year-wheel", "events", "bookings"] as const;
  if (tabParam && (VALID_TABS as readonly string[]).includes(tabParam)) {
    setActiveTab(tabParam);
    router.replace("/dashboard/planning", { scroll: false });
  }

  // Legacy action params — unchanged.
  if (newAction === "event") {
    setEventDraft({
      date: formatISO(new Date(), { representation: "date" }),
      startHour: 9,
      endHour: 10,
    });
    setEventSheetOpen(true);
    router.replace("/dashboard/calendar", { scroll: false });
  } else if (newAction === "booking") {
    setBookingDraft(null);
    setBookingSheetOpen(true);
    router.replace("/dashboard/calendar", { scroll: false });
  }
}, [newAction, router, searchParams]);
```

**Note:** The `router.replace` in the tab branch uses `/dashboard/planning` (the new canonical URL). If the user arrived via `/dashboard/calendar?tab=...`, the replace is still fine — it just clears the param. Adjust the clear target if needed: if `pathname` is available, use `router.replace(pathname, { scroll: false })` for path-agnostic clearing.

**Import check:** `searchParams` is already declared above via `useSearchParams()`. No new imports needed.

- [ ] **Step 4: Typecheck**

```bash
pnpm --filter @smartout/web tsc --noEmit 2>&1 | tail -5
```

Expected: 0 errors.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/app/dashboard/calendar/_components/CalendarPageShell.tsx
git commit -m "feat(planning): extend CalendarPageShell to consume ?tab= deep-link param (SM-3 phase A)

Enables /dashboard/planning/arshjul → ?tab=year-wheel deep-link
routing. One-shot on mount; clears param after applying.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

**Self-Review:**
- [ ] `useEffect` deps array still includes `searchParams` (already was; confirm no removal)
- [ ] `VALID_TABS` guard prevents arbitrary `setActiveTab` calls from malformed params
- [ ] Both branches (`tabParam` + `newAction`) can coexist — but `tabParam` takes precedence (it runs first). If a URL has both, tabParam wins. Acceptable edge case.

---

## Phase B — Planlegging page shell

### Task B1: Create `/dashboard/planning/page.tsx`

**Files:**
- Create: `apps/web/src/app/dashboard/planning/page.tsx`

Thin server wrapper. Identical structure to `calendar/page.tsx` — `resolveDashboardContext` auth/redirect gate, then renders `CalendarPageShell` inside a `Suspense` boundary. The shell owns all UI state.

- [ ] **Step 1: Read the existing calendar/page.tsx**

Run: `cat apps/web/src/app/dashboard/calendar/page.tsx`

Confirm it is a `withPagePerf` wrapper around `resolveDashboardContext` + `CalendarPageShell` in `Suspense`. We mirror it exactly.

- [ ] **Step 2: Confirm the directory does not exist**

Run: `ls apps/web/src/app/dashboard/planning 2>&1`

Expected: `No such file or directory`. If it exists, inspect before writing.

- [ ] **Step 3: Create planning/page.tsx**

Path: `apps/web/src/app/dashboard/planning/page.tsx`

```tsx
// ============================================
// planning/page.tsx
// Planlegging hub — canonical URL for the planning surface.
//
// Renders CalendarPageShell (shared with /dashboard/calendar).
// Tabs: Kalender | Årshjul | Eventer | Bookings
//
// Deep-link sub-routes (/planning/kalender etc.) redirect here
// with ?tab=<value>. The shell consumes the param and clears it.
//
// Canonical spec: docs/design/sitemap/web/00-CANONICAL.md §3
// Cascade alignment: D4 (Demand Signal) + D5 (Service Concept)
// SM-3 — /dashboard/calendar compositeActive preserves legacy URL.
// ============================================

import { Suspense } from "react";
import { resolveDashboardContext } from "../_data/resolve-page-context";
import { withPagePerf } from "@/lib/page-perf";
import { CalendarPageShell } from "../calendar/_components/CalendarPageShell";
import PlanningLoading from "./loading";

export default withPagePerf(async function PlanningPage() {
  await resolveDashboardContext();

  return (
    <Suspense fallback={<PlanningLoading />}>
      <CalendarPageShell />
    </Suspense>
  );
});
```

- [ ] **Step 4: Typecheck**

```bash
pnpm --filter @smartout/web tsc --noEmit 2>&1 | tail -5
```

Expected: 0 errors. If the relative import to `../calendar/_components/CalendarPageShell` fails, check that the shell exports `CalendarPageShell` as a named export (confirmed: `export function CalendarPageShell()`).

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/app/dashboard/planning/page.tsx
git commit -m "feat(planning): add /dashboard/planning canonical page shell (SM-3 phase B)

Reuses CalendarPageShell — all four tabs (Kalender/Årshjul/Eventer/
Bookings) are live immediately. Duplicate render of /calendar until
sidebar compositeActive is wired in Phase E.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

### Task B2: Create `/dashboard/planning/loading.tsx`

**Files:**
- Create: `apps/web/src/app/dashboard/planning/loading.tsx`

- [ ] **Step 1: Read the calendar loading skeleton for reference**

Run: `cat apps/web/src/app/dashboard/calendar/loading.tsx`

- [ ] **Step 2: Create planning/loading.tsx**

Copy the calendar loading skeleton. Change the function name to `PlanningLoading`.

Path: `apps/web/src/app/dashboard/planning/loading.tsx`

```tsx
export default function PlanningLoading() {
  return (
    <div className="relative flex h-full min-h-0 flex-1 flex-col p-4 pt-1 md:p-6 md:pt-3">
      <div className="mb-5">
        <div className="bg-muted h-8 w-40 animate-pulse rounded" />
        <div className="bg-muted mt-2 h-4 w-64 animate-pulse rounded" />
      </div>
      <div className="bg-muted mb-5 h-10 w-full animate-pulse rounded-xl" />
      <div className="bg-card border-border min-h-0 flex-1 animate-pulse rounded-2xl border shadow-sm" />
    </div>
  );
}
```

If the original `calendar/loading.tsx` has a more detailed skeleton, use that verbatim and rename the function.

- [ ] **Step 3: Typecheck + commit**

```bash
pnpm --filter @smartout/web tsc --noEmit 2>&1 | tail -3
git add apps/web/src/app/dashboard/planning/loading.tsx
git commit -m "feat(planning): add Planlegging loading skeleton (SM-3 phase B)

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

## Phase C — Sub-page route shims

Sub-page shims let users bookmark `/dashboard/planning/arshjul` and land on the correct tab. Each shim is a one-line server component that calls `redirect()`.

**Decision:** Use `redirect()` (permanent 307 in Next.js 16 dev, adapts to 301 in prod where applicable). The target URL `/dashboard/planning?tab=<value>` is consumed by the `useEffect` in Phase A. After the shell clears the param, the browser address bar shows `/dashboard/planning`.

### Task C1: Create Kalender shim

**Files:**
- Create: `apps/web/src/app/dashboard/planning/kalender/page.tsx`

- [ ] **Step 1: Create the shim**

Path: `apps/web/src/app/dashboard/planning/kalender/page.tsx`

```tsx
import { redirect } from "next/navigation";

// Deep-link shim — Kalender is the default tab; redirect to parent.
export default function PlanningKalenderPage() {
  redirect("/dashboard/planning");
}
```

No `?tab=calendar` needed — Kalender is the default tab (`activeTab` initialises to `"calendar"`).

---

### Task C2: Create Årshjul shim

**Files:**
- Create: `apps/web/src/app/dashboard/planning/arshjul/page.tsx`

- [ ] **Step 1: Create the shim**

Path: `apps/web/src/app/dashboard/planning/arshjul/page.tsx`

```tsx
import { redirect } from "next/navigation";

// Deep-link shim — redirects to Planlegging shell with Årshjul tab active.
export default function PlanningArshjulPage() {
  redirect("/dashboard/planning?tab=year-wheel");
}
```

---

### Task C3: Create Eventer shim

**Files:**
- Create: `apps/web/src/app/dashboard/planning/eventer/page.tsx`

Path: `apps/web/src/app/dashboard/planning/eventer/page.tsx`

```tsx
import { redirect } from "next/navigation";

// Deep-link shim — redirects to Planlegging shell with Eventer tab active.
export default function PlanningEventerPage() {
  redirect("/dashboard/planning?tab=events");
}
```

---

### Task C4: Create Bookings shim

**Files:**
- Create: `apps/web/src/app/dashboard/planning/bookings/page.tsx`

Path: `apps/web/src/app/dashboard/planning/bookings/page.tsx`

```tsx
import { redirect } from "next/navigation";

// Deep-link shim — redirects to Planlegging shell with Bookings tab active.
export default function PlanningBookingsPage() {
  redirect("/dashboard/planning?tab=bookings");
}
```

---

### Task C5: Typecheck all shims + commit batch

- [ ] **Step 1: Typecheck**

```bash
pnpm --filter @smartout/web tsc --noEmit 2>&1 | tail -5
```

Expected: 0 errors. If Next.js complains that `redirect()` is called inside a sync component, add `async` keyword to the function signature (`export default async function ...`).

- [ ] **Step 2: Commit all four shims together**

```bash
git add \
  apps/web/src/app/dashboard/planning/kalender/page.tsx \
  apps/web/src/app/dashboard/planning/arshjul/page.tsx \
  apps/web/src/app/dashboard/planning/eventer/page.tsx \
  apps/web/src/app/dashboard/planning/bookings/page.tsx
git commit -m "feat(planning): add sub-page route shims for tab deep-links (SM-3 phase C)

/planning/kalender → /planning (default)
/planning/arshjul  → /planning?tab=year-wheel
/planning/eventer  → /planning?tab=events
/planning/bookings → /planning?tab=bookings

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

**Self-Review:**
- [ ] All four files use `redirect()` from `"next/navigation"` (not `next/router`)
- [ ] Årshjul shim uses `?tab=year-wheel` (matching the exact `TABS` value `"year-wheel"` in `CalendarPageShell`)
- [ ] Eventer shim uses `?tab=events` (not `"eventer"` — match the internal tab value, not the URL segment)
- [ ] Bookings shim uses `?tab=bookings`

---

## Phase D — PLANNING_TAB_DEFS

### Task D1: Create `_lib/planning-tabs.ts`

**Files:**
- Create: `apps/web/src/app/dashboard/_lib/planning-tabs.ts`

Mirrors the `people-tabs.ts` shape established in SM-2. Used by any future `PageTabNav variant="route"` wiring if the planning page switches to route-based tabs (deferred — current implementation uses the inline `TABS` const inside `CalendarPageShell`).

- [ ] **Step 1: Read people-tabs.ts for type shape reference**

Run: `cat apps/web/src/app/dashboard/_lib/people-tabs.ts`

Expected: `PeopleTabDef` type with `key: string`, `label: string`, `icon: ComponentType<SVGProps<SVGSVGElement>>`.

- [ ] **Step 2: Create planning-tabs.ts**

Path: `apps/web/src/app/dashboard/_lib/planning-tabs.ts`

```ts
import { CalendarDays, Sparkles, ListTree, Users } from "lucide-react";
import type { ComponentType, SVGProps } from "react";

export type PlanningTabDef = {
  key: string;
  label: string;
  icon: ComponentType<SVGProps<SVGSVGElement>>;
};

/**
 * Planlegging hub tab definitions per docs/design/sitemap/web/00-CANONICAL.md §3.
 *
 * Tab keys match the CalendarPageShell `TABS` values and the ?tab= search param.
 * Sub-page shims at /planning/arshjul etc. redirect to /planning?tab=<key>.
 *
 * Cascade alignment:
 *   - Kalender: D4 (planning_event) + K1a (public_holiday)
 *   - Årshjul:  D4 (season_budget, planning_cycle, day_factor) + D5 (workspace config)
 *   - Eventer:  D4 (planning_event table — event list view)
 *   - Bookings: D4 / future booking_integration source
 *
 * Note: "Bookinger" is the Norwegian form (spec §3 uses "Bookings" in English tab label;
 * the CalendarPageShell uses "Bookinger" in Norwegian. i18n key controls the display label.
 *
 * Dropped from Planlegging per spec §3.3:
 *   - Season detail page (/dashboard/season/[seasonId]) — still orphan; absorbed in
 *     SM-3-followup-absorb when year-wheel moves under /planning.
 *   - Setup-veiviser — first-run modal flow; deferred to SM-3-followup-setup-wizard.
 */
export const PLANNING_TAB_DEFS: readonly PlanningTabDef[] = [
  { key: "calendar", label: "Kalender", icon: CalendarDays },
  { key: "year-wheel", label: "Årshjul", icon: Sparkles },
  { key: "events", label: "Eventer", icon: ListTree },
  { key: "bookings", label: "Bookings", icon: Users },
] as const;
```

**Icon note:** `Sparkles`, `ListTree`, and `Users` must exist in the installed lucide-react version. Verify:

```bash
node -e "const l = require('lucide-react'); console.log(!!l.Sparkles, !!l.ListTree, !!l.Users)"
```

These are the same icons already used in `CalendarPageShell.tsx` TABS constant — they are confirmed present.

- [ ] **Step 3: Typecheck + commit**

```bash
pnpm --filter @smartout/web tsc --noEmit 2>&1 | tail -5
git add apps/web/src/app/dashboard/_lib/planning-tabs.ts
git commit -m "feat(planning): add PLANNING_TAB_DEFS to _lib (SM-3 phase D)

Tab definitions mirror CalendarPageShell TABS const. Serves as
canonical reference for planning tab structure. Future PageTabNav
variant=route wiring reads from here.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

## Phase E — Sidebar config update

### Task E1: Flip Planlegging to live in `sidebar-config.ts`

**Files:**
- Modify: `apps/web/src/components/dashboard/sidebar-config.ts`

- [ ] **Step 1: Read current Planlegging entry**

Run: `grep -n -A5 'group_planlegging\|item_planlegging\|/dashboard/planning' apps/web/src/components/dashboard/sidebar-config.ts`

Expected output confirms:
```ts
{
  labelKey: "sidebar.item_planlegging",
  href: "/dashboard/planning",
  icon: CalendarRange,
  status: "not-yet-built",
  disabled: true,
},
```

- [ ] **Step 2: Edit the Planlegging item**

Change:
```ts
{
  labelKey: "sidebar.item_planlegging",
  href: "/dashboard/planning",
  icon: CalendarRange,
  status: "not-yet-built",
  disabled: true,
},
```

To:
```ts
{
  labelKey: "sidebar.item_planlegging",
  href: "/dashboard/planning",
  icon: CalendarRange,
  status: "live",
  compositeActive: ["/dashboard/calendar"],
},
```

**Why `compositeActive: ["/dashboard/calendar"]`:** The existing Vaktplan item already has `compositeActive: ["/dashboard/calendar"]`. We need to MOVE that compositeActive from Vaktplan to Planlegging — Kalender is a Planlegging surface, not a Vaktplan surface. Vaktplan's compositeActive should become empty (or removed).

- [ ] **Step 3: Also remove `/dashboard/calendar` from Vaktplan compositeActive**

Find the Vaktplan entry:
```ts
{
  labelKey: "sidebar.item_vaktplan",
  href: "/dashboard/schedule",
  icon: CalendarDays,
  status: "live",
  compositeActive: ["/dashboard/calendar"],
},
```

Change to:
```ts
{
  labelKey: "sidebar.item_vaktplan",
  href: "/dashboard/schedule",
  icon: CalendarDays,
  status: "live",
},
```

**Rationale:** The canonical spec §3 assigns Kalender to Planlegging (D4+D5), not Vaktplan (D6). The previous `compositeActive` was a placeholder from before Planlegging was built. Moving it corrects the sidebar highlight behavior.

- [ ] **Step 4: Typecheck**

```bash
pnpm --filter @smartout/web tsc --noEmit 2>&1 | tail -5
```

Expected: 0 errors.

- [ ] **Step 5: Verify sidebar-config test still passes (if a test file exists)**

Run: `ls apps/web/src/components/dashboard/__tests__/sidebar-config.test.ts 2>&1`

If exists: `pnpm --filter @smartout/web test -- sidebar-config 2>&1 | tail -15`

If a test asserts the Vaktplan compositeActive array includes `/dashboard/calendar`, update the test expectation to match the new Planlegging compositeActive.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/components/dashboard/sidebar-config.ts apps/web/src/components/dashboard/__tests__/sidebar-config.test.ts
git commit -m "feat(sidebar): enable Planlegging — disabled→live, move /calendar compositeActive (SM-3 phase E)

/dashboard/planning is now a live sidebar item. compositeActive moved
from Vaktplan to Planlegging per spec §3 (calendar = D4, not D6).

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

If no test file changed, omit from `git add`.

**Self-Review:**
- [ ] `disabled: true` removed (not just set to `false`)
- [ ] `status` changed from `"not-yet-built"` to `"live"`
- [ ] `compositeActive: ["/dashboard/calendar"]` added to Planlegging
- [ ] `compositeActive: ["/dashboard/calendar"]` removed from Vaktplan
- [ ] No other sidebar items changed

---

## Phase F — i18n

### Task F1: Append planning i18n keys

**Files:**
- Modify: `packages/i18n/locales/nb/dashboard.json`
- Modify: `packages/i18n/locales/en/dashboard.json`

- [ ] **Step 1: Check for existing planning.* keys**

Run: `grep '"planning\.' packages/i18n/locales/nb/dashboard.json | head -10`

Expected: no output (no existing `planning.*` keys). If keys exist, skip adding duplicates.

- [ ] **Step 2: Add to nb/dashboard.json**

Append (or insert alphabetically in the relevant block):

```json
"planning.tab_kalender": "Kalender",
"planning.tab_arshjul": "Årshjul",
"planning.tab_eventer": "Eventer",
"planning.tab_bookings": "Bookings",
"planning.page_description": "Datoer, sesonger, eventer og bookinger på ett sted"
```

**Note:** The page description is already hardcoded in `CalendarPageShell.tsx` as a string: `"Datoer, sesonger, eventer og bookinger på ett sted"`. The i18n key is registered here for future wiring — the current sortie does not swap the hardcoded string (that would require editing the shared shell and falls outside "kun navigation" scope).

- [ ] **Step 3: Add same keys to en/dashboard.json**

```json
"planning.tab_kalender": "Calendar",
"planning.tab_arshjul": "Year Wheel",
"planning.tab_eventer": "Events",
"planning.tab_bookings": "Bookings",
"planning.page_description": "Dates, seasons, events and bookings in one place"
```

- [ ] **Step 4: Verify JSON parses**

```bash
node -e "JSON.parse(require('fs').readFileSync('packages/i18n/locales/nb/dashboard.json','utf8'))" && echo "nb OK"
node -e "JSON.parse(require('fs').readFileSync('packages/i18n/locales/en/dashboard.json','utf8'))" && echo "en OK"
```

Expected: `nb OK` + `en OK`, exit 0.

- [ ] **Step 5: Commit**

```bash
git add packages/i18n/locales/nb/dashboard.json packages/i18n/locales/en/dashboard.json
git commit -m "i18n(planning): add 5 keys for Planlegging hub tabs + page description (SM-3)

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

If commitlint rejects `i18n` type, fall back to `chore(planning)`.

---

## Phase G — Doc update

### Task G1: Mark SM-3 shipped in canonical spec

**Files:**
- Modify: `docs/design/sitemap/web/00-CANONICAL.md` (§12 migration table)

- [ ] **Step 1: Find SM-3 row**

Run: `grep -n 'SM-3' docs/design/sitemap/web/00-CANONICAL.md`

Expected: one row at the SM-3 line in §12.

- [ ] **Step 2: Update the row**

Change from:
```markdown
| **SM-3** | Planlegging hub — gather Kalender, Årshjul, Eventer, Bookings | M (5h) | `/planning` (new), absorbs `/year-wheel`, `/season` |
```

To:
```markdown
| **SM-3** ✅ | Planlegging hub — `/dashboard/planning` live, reuses CalendarPageShell (all 4 tabs). Sub-page shims for deep links. Sidebar compositeActive corrected. Absorb `/year-wheel` + `/season` deferred to SM-3-followup-absorb. | M (executed ~2h) | `/planning`, `/planning/kalender`, `/planning/arshjul`, `/planning/eventer`, `/planning/bookings`, `_lib/planning-tabs.ts`, `sidebar-config.ts`, i18n |
```

Then append a new row for the deferred absorb work:

```markdown
| **SM-3-followup-absorb** | Move `/dashboard/year-wheel` and `/dashboard/season/[seasonId]` to live under `/dashboard/planning/*` as canonical children. Requires updating year-wheel internal router.replace calls and season breadcrumb links. | M (3h) | `/year-wheel` → `/planning/year-wheel`, `/season` → `/planning/season` |
```

- [ ] **Step 3: Commit**

```bash
git add docs/design/sitemap/web/00-CANONICAL.md
git commit -m "docs(sitemap): mark SM-3 shipped, add SM-3-followup-absorb for route moves

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

## Verification Summary

Before declaring SM-3 shipped, confirm all of the following:

- [ ] `pnpm --filter @smartout/web tsc --noEmit` passes 0 errors
- [ ] Navigate `/dashboard/planning` — page loads, shows "Kalender" tab active with calendar grid
- [ ] Tab strip shows: Kalender · Årshjul · Eventer · Bookinger (4 tabs — note: label in shell is "Bookinger" Norwegian, i18n key says "Bookings"; both are acceptable until Phase G i18n wiring lands)
- [ ] Click Årshjul tab → year-wheel canvas loads (dynamic import from `YearWheelLazy`)
- [ ] Click Eventer tab → events list renders
- [ ] Click Bookinger tab → bookings list renders
- [ ] Navigate `/dashboard/planning/arshjul` → redirects to `/dashboard/planning` with Årshjul tab active
- [ ] Navigate `/dashboard/planning/eventer` → redirects to `/dashboard/planning` with Eventer tab active
- [ ] Navigate `/dashboard/planning/bookings` → redirects to `/dashboard/planning` with Bookinger tab active
- [ ] Navigate `/dashboard/planning/kalender` → redirects to `/dashboard/planning` with Kalender tab active (default)
- [ ] Sidebar: "Planlegging" item is **not** greyed out / disabled
- [ ] Sidebar: "Planlegging" item highlights when on `/dashboard/planning`
- [ ] Sidebar: "Planlegging" item highlights when on `/dashboard/calendar` (compositeActive)
- [ ] Sidebar: "Vaktplan" item does **not** highlight when on `/dashboard/calendar` (compositeActive removed)
- [ ] `/dashboard/calendar` still loads normally (no deletions, no regressions)
- [ ] `docs/design/sitemap/web/00-CANONICAL.md` §12 shows SM-3 ✅

Expected commit count: 8–10 commits.

---

## Out of Scope (deferred)

- **Route absorb (`SM-3-followup-absorb`):** Move `/dashboard/year-wheel` and `/dashboard/season/[sessionId]` under `/dashboard/planning/*` as canonical children. This requires updating `router.replace` calls inside `YearWheelPageClient` (currently replaces to `/dashboard/calendar`), updating any breadcrumb references, and adding redirects from old paths. Risk level: moderate — touches YearWheelPageClient internals.
- **Setup-veiviser tab:** The canonical spec §3 mentions a Setup-veiviser flow gated by `is_bootstrap_completed`. This is I1 bootstrap territory, not a simple tab shim. Deferred to SM-3-followup-setup-wizard.
- **Season detail integration:** `/dashboard/season/[seasonId]` is an orphan route accessed by year-wheel deep-links. Absorbing it into Planlegging hub requires the route-absorb sortie above.
- **CalendarPageShell hardcoded strings → i18n:** The shell has Norwegian strings hardcoded (`"Datoer, sesonger, eventer og bookinger på ett sted"`, `"I dag"`, `"Forrige"`, `"Neste"`, `"Innstillinger"`). Swapping these to `t()` calls is deferred — it modifies the shared shell and is outside "kun navigation" scope.
- **PageTabNav variant="route" migration for Planlegging:** The current shell uses `shadcn Tabs` with `PageTabNav` in `onChange` mode (internal state). Switching to `variant="route"` would make each tab a proper URL segment and remove the `?tab=` indirection. Deferred — requires restructuring the shell's state model. This sortie uses the simpler param approach.
- **Bookings source wiring:** The `Booking` type is currently in-memory / localStorage (per `calendar/_lib/types.ts` comment: "Future: likely become a domain table"). No DB table exists yet. SM-3 inherits this state unchanged.

---

## Rollback

If any phase needs reverting:

```bash
# Identify commits in this sortie
git log --oneline campaign/ui-shell ^<base-sha> -- \
  'apps/web/src/app/dashboard/planning/' \
  'apps/web/src/app/dashboard/calendar/_components/CalendarPageShell.tsx' \
  'apps/web/src/app/dashboard/_lib/planning-tabs.ts' \
  'apps/web/src/components/dashboard/sidebar-config.ts' \
  'packages/i18n/locales/' | head -15

# Revert range
git revert <first_sha>..<last_sha>
```

**Effect:** `/dashboard/planning` returns 404. Sidebar Planlegging re-disables. `/dashboard/calendar` continues working (the Phase A useEffect change is reverted but `?tab=` param simply has no consumer — harmless). No data lost — no DB changes were made.

**Single-file rollback (sidebar only):** If only the sidebar flip needs reverting (e.g. planning page has a bug but sidebar already went live), revert only the sidebar-config commit:

```bash
git revert <sidebar-config-commit-sha>
```

This re-disables the Planlegging item without touching the page files.
