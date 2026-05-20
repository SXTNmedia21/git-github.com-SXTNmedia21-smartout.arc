# SM-4 — Vaktplan Tab Structure Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wire the three-tab Vaktplan hub (`Vaktplan · Vaktbørs · Ferieplan`) per canonical spec §3. Add a `SCHEDULE_TAB_DEFS` constant, insert a `<PageTabNav variant="route">` strip into a new `schedule/layout.tsx`, link the existing Vaktbørs sub-route, create a Ferieplan sub-page reading `schedule_absence WHERE absence_type='vacation'`, and stub out the Tidslinjer view-mode toggle on each tab body. No drag-drop editor changes. No schema changes.

**Architecture:** New `schedule/layout.tsx` wraps all three tabs with the PageTabNav strip. The existing `schedule/page.tsx` (drag-drop editor, 1800+ LOC) becomes the Vaktplan tab body unchanged. `schedule/marketplace/` stays at its current URL and becomes the Vaktbørs tab body. A new `schedule/ferieplan/page.tsx` server component provides the Ferieplan tab body. View-mode state is local `useState` in each tab's client component — no URL binding. Tidslinjer option is visible but disabled with a tooltip until SM-6 ships the Gantt component.

**Tech Stack:** Next.js 16 App Router, React 19 server components + client islands, TypeScript strict, Lucide icons, Tailwind v4 CSS variables. No new npm dependencies. No migrations.

**Canonical spec:** `docs/design/sitemap/web/00-CANONICAL.md`
- §3 (tab map: `Vaktplan · Vaktbørs · Ferieplan`)
- §4 (Tidslinjer view-mode — toggle stub on each tab body; SM-6 ships the component)
- §4.2 (Tidslinjer appears on all three Vaktplan tabs)
- §6 (status-as-filter: `schedule_absence.absence_type='vacation'` → tab, not own sidebar item)

**SM-4 scope hard boundary:**
- Drag-drop editor in `schedule/page.tsx` — READ-ONLY, zero changes
- `schedule/marketplace/` — READ-ONLY, zero changes (linked from tab strip only)
- `schedule/proposed-plan/` — READ-ONLY (spec §13 O7 target, no changes here)
- Tidslinjer Gantt component — NOT in SM-4 (SM-6 scope)
- No new DB tables, no schema changes, no migration files

---

## Recon Findings

### 1. Current schedule/ structure

```
schedule/
  __density-sandbox/        dev sandbox — untouched
  _actions/                 server actions — untouched
  _components/              40+ client components — untouched (editor island)
  _hooks/                   22 hooks — untouched
  _utils/                   format-time.ts — untouched
  loading.tsx               Suspense skeleton for schedule root
  marketplace/              Vaktbørs (exists, auth-gated, manager+ only)
    _components/
    _hooks/
    loading.tsx
    page.tsx                server shell + Suspense → MarketplacePageClient
  pipeline/                 Shift pipeline admin view — untouched
    _components/
    loading.tsx
    page.tsx
  proposed-plan/            C2 agent proposals — untouched (spec §13 O7)
    _components/
    _hooks/
    loading.tsx
    page.tsx
  page.tsx                  LARGE client component (1800+ LOC) — drag-drop editor
```

No `layout.tsx` exists at `schedule/`. This means the layout shell is currently supplied by `apps/web/src/app/dashboard/layout.tsx` (the global dashboard layout). SM-4 introduces `schedule/layout.tsx` as a new layer.

**Risk:** The existing `schedule/marketplace/`, `schedule/pipeline/`, and `schedule/proposed-plan/` sub-routes are already children of the schedule segment — they will inherit the new `layout.tsx` automatically. Verify that the tab strip renders only on intended routes (Vaktplan / Vaktbørs / Ferieplan) and does not visually break the pipeline or proposed-plan sub-routes which are drawer/modal targets (spec §13 O7).

**Decision A (resolved):** The tab strip is introduced in `schedule/layout.tsx`, not injected into `schedule/page.tsx`. This means ALL sub-routes under `schedule/` inherit the strip. For `pipeline/` and `proposed-plan/` (which are panel/drawer targets), the tab strip will be present but harmless — they are accessed by in-page triggers, not by direct URL navigation. If future review finds the strip intrusive on pipeline/proposed-plan, a dedicated layout override can suppress it per Next.js route group convention. Log as known debt.

### 2. schedule_absence_type enum values (from database.types.ts)

```ts
"sick_leave" | "parental_leave" | "vacation" | "unpaid_leave" | "military" | "training" | "welfare"
```

Ferieplan tab filters on `absence_type = 'vacation'`. No `kind` column — the field is `absence_type` (enum). The spec note `schedule_absence WHERE kind=vacation` was shorthand; the actual column is `absence_type`.

### 3. schedule_absence table shape (relevant columns)

| Column | Type | Notes |
|---|---|---|
| `schedule_absence_id` | string (UUID PK) | |
| `workspace_id` | string (UUID FK) | RLS enforced |
| `employee_id` | string (UUID FK → profile.profile_id) | |
| `absence_type` | `schedule_absence_type` enum | filter: `vacation` |
| `status` | `absence_status` enum | `pending \| approved \| rejected` |
| `start_date` | string (date) | ISO date |
| `end_date` | string (date) | ISO date |
| `shift_date` | string (date) | pivot date for single-day |
| `is_full_day` | boolean | |
| `reason` | string \| null | |
| `created_at` | string | |
| `updated_at` | string | |

No join to `profile` inline — Ferieplan page will join via `employee_id → profile` to get `display_name`.

### 4. SM-2 pattern confirmed (already shipped)

`_lib/people-tabs.ts` with `PEOPLE_TAB_DEFS` + `PageTabNav variant="route"` (after SM-7 ships) driven by pathname match is the canonical pattern. SM-4 mirrors it exactly.

### 5. SM-7 dependency

SM-7 adds `variant="route"` to `PageTabNav`. SM-4 depends on SM-7 being merged before SM-4 ships. If SM-7 is not yet merged when SM-4 executes, the agent must implement `variant="route"` inline on `PageTabNav` first (identical to SM-7 Task 2) before wiring it in SM-4. Check at orientation step.

### 6. i18n — existing schedule keys

`packages/i18n/locales/nb/dashboard.json` has a `schedule` object at top level with sub-keys under `absence_approval` and `shell.schedule`. No tab label keys exist yet for `Vaktplan · Vaktbørs · Ferieplan` or view-mode labels at the tab level. SM-4 adds them under `schedule.tabs` and `schedule.view_mode`.

### 7. PageTabNav current usage pattern

`people-page-client.tsx` calls:
```tsx
<PageTabNav
  tabs={PEOPLE_TAB_DEFS.map((t) => ({ key: t.key, label: t.label, icon: t.icon }))}
  active={pathname ?? "/dashboard/people"}
  onChange={(href) => router.push(href)}
  ariaLabel="Ansatte-seksjoner"
/>
```

After SM-7, `variant="route"` + `basePath` replace the `onChange` / `active` pattern. SM-4 uses the SM-7 variant (or implements it inline if SM-7 unmerged).

---

## Open Decisions

| # | Question | Recommendation | Rationale |
|---|---|---|---|
| OD-1 | Tab strip placement: `layout.tsx` (wraps all sub-routes) vs inline in `page.tsx` (Vaktplan tab only)? | **layout.tsx** | Minimal code change. Tab strip naturally shared across sub-routes. pipeline/proposed-plan inheriting strip is harmless debt. |
| OD-2 | Tidslinjer disabled toggle: hidden until SM-6 vs. visible greyed-out with tooltip? | **Visible, greyed-out, tooltip "Bygges i SM-6"** | Communicates intent. Users see the roadmap. Zero confusion about missing feature. Consistent with how spec §4.3 describes the view-mode. |
| OD-3 | Ferieplan data: read `schedule_absence` via client hook or server component? | **Server component** — mirrors SM-2 Roller pattern: `resolveDashboardContext()` + Supabase query in RSC. Pass initial data to a thin client island for sorting/filtering. | Simpler, no TanStack Query key collision risk. SSR. Consistent with architecture (ADR-0021). |
| OD-4 | Ferieplan view-mode toggle placement? | **Top-right of tab body**, matching the canonical description in spec §4. Implemented as local `useState` in a `FeireplanTabBody` client component. | Spec §4.3 "view-mode toggle lives in the tab body, top-right." |
| OD-5 | Does `pipeline/` need the tab strip suppressed? | **No** (document as known debt). Pipeline is an admin-only audit surface accessed via in-page button, not direct URL entry. Strip is cosmetically neutral. If product review flags it, add a route group `(tabs)/` in a follow-up. | Avoids complexity in SM-4 scope. |

---

## File Structure

| Operation | Path | Responsibility |
|---|---|---|
| Create | `apps/web/src/app/dashboard/schedule/layout.tsx` | Server component layout shell. Renders `<ScheduleTabNav>` above `{children}`. |
| Create | `apps/web/src/app/dashboard/schedule/_lib/schedule-tabs.ts` | `SCHEDULE_TAB_DEFS` constant — three entries: Vaktplan · Vaktbørs · Ferieplan. |
| Create | `apps/web/src/app/dashboard/schedule/_components/ScheduleTabNav.tsx` | Client component: reads `usePathname()`, renders `<PageTabNav variant="route">` with `SCHEDULE_TAB_DEFS`. |
| Create | `apps/web/src/app/dashboard/schedule/ferieplan/page.tsx` | Server component. `resolveDashboardContext()` + Supabase query `schedule_absence WHERE absence_type='vacation'`. Passes data to `<FerieplanPageClient>`. |
| Create | `apps/web/src/app/dashboard/schedule/ferieplan/loading.tsx` | Suspense skeleton. |
| Create | `apps/web/src/app/dashboard/schedule/ferieplan/_components/FerieplanPageClient.tsx` | Client island. Receives vacation absences. Renders sortable list + view-mode toggle stub (Liste / Tidslinjer). |
| Modify | `packages/i18n/locales/nb/dashboard.json` | Append `schedule.tabs.*` + `schedule.view_mode.*` + `schedule.ferieplan.*` keys. |
| Modify | `packages/i18n/locales/en/dashboard.json` | Same keys, English values. |
| Modify | `docs/design/sitemap/web/00-CANONICAL.md` | Mark SM-4 ✅ in §12 sorties table. |

Total: 5 new files, 3 modifications. Zero deletions. Zero URL changes to existing routes.

---

## Phase A — SCHEDULE_TAB_DEFS

**Goal:** Create the canonical tab-definition constant for the Vaktplan hub, mirroring `_lib/people-tabs.ts`.

**Files:**
- Create: `apps/web/src/app/dashboard/schedule/_lib/schedule-tabs.ts`

### Task A1: Orientation read

- [ ] **Step 1: Read the people-tabs reference**

  Run: `cat apps/web/src/app/dashboard/_lib/people-tabs.ts`

  Expected: 35 LOC. `PeopleTabDef` type + `PEOPLE_TAB_DEFS` readonly array with 4 entries. Keys are full pathnames. Icons from Lucide.

- [ ] **Step 2: Verify PageTabNav variant status**

  Run: `grep -n 'variant\|basePath' apps/web/src/components/dashboard/PageTabNav.tsx | head -10`

  If output includes `variant` prop: SM-7 is merged — proceed normally.
  If output shows no `variant` prop: SM-7 is NOT merged — implement Phase A and Phase B using `onChange`/`active` pattern (same as current people-page-client.tsx) and add a TODO comment for SM-7 migration.

- [ ] **Step 3: Choose Lucide icons for three tabs**

  - Vaktplan: `CalendarDays` (matches existing schedule iconography in sidebar)
  - Vaktbørs: `ArrowLeftRight` (swap/marketplace semantic)
  - Ferieplan: `Sun` (vacation/summer semantic; distinguishable from Vaktplan's calendar)

  Verify all three exist in `lucide-react`:
  ```
  grep -r 'CalendarDays\|ArrowLeftRight\|Sun' apps/web/src/app/dashboard/schedule/_components/ | head -5
  ```
  Lucide is available everywhere in the dashboard — all three are standard Lucide exports.

### Task A2: Create schedule-tabs.ts

- [ ] **Step 1: Write the module**

  Path: `apps/web/src/app/dashboard/schedule/_lib/schedule-tabs.ts`

  ```ts
  /**
   * Vaktplan hub tab definitions — canonical spec §3.
   *
   * Tab keys are full pathnames so PageTabNav variant="route" can drive them
   * directly. Active state derived from pathname match via usePathname().
   *
   * - Vaktplan: drag-drop authoring surface (schedule/page.tsx). The primary
   *   D6 editor. View-modes: Liste / Kalender / Tidslinjer (stub until SM-6).
   * - Vaktbørs: open-shift marketplace at /schedule/marketplace. Manager+
   *   only per ADR-0133 + ADR-0306.
   * - Ferieplan: vacation absences (schedule_absence WHERE absence_type='vacation').
   *   View-modes: Liste / Tidslinjer (stub until SM-6).
   *
   * Dropped tabs (spec §3.1):
   * - Foreslått plan: spec §13 O7 — drawer/modal target, not a tab.
   * - Pipeline: admin audit surface accessed via in-page button, not tab.
   */
  import { CalendarDays, ArrowLeftRight, Sun } from "lucide-react";
  import type { ComponentType, SVGProps } from "react";

  export type ScheduleTabDef = {
    key: string;
    label: string;
    icon: ComponentType<SVGProps<SVGSVGElement>>;
  };

  export const SCHEDULE_TAB_DEFS: readonly ScheduleTabDef[] = [
    { key: "/dashboard/schedule",             label: "Vaktplan",  icon: CalendarDays    },
    { key: "/dashboard/schedule/marketplace", label: "Vaktbørs",  icon: ArrowLeftRight  },
    { key: "/dashboard/schedule/ferieplan",   label: "Ferieplan", icon: Sun             },
  ] as const;
  ```

- [ ] **Step 2: Verify TypeScript**

  Run: `pnpm --filter @smartout/web tsc --noEmit 2>&1 | grep 'schedule-tabs' | head -5`

  Expected: empty output (no errors on the new file).

---

## Phase B — ScheduleTabNav component + layout.tsx

**Goal:** Wire `SCHEDULE_TAB_DEFS` into a client `<ScheduleTabNav>` component. Mount it in a new `schedule/layout.tsx` that wraps all sub-routes.

**Files:**
- Create: `apps/web/src/app/dashboard/schedule/_components/ScheduleTabNav.tsx`
- Create: `apps/web/src/app/dashboard/schedule/layout.tsx`

### Task B1: Create ScheduleTabNav

- [ ] **Step 1: Read PageTabNav signature**

  Run: `cat apps/web/src/components/dashboard/PageTabNav.tsx`

  Record: prop names, type constraints, `variant` prop if present (SM-7 merge check from Phase A).

- [ ] **Step 2: Write ScheduleTabNav**

  Path: `apps/web/src/app/dashboard/schedule/_components/ScheduleTabNav.tsx`

  ```tsx
  "use client";

  /**
   * Tab strip for the Vaktplan hub.
   *
   * Client component because active-tab detection requires usePathname().
   * Rendered in schedule/layout.tsx so it persists across all three tab routes
   * without unmounting on navigation.
   *
   * Spec: docs/design/sitemap/web/00-CANONICAL.md §3 (Vaktplan tabs).
   */
  import { usePathname, useRouter } from "next/navigation";
  import { PageTabNav } from "@/components/dashboard/PageTabNav";
  import { SCHEDULE_TAB_DEFS } from "../_lib/schedule-tabs";

  export function ScheduleTabNav() {
    const pathname = usePathname();
    const router = useRouter();

    // Exact-match for Vaktplan (root), prefix-match for sub-routes.
    // PageTabNav with variant="route" handles this internally via pathname.
    // With variant="pill" fallback (pre-SM-7), we drive active manually.
    const activeKey =
      SCHEDULE_TAB_DEFS.find((t) => {
        if (t.key === "/dashboard/schedule") {
          // Exact match only — prevent marketplace/ferieplan from matching root
          return (
            pathname === "/dashboard/schedule" || pathname === "/dashboard/schedule/"
          );
        }
        return pathname?.startsWith(t.key);
      })?.key ?? "/dashboard/schedule";

    return (
      <PageTabNav
        tabs={SCHEDULE_TAB_DEFS.map((t) => ({ key: t.key, label: t.label, icon: t.icon }))}
        active={activeKey}
        onChange={(href) => router.push(href)}
        ariaLabel="Vaktplan-seksjoner"
      />
    );
  }
  ```

  Note: If SM-7 `variant="route"` is available, replace `active` + `onChange` with `variant="route"` + `basePath="/dashboard/schedule"` and remove the `useRouter` import. The inline pattern is the pre-SM-7 fallback.

- [ ] **Step 3: Verify no TS errors on ScheduleTabNav**

  Run: `pnpm --filter @smartout/web tsc --noEmit 2>&1 | grep 'ScheduleTabNav' | head -5`

  Expected: empty.

### Task B2: Create schedule/layout.tsx

- [ ] **Step 1: Check dashboard parent layout for context**

  Run: `grep -n 'children\|className' apps/web/src/app/dashboard/layout.tsx | head -15`

  Understand how the dashboard layout wraps children. The schedule layout must compose cleanly inside it — no duplicate padding, no z-index conflicts.

- [ ] **Step 2: Check loading.tsx to understand the existing skeleton shape**

  Run: `cat apps/web/src/app/dashboard/schedule/loading.tsx`

  The loading skeleton currently covers the full schedule surface. After introducing `layout.tsx`, the `loading.tsx` at the root will render inside the layout shell (tab strip shows, content skeleton fills). This is correct behavior.

- [ ] **Step 3: Write schedule/layout.tsx**

  Path: `apps/web/src/app/dashboard/schedule/layout.tsx`

  ```tsx
  /**
   * Vaktplan hub layout — wraps all schedule/* routes with the tab strip.
   *
   * Tab strip (ScheduleTabNav) is a client component; this file is a server
   * component. Composition is safe per Next.js RSC rules — server component
   * can import client component directly.
   *
   * Routes that inherit this layout:
   *   /dashboard/schedule           → Vaktplan tab (page.tsx)
   *   /dashboard/schedule/marketplace → Vaktbørs tab (marketplace/page.tsx)
   *   /dashboard/schedule/ferieplan   → Ferieplan tab (ferieplan/page.tsx)
   *   /dashboard/schedule/pipeline    → Admin audit view (tab strip visible, harmless)
   *   /dashboard/schedule/proposed-plan → C2 agent panel target (tab strip visible, harmless)
   *
   * Spec: docs/design/sitemap/web/00-CANONICAL.md §3.
   */
  import type { ReactNode } from "react";
  import { ScheduleTabNav } from "./_components/ScheduleTabNav";

  export default function ScheduleLayout({ children }: { children: ReactNode }) {
    return (
      <div className="flex flex-col gap-4">
        <ScheduleTabNav />
        {children}
      </div>
    );
  }
  ```

- [ ] **Step 4: Smoke-test layout structure**

  Run: `pnpm --filter @smartout/web tsc --noEmit 2>&1 | grep 'schedule/layout\|ScheduleLayout' | head -5`

  Expected: empty.

- [ ] **Step 5: Visual sanity check (manual)**

  Start dev server. Navigate to `/dashboard/schedule`. Verify:
  1. Tab strip appears above the drag-drop editor.
  2. Active tab is "Vaktplan" (highlighted).
  3. Navigate to `/dashboard/schedule/marketplace`. Active tab switches to "Vaktbørs". Editor is replaced by marketplace content.
  4. "Ferieplan" tab link is present but leads to 404 (Phase D not yet done — expected).
  5. Drag-drop editor is 100% intact — no visual regression.

---

## Phase C — Vaktbørs tab linkage verification

**Goal:** Confirm the existing `schedule/marketplace/page.tsx` is correctly reachable via the new tab strip. No code changes to marketplace. Document any routing edge cases.

**Files:** READ-ONLY (no changes)

### Task C1: Verify marketplace route

- [ ] **Step 1: Read marketplace page for auth pattern**

  Run: `cat apps/web/src/app/dashboard/schedule/marketplace/page.tsx`

  Expected: server shell, `supabase.auth.getUser()` redirect on no-auth, `<Suspense>` → `<MarketplacePageClient>`. Already correct.

- [ ] **Step 2: Confirm no duplicate tab strips**

  Run: `grep -n 'PageTabNav\|TabsList\|ScheduleTabNav' apps/web/src/app/dashboard/schedule/marketplace/_components/marketplace-page-client.tsx | head -5`

  Expected: empty. Marketplace client does not have its own tab strip. The layout.tsx tab strip is sufficient.

- [ ] **Step 3: Confirm loading.tsx renders correctly inside layout**

  Run: `cat apps/web/src/app/dashboard/schedule/marketplace/loading.tsx`

  Expected: a skeleton component. After layout.tsx introduction, the tab strip renders from layout while the loading skeleton fills the `{children}` slot. This is correct.

- [ ] **Step 4: Document as no-change**

  Write comment in `SCHEDULE_TAB_DEFS` docstring (already done in Phase A) that marketplace is "linked from tab strip, NOT moved." No further action.

---

## Phase D — Ferieplan sub-page

**Goal:** New `/dashboard/schedule/ferieplan` route. Server component fetches `schedule_absence WHERE absence_type='vacation'` for the workspace. Renders a list with status chips, employee names, date ranges. Includes a view-mode toggle stub (Liste / Tidslinjer — Tidslinjer disabled until SM-6).

**Files:**
- Create: `apps/web/src/app/dashboard/schedule/ferieplan/page.tsx`
- Create: `apps/web/src/app/dashboard/schedule/ferieplan/loading.tsx`
- Create: `apps/web/src/app/dashboard/schedule/ferieplan/_components/FerieplanPageClient.tsx`

### Task D1: Orientation reads

- [ ] **Step 1: Read resolveDashboardContext**

  Run: `sed -n '1,60p' apps/web/src/app/dashboard/_data/resolve-page-context.ts`

  Expected: `resolveDashboardContext()` returns `{ workspace, user, profile }`. Uses `createClient()` internally. Throws on unauthed or missing workspace.

- [ ] **Step 2: Read SM-2 Roller page as data-fetch reference**

  Run: `cat apps/web/src/app/dashboard/people/roles/page.tsx`

  Expected: ~30 LOC server component. `resolveDashboardContext()` + Supabase query + pass data to client island via props. Mirror this exact pattern for Ferieplan.

- [ ] **Step 3: Understand pending-absence-list for reuse signals**

  Run: `sed -n '1,50p' apps/web/src/app/dashboard/schedule/_components/pending-absence-list.tsx`

  This component shows pending absences in the schedule context. Ferieplan is broader (approved + pending vacation absences). DO NOT reuse this component — it has schedule-editor coupling. Build a standalone list in `FerieplanPageClient`.

- [ ] **Step 4: Check use-absences hook shape**

  Run: `sed -n '1,40p' apps/web/src/app/dashboard/schedule/_hooks/use-absences.ts`

  Note the query structure. The server-side fetch in ferieplan/page.tsx will write a similar Supabase query directly (not via TanStack Query hook — server component context).

### Task D2: Write ferieplan/page.tsx

- [ ] **Step 1: Implement server component**

  Path: `apps/web/src/app/dashboard/schedule/ferieplan/page.tsx`

  The server component:
  1. Calls `resolveDashboardContext()` — handles auth redirect + workspace resolution.
  2. Creates Supabase client with `createClient()`.
  3. Queries `schedule_absence` joined to `profile` (via `employee_id`):
     ```sql
     SELECT
       sa.*,
       p.display_name
     FROM schedule_absence sa
     JOIN profile p ON p.profile_id = sa.employee_id
     WHERE sa.workspace_id = $workspace_id
       AND sa.absence_type = 'vacation'
     ORDER BY sa.start_date DESC
     ```
  4. Passes result to `<FerieplanPageClient absences={data} />` inside `<Suspense>`.

  ```tsx
  import { Suspense } from "react";
  import { createClient } from "@smartout/supabase/server";
  import { resolveDashboardContext } from "../../_data/resolve-page-context";
  import { FerieplanPageClient } from "./_components/FerieplanPageClient";
  import FerieplanLoading from "./loading";

  /**
   * /dashboard/schedule/ferieplan — Ferieplan tab (Vaktplan hub §3).
   *
   * Shows all vacation absences for this workspace.
   * Filter: schedule_absence.absence_type = 'vacation'.
   *
   * Server component — auth + workspace resolved server-side.
   * Data passed to FerieplanPageClient for client-side sorting/filtering.
   *
   * Spec: docs/design/sitemap/web/00-CANONICAL.md §3, §6.
   */
  export default async function FerieplanPage() {
    const { workspace } = await resolveDashboardContext();
    const supabase = await createClient();

    const { data: absences, error } = await supabase
      .from("schedule_absence")
      .select("*, profile:employee_id(display_name)")
      .eq("workspace_id", workspace.workspace_id)
      .eq("absence_type", "vacation")
      .order("start_date", { ascending: false });

    // Surface fetch errors but don't hard-crash — render empty state.
    const safeAbsences = error ? [] : (absences ?? []);

    return (
      <Suspense fallback={<FerieplanLoading />}>
        <FerieplanPageClient absences={safeAbsences} />
      </Suspense>
    );
  }
  ```

- [ ] **Step 2: Run typecheck on page.tsx**

  Run: `pnpm --filter @smartout/web tsc --noEmit 2>&1 | grep 'ferieplan/page' | head -5`

  Expected: empty (may have type errors before FerieplanPageClient exists — resolve in Task D4 after all files created).

### Task D3: Write ferieplan/loading.tsx

- [ ] **Step 1: Implement skeleton**

  Path: `apps/web/src/app/dashboard/schedule/ferieplan/loading.tsx`

  Mirror the pattern from `schedule/marketplace/loading.tsx`.

  ```tsx
  /**
   * Ferieplan tab loading skeleton.
   * Shown by Next.js Suspense while server component fetches vacation absences.
   */
  export default function FerieplanLoading() {
    return (
      <div className="flex flex-col gap-3" aria-busy="true" aria-label="Laster ferieplan…">
        <div className="bg-muted h-8 w-48 animate-pulse rounded-md" />
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="bg-muted h-16 w-full animate-pulse rounded-lg" />
        ))}
      </div>
    );
  }
  ```

### Task D4: Write FerieplanPageClient

- [ ] **Step 1: Define the props type**

  The Supabase query returns `schedule_absence` rows with an embedded `profile` join. Type is derived from `Database["public"]["Tables"]["schedule_absence"]["Row"]` with an additional `profile: { display_name: string } | null` field from the join.

  Do NOT import the full Database type into the client component — pass a clean, minimal type from the server component.

  Define in `FerieplanPageClient.tsx`:
  ```ts
  type VacationAbsence = {
    schedule_absence_id: string;
    employee_id: string;
    start_date: string;
    end_date: string;
    status: "pending" | "approved" | "rejected";
    reason: string | null;
    profile: { display_name: string } | null;
  };
  ```

- [ ] **Step 2: Implement the client island**

  Path: `apps/web/src/app/dashboard/schedule/ferieplan/_components/FerieplanPageClient.tsx`

  Structure:
  - Top bar: page description text + view-mode toggle stub (Liste | Tidslinjer🔒)
  - List: one row per vacation absence. Columns: employee name, start_date → end_date, status chip, reason (truncated).
  - Empty state: "Ingen ferieønsker registrert" message + icon.
  - No TanStack Query, no mutations in SM-4 — read-only display.

  View-mode toggle stub:
  ```tsx
  const [viewMode, setViewMode] = useState<"liste" | "tidslinjer">("liste");
  ```
  - "Liste" button: active, clickable.
  - "Tidslinjer" button: `disabled`, greyed out, `title="Bygges i SM-6"` tooltip.

  Status chip colors (using CSS variables, no hardcoded colors per ADR-0366):
  - `pending`: `bg-muted text-muted-foreground` + "Søkt"
  - `approved`: `bg-muted text-foreground` border accent (use Lucide `Check` icon) + "Godkjent"
  - `rejected`: `text-destructive-foreground bg-destructive/10` + "Avslått"

  Sort order: chronological by `start_date` DESC (server-sorted, no client re-sort needed in SM-4).

- [ ] **Step 3: Full typecheck**

  Run: `pnpm --filter @smartout/web tsc --noEmit 2>&1 | grep -E 'ferieplan|Ferieplan' | head -10`

  Expected: empty. Fix any errors before continuing.

- [ ] **Step 4: Manual smoke test**

  Navigate to `/dashboard/schedule/ferieplan`. Verify:
  1. Tab strip shows "Ferieplan" as active.
  2. Page loads without error (may show empty state if no vacation absences in dev seed).
  3. View-mode toggle visible. "Tidslinjer" button is disabled (cursor-not-allowed). "Liste" button active.
  4. No console errors.

---

## Phase E — View-mode toggle stub on Vaktplan tab body

**Goal:** Add a view-mode toggle to the Vaktplan tab (the drag-drop editor). Toggle state: `"liste" | "kalender" | "tidslinjer"`. Only "Tidslinjer" is new — "liste" and "kalender" already exist as `scheduleLayout` internal state. The SM-4 toggle **does not replace** the existing `PlannerCommandBar` layout controls — it adds a separate, small segment control at top-right of the page, conforming to spec §4.3.

**Constraint:** `schedule/page.tsx` is a 1800+ LOC client component. Changes must be surgical:
1. One `useState` for `viewMode`.
2. One small segment-control JSX block rendered top-right in the page header area.
3. Tidslinjer option: disabled + tooltip.
4. Zero changes to existing drag-drop logic, hooks, DnD, overlays.

**Files:**
- Modify: `apps/web/src/app/dashboard/schedule/page.tsx` (surgical — two additions only)

### Task E1: Orientation in schedule/page.tsx

- [ ] **Step 1: Find the page header / toolbar area**

  Run: `grep -n 'PlannerCommandBar\|StatusStrip\|className.*flex.*justify-between\|header\|toolbar' apps/web/src/app/dashboard/schedule/page.tsx | head -20`

  Identify the top-level JSX block that renders the command bar. The view-mode toggle stub will be injected adjacent to or inside this block, top-right justified.

- [ ] **Step 2: Identify the return statement structure**

  Run: `sed -n '200,260p' apps/web/src/app/dashboard/schedule/page.tsx`

  Expected: finds the outer `<div>` wrapper and `<PlannerCommandBar>` placement. Map the exact line numbers.

- [ ] **Step 3: Confirm existing layout state**

  Run: `grep -n 'scheduleLayout\|setScheduleLayout\|layout.*daily\|layout.*monthly' apps/web/src/app/dashboard/schedule/page.tsx | head -10`

  The existing `scheduleLayout` state controls the editor view. The new `viewMode` state for the Tidslinjer toggle is SEPARATE — it does not replace `scheduleLayout`. When `viewMode === "tidslinjer"`, SM-6 will render the Gantt component in place of the grid. For SM-4, we only add the state and disabled toggle; the editor grid always renders regardless.

### Task E2: Add view-mode toggle stub to schedule/page.tsx

- [ ] **Step 1: Add useState import (if not already imported)**

  `useState` is already imported at line 5. No change needed.

- [ ] **Step 2: Add viewMode state (one line)**

  Inside the `MalPlannerClient` function (or whichever the export default function is), after the existing `scheduleLayout` state declaration:

  ```ts
  // View-mode: tidslinjer stub — SM-6 ships the Gantt component
  const [viewMode, setViewMode] = useState<"liste" | "kalender" | "tidslinjer">("liste");
  ```

- [ ] **Step 3: Add toggle JSX (one block)**

  Locate the JSX block containing `<PlannerCommandBar>`. Add a small segment control ABOVE or to the RIGHT of the command bar. Must be visually separate and not conflict with existing toolbar buttons.

  ```tsx
  {/* View-mode toggle — spec §4.3. Tidslinjer disabled until SM-6. */}
  <div className="flex items-center gap-1 self-start" role="group" aria-label="Visningsmodus">
    {(["liste", "kalender"] as const).map((mode) => (
      <button
        key={mode}
        onClick={() => setViewMode(mode)}
        aria-pressed={viewMode === mode}
        className={`rounded-md px-2 py-1 text-xs font-medium transition-colors ${
          viewMode === mode
            ? "bg-foreground text-background"
            : "bg-muted text-muted-foreground hover:bg-muted/80"
        }`}
      >
        {mode === "liste" ? "Liste" : "Kalender"}
      </button>
    ))}
    <button
      disabled
      title="Bygges i SM-6"
      aria-disabled="true"
      className="cursor-not-allowed rounded-md px-2 py-1 text-xs font-medium text-muted-foreground/40"
    >
      Tidslinjer
    </button>
  </div>
  ```

  Note: `viewMode` state is wired but not yet consumed to switch views — SM-6 will add the conditional render. SM-4 only adds state + toggle UI.

- [ ] **Step 4: Typecheck after changes**

  Run: `pnpm --filter @smartout/web tsc --noEmit 2>&1 | grep 'schedule/page' | head -5`

  Expected: empty.

- [ ] **Step 5: Visual regression check (manual)**

  Navigate to `/dashboard/schedule`. Verify:
  1. Toggle appears in the correct location (top-right, not overlapping command bar).
  2. "Liste" and "Kalender" are clickable (toggle between active states).
  3. "Tidslinjer" is visually muted, not clickable, shows tooltip on hover.
  4. All existing drag-drop editor functionality works normally.
  5. No layout shift in the grid.

---

## Phase F — i18n keys

**Goal:** Add translation keys for all new strings introduced in SM-4. Zero hardcoded Norwegian/English text in components.

**Files:**
- Modify: `packages/i18n/locales/nb/dashboard.json`
- Modify: `packages/i18n/locales/en/dashboard.json`

### Task F1: Inventory new strings

New strings introduced in SM-4:

| String | Location | Key |
|---|---|---|
| "Vaktplan" (tab label) | SCHEDULE_TAB_DEFS | `schedule.tabs.vaktplan` |
| "Vaktbørs" (tab label) | SCHEDULE_TAB_DEFS | `schedule.tabs.vaktbors` |
| "Ferieplan" (tab label) | SCHEDULE_TAB_DEFS | `schedule.tabs.ferieplan` |
| "Vaktplan-seksjoner" (aria) | ScheduleTabNav | `schedule.tabs.aria_label` |
| "Laster ferieplan…" (aria loading) | loading.tsx | `schedule.ferieplan.loading` |
| "Ingen ferieønsker registrert" (empty) | FerieplanPageClient | `schedule.ferieplan.empty` |
| "Søkt" (status chip) | FerieplanPageClient | `schedule.ferieplan.status_pending` |
| "Godkjent" (status chip) | FerieplanPageClient | `schedule.ferieplan.status_approved` |
| "Avslått" (status chip) | FerieplanPageClient | `schedule.ferieplan.status_rejected` |
| "Liste" (view-mode) | FerieplanPageClient + page.tsx toggle | `schedule.view_mode.liste` |
| "Kalender" (view-mode) | page.tsx toggle | `schedule.view_mode.kalender` |
| "Tidslinjer" (view-mode disabled) | FerieplanPageClient + page.tsx toggle | `schedule.view_mode.tidslinjer` |
| "Bygges i SM-6" (tooltip) | toggle buttons | `schedule.view_mode.tidslinjer_tooltip` |
| "Visningsmodus" (aria group) | toggle group | `schedule.view_mode.aria_label` |

Note: "Ferieplan" tab label reuses `schedule.tabs.ferieplan` — do not create a separate description string in SM-4.

### Task F2: Read current schedule i18n section

- [ ] **Step 1: Read nb schedule section**

  Run: `grep -n '"schedule"' packages/i18n/locales/nb/dashboard.json | head -5`

  Then read the full schedule block to understand existing structure and avoid key collision.

  Run: `sed -n '1055,1080p' packages/i18n/locales/nb/dashboard.json`

### Task F3: Append keys to nb locale

- [ ] **Step 1: Add keys to schedule section**

  Append under `"schedule"` in `packages/i18n/locales/nb/dashboard.json`:

  ```json
  "tabs": {
    "aria_label": "Vaktplan-seksjoner",
    "vaktplan": "Vaktplan",
    "vaktbors": "Vaktbørs",
    "ferieplan": "Ferieplan"
  },
  "view_mode": {
    "aria_label": "Visningsmodus",
    "liste": "Liste",
    "kalender": "Kalender",
    "tidslinjer": "Tidslinjer",
    "tidslinjer_tooltip": "Bygges i SM-6"
  },
  "ferieplan": {
    "loading": "Laster ferieplan…",
    "empty": "Ingen ferieønsker registrert",
    "status_pending": "Søkt",
    "status_approved": "Godkjent",
    "status_rejected": "Avslått"
  }
  ```

- [ ] **Step 2: Add keys to en locale**

  Append identical structure to `packages/i18n/locales/en/dashboard.json`:

  ```json
  "tabs": {
    "aria_label": "Schedule sections",
    "vaktplan": "Schedule",
    "vaktbors": "Open Shifts",
    "ferieplan": "Vacation Plan"
  },
  "view_mode": {
    "aria_label": "View mode",
    "liste": "List",
    "kalender": "Calendar",
    "tidslinjer": "Timeline",
    "tidslinjer_tooltip": "Coming in SM-6"
  },
  "ferieplan": {
    "loading": "Loading vacation plan…",
    "empty": "No vacation requests registered",
    "status_pending": "Requested",
    "status_approved": "Approved",
    "status_rejected": "Rejected"
  }
  ```

- [ ] **Step 3: Wire t() calls in components**

  After keys are written, update all components to use `useTranslations` instead of hardcoded strings:

  - `ScheduleTabNav.tsx`: `ariaLabel={t("schedule.tabs.aria_label")}`
  - `SCHEDULE_TAB_DEFS` labels: note that tab labels in the defs constant are static strings. They can stay hardcoded in the constant (same as `PEOPLE_TAB_DEFS`) — label rendering via `t()` happens at the call site in the component. Update `ScheduleTabNav` to call `t("schedule.tabs.vaktplan")` etc. in the `tabs` prop mapping.
  - `FerieplanPageClient.tsx`: wire all `t()` calls for status chips, empty state, aria labels, loading.
  - `schedule/page.tsx` toggle: wire `t("schedule.view_mode.*")` calls.

- [ ] **Step 4: Verify no hardcoded strings remain**

  Run:
  ```
  grep -n '"Vaktplan"\|"Vaktbørs"\|"Ferieplan"\|"Bygges i SM-6"\|"Ingen ferieønsker"' \
    apps/web/src/app/dashboard/schedule/layout.tsx \
    apps/web/src/app/dashboard/schedule/_components/ScheduleTabNav.tsx \
    apps/web/src/app/dashboard/schedule/ferieplan/_components/FerieplanPageClient.tsx \
    2>/dev/null | head -10
  ```

  Expected: empty (all tab labels come from i18n keys, not hardcoded in component bodies).

  Exception: `schedule-tabs.ts` is a pure constant file — its `label` field is the English key identifier, not a rendered string. The rendered string comes from `t()` in the component. This is the same pattern as `people-tabs.ts`.

---

## Phase G — Canonical spec update

**Goal:** Mark SM-4 complete in the canonical sitemap spec.

**Files:**
- Modify: `docs/design/sitemap/web/00-CANONICAL.md`

### Task G1: Update sorties table

- [ ] **Step 1: Find SM-4 row in §12**

  Run: `grep -n 'SM-4\|SM.4' docs/design/sitemap/web/00-CANONICAL.md | head -5`

- [ ] **Step 2: Mark ✅**

  Change:
  ```
  | **SM-4** | Vaktplan tab structure + Vaktbørs + Ferieplan | M (4h) | `/schedule` |
  ```
  to:
  ```
  | **SM-4** ✅ | Vaktplan tab structure + Vaktbørs + Ferieplan | M (4h) | `/schedule` |
  ```

- [ ] **Step 3: Add SM-6 dependency note**

  In §4.2 (Tidslinjer callsites table), find the three Vaktplan rows and add a note:
  ```
  | Vaktplan | Vaktplan   | yes — toggle stub (SM-4), component SM-6 |
  | Vaktplan | Vaktbørs   | yes — toggle stub (SM-4), component SM-6 |
  | Vaktplan | Ferieplan  | yes — toggle stub (SM-4), component SM-6 |
  ```

---

## Typecheck Gate (pre-close)

Before declaring SM-4 done, run the full typecheck. This is a required gate per CLAUDE.md.

- [ ] **Full typecheck**

  Run: `pnpm turbo typecheck 2>&1 | tail -20`

  Expected: 0 errors. Fix any errors before continuing.

- [ ] **Confirm no schedule drag-drop regressions**

  Run: `pnpm --filter @smartout/web tsc --noEmit 2>&1 | grep 'schedule/' | head -10`

  Expected: all schedule/ files clean.

---

## Known Debt / Out of Scope

| Item | Rationale | Follow-up |
|---|---|---|
| Tab strip visible on `pipeline/` + `proposed-plan/` sub-routes | Pipeline + proposed-plan are internal targets, not user tab destinations. Strip is cosmetically neutral. | Route group `(tabs)/` layout if product review flags it. |
| `variant="route"` migration | SM-7 ships this. If SM-4 ships before SM-7, ScheduleTabNav uses the `onChange` fallback pattern. | Auto-resolved when SM-7 merges. |
| Tidslinjer Gantt component | SM-6 scope. SM-4 only adds `viewMode` state + disabled toggle. | SM-6 implements the Gantt and removes `disabled` from the Tidslinjer button. |
| Ferieplan mutations (approve/reject vacation) | Read-only in SM-4. Manager approval flow is a separate feature. | Future sortie: `approve_vacation` + `reject_vacation` actions. |
| Vaktbørs tab access for employees | Marketplace is currently manager+ only (ADR-0133). Employee pull-poll is mobile (ADR-0306). | No change in SM-4. |
| View-mode toggle on Vaktbørs (marketplace) | Marketplace client is untouched in SM-4. Adding the toggle there requires changes to `MarketplacePageClient`. | Defer to SM-6 which wires all three tab bodies to the Tidslinjer component simultaneously. |

---

## Parallel Sortie Conflicts

| Parallel sortie | Overlap area | Risk | Mitigation |
|---|---|---|---|
| SM-3 (Calendar/Events — Planlegging hub) | None — different route (`/calendar`). No shared files. | None | — |
| SM-7 (PageTabNav route variant) | `PageTabNav.tsx` + pattern used in `ScheduleTabNav`. | Low — SM-7 only adds a prop. SM-4's `ScheduleTabNav` uses existing `onChange` API as fallback. | Merge SM-7 before SM-4 if both are in-flight. If not possible, SM-4 uses `onChange` fallback and adds TODO comment for SM-7 codemod. |
| SM-2 (Ansatte hub) | `_lib/` folder pattern. SM-2 created `_lib/people-tabs.ts`. SM-4 creates `_lib/schedule-tabs.ts` (different path, no collision). | None | — |
| H2 (OKLCH sweep, already merged) | `globals.css` + CSS variables. SM-4 uses only CSS variable classes (`bg-muted`, `text-foreground`). | None | Already resolved — H2 is in campaign HEAD. |
| H4 (i18n wiring, already merged) | `dashboard.json` — SM-4 appends to existing `schedule` section. H4 added keys under different sub-keys. | Low — JSON merge conflict possible if both sorties touch the `schedule` object. | SM-4 agent must read the current file state before writing. Use targeted append at the correct JSON nesting level. Verify with `jq .schedule packages/i18n/locales/nb/dashboard.json` before and after. |

---

## Sorties-Ready Summary

SM-4 is a **single sortie** (not a campaign). Estimated implementation: 2–3 hours for a build agent.

| Phase | Files | Estimated effort |
|---|---|---|
| A: schedule-tabs.ts | 1 create | 15 min |
| B: ScheduleTabNav + layout.tsx | 2 create | 30 min |
| C: Vaktbørs verification | 0 create (read-only) | 10 min |
| D: Ferieplan page + client | 3 create | 60 min |
| E: View-mode toggle in page.tsx | 1 modify (surgical) | 20 min |
| F: i18n keys | 2 modify | 20 min |
| G: Canonical spec update | 1 modify | 5 min |
| Typecheck gate | — | 10 min |

**Total: 5 new files, 3 modifications. ~2.5h.** No migrations. No schema. No dependency changes.
