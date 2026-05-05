# Year Wheel Redesign — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace `/dashboard/year-wheel` with the three-column linear-timeline shell, split season editing out to a new `/dashboard/season/[seasonId]` route, and retire the drawer + Machine Room + create sheet.

**Architecture:** Server-rendered page shells (Next.js App Router) with client islands for the interactive canvas, sidebar, companion rail, and quick-create sheet. Existing hooks in `packages/year-wheel` are extended (not forked). Telemetry goes through the existing `packages/telemetry` registry with dual registration (TS interface + runtime entry).

**Tech Stack:** Next.js 16 App Router + React 19 + TypeScript strict, Tailwind v4 (CSS-var config), shadcn/ui (Sheet, Popover, Input, Button), Framer Motion (two-tier springs), Radix primitives (roles/focus), Lucide icons, Playwright E2E.

**Spec:** `docs/superpowers/specs/2026-04-20-year-wheel-redesign-design.md` (commit `ecf2ff36` on `feat/year-wheel`).

**Branch:** `feat/year-wheel` (wt-2). All commits land here; merge to `development` after final typecheck + smoke.

---

## File Structure

### New files

```
apps/web/src/app/dashboard/year-wheel/
├── _components/
│   ├── canvas/
│   │   ├── YearCanvas.tsx                NEW (linear timeline + watermark + draw)
│   │   ├── TimelineBlock.tsx             NEW (season block — status-aware)
│   │   ├── TimelinePin.tsx               NEW (event pin — 12px dot or 10px bar)
│   │   ├── DrawPhantom.tsx               NEW (live phantom during drag)
│   │   ├── NormalDriftWatermark.tsx      NEW (hatch + italic heading)
│   │   ├── lane-pack.ts                  NEW (pure function + test)
│   │   └── lane-pack.test.ts             NEW
│   ├── shell/
│   │   ├── YearWheelTopbar.tsx           NEW
│   │   ├── SeasonSidebar.tsx             NEW
│   │   ├── CompanionRail.tsx             NEW
│   │   ├── LegendChip.tsx                NEW
│   │   └── AiSuggestionCard.tsx          NEW (empty-state only)
│   └── SeasonQuickCreateSheet.tsx        NEW (right-side shadcn Sheet)

apps/web/src/app/dashboard/season/
└── [seasonId]/
    ├── page.tsx                          NEW (server, auth gate)
    ├── loading.tsx                       NEW
    ├── season-page-client.tsx            NEW
    └── _components/
        ├── SeasonBreadcrumb.tsx          NEW
        ├── SeasonSubmenu.tsx             NEW (tab strip with router.push)
        ├── BudgetSetupTab.tsx            COPIED from year-wheel/_components/
        ├── DayFactorsTab.tsx             COPIED
        ├── HourFactorsTab.tsx            COPIED (with Popover+Input editor)
        ├── SeasonHoursTab.tsx            COPIED
        └── SeasonOverviewTab.tsx        COPIED (KPI+charts, unchanged)

supabase/migrations/
└── 20260420120000_cascade_task_hrefs_season_route.sql  NEW
```

### Modified files

```
packages/year-wheel/src/hooks/use-seasons.ts            — extend CreateSeasonInput + INSERT
packages/telemetry/src/registry.ts                      — 6 new events + extend SeasonCreated
apps/web/src/app/dashboard/year-wheel/year-wheel-page-client.tsx  — rebuild shell
apps/web/src/app/layout.tsx                             — verify Instrument Serif italic
docs/reference/ROUTES.md                                — add season route
apps/e2e/tests/season-planning.spec.ts                  — update selectors or skip
```

### Retired files (deleted in Phase 7)

```
apps/web/src/app/dashboard/year-wheel/_components/
├── YearWheelTimeline.tsx                 DELETE
├── SeasonDrawer.tsx                      DELETE
├── MachineRoomSheet.tsx                  DELETE
├── SeasonCreateSheet.tsx                 DELETE
├── YearNavigation.tsx                    DELETE
├── TimelineBlock.tsx                     DELETE (old version)
├── TimelinePin.tsx                       DELETE (old version)
├── BudgetSetupTab.tsx                    DELETE (original, copy lives in season/)
├── DayFactorsTab.tsx                     DELETE (original)
├── HourFactorsTab.tsx                    DELETE (original)
├── SeasonHoursTab.tsx                    DELETE (original)
└── SeasonOverviewTab.tsx                 DELETE (original)
```

### Moved to `_deferred/` in Phase 7

```
apps/web/src/app/dashboard/season/[seasonId]/_components/_deferred/
├── SeasonGoalsTab.tsx
└── SeasonProceduresTab.tsx
```

---

## Phase 0 — Foundations (hook + telemetry)

Spec §11 steps 0a + 0b. These must land first so downstream steps compile.

### Task 0.1: Widen `CreateSeasonInput` tolerant

**Files:**
- Modify: `packages/year-wheel/src/hooks/use-seasons.ts:25-29, 72-126`

- [ ] **Step 1: Write the failing test**

Create `packages/year-wheel/src/hooks/use-seasons.test.ts` (if it doesn't exist, create a minimal harness). Test:

```ts
import { describe, it, expect } from "vitest";
import type { CreateSeasonInput } from "./use-seasons";

describe("CreateSeasonInput", () => {
  it("accepts optional color and planningCycleId", () => {
    const input: CreateSeasonInput = {
      name: "Sommer 2026",
      startDate: "2026-06-01",
      endDate: "2026-08-31",
      color: "#f97316",
      planningCycleId: "cycle-uuid",
    };
    expect(input.name).toBe("Sommer 2026");
  });

  it("remains valid without optional fields (backward compatibility)", () => {
    const input: CreateSeasonInput = { name: "Draft" };
    expect(input.name).toBe("Draft");
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm -F @smartout/year-wheel test use-seasons`
Expected: FAIL (current type lacks `color` + `planningCycleId`).

- [ ] **Step 3: Extend the type**

Change `CreateSeasonInput` at `packages/year-wheel/src/hooks/use-seasons.ts:25-29` from:

```ts
export type CreateSeasonInput = {
  name: string;
  startDate?: string | null;
  endDate?: string | null;
};
```

to:

```ts
export type CreateSeasonInput = {
  name: string;
  startDate?: string | null;
  endDate?: string | null;
  color?: string | null;
  planningCycleId?: string | null;
};
```

Both new fields are optional; old callsites keep compiling.

- [ ] **Step 4: Extend the INSERT**

In the `createSeason` mutation at `packages/year-wheel/src/hooks/use-seasons.ts:85-95`, change the INSERT body from:

```ts
.insert({
  workspace_id: wsId!,
  name: trimmedName,
  slug,
  season_type: "default",
  start_date: input.startDate ?? null,
  end_date: input.endDate ?? null,
  status: "draft",
})
```

to:

```ts
.insert({
  workspace_id: wsId!,
  name: trimmedName,
  slug,
  season_type: "default",
  start_date: input.startDate ?? null,
  end_date: input.endDate ?? null,
  status: "draft",
  color: input.color ?? null,
  planning_cycle_id: input.planningCycleId ?? null,
})
```

- [ ] **Step 5: Extend the emit payload**

In the `onSuccess` at `packages/year-wheel/src/hooks/use-seasons.ts:104-117`, change `properties.data` from:

```ts
data: { name, status: "draft" },
```

to:

```ts
data: {
  name,
  status: "draft",
  color: data.color ?? null,
  planning_cycle_id: data.planning_cycle_id ?? null,
},
```

(The response row `data` from the SELECT already includes both columns.)

- [ ] **Step 6: Run test to verify it passes**

Run: `pnpm -F @smartout/year-wheel test use-seasons`
Expected: PASS.

- [ ] **Step 7: Run typecheck on the workspace**

Run: `pnpm turbo typecheck --filter=@smartout/year-wheel --filter=@smartout/web`
Expected: PASS. Existing callsites (`SeasonCreateSheet.tsx`, `duplicateYear`) still compile because new fields are optional.

- [ ] **Step 8: Commit**

```bash
git add packages/year-wheel/src/hooks/use-seasons.ts packages/year-wheel/src/hooks/use-seasons.test.ts
git commit -m "$(cat <<'EOF'
feat(year-wheel): widen createSeason input with color + planningCycleId

Step 0a of year-wheel redesign migration. Makes both fields optional on
the input type and extends the INSERT + emit payload to write/include
them when provided. Old callsites (SeasonCreateSheet, duplicateYear)
keep compiling. Tightening to required happens in step 0c after the new
quick-create sheet lands.

Ref: docs/superpowers/specs/2026-04-20-year-wheel-redesign-design.md §4.2

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

### Task 0.2: Extend `SeasonCreated` telemetry interface

**Files:**
- Modify: `packages/telemetry/src/registry.ts:1120-1126`

- [ ] **Step 1: Write the failing test**

Add to `packages/telemetry/src/registry.test.ts` (or create it):

```ts
import { describe, it, expectTypeOf } from "vitest";
import type { SeasonCreated } from "./registry";

describe("SeasonCreated event interface", () => {
  it("accepts color and planning_cycle_id in properties.data", () => {
    const event: SeasonCreated = {
      event: "season created",
      workspace_id: "ws-uuid",
      actor_id: "profile-uuid",
      properties: {
        entity: {
          entity_type: "season",
          entity_id: "season-uuid",
          entity_label: "Sommer",
        },
        data: {
          name: "Sommer",
          status: "draft",
          color: "#f97316",
          planning_cycle_id: "cycle-uuid",
        },
      },
    };
    expectTypeOf(event.properties.data.color).toEqualTypeOf<string | null | undefined>();
    expectTypeOf(event.properties.data.planning_cycle_id).toEqualTypeOf<string | null | undefined>();
  });
});
```

- [ ] **Step 2: Run to verify FAIL**

Run: `pnpm -F @smartout/telemetry test registry`
Expected: FAIL — `properties.data` does not contain `color` or `planning_cycle_id`.

- [ ] **Step 3: Extend the interface**

At `packages/telemetry/src/registry.ts:1120-1126`, change:

```ts
export interface SeasonCreated extends BaseEvent {
  event: "season created";
  properties: {
    entity: EntityRef;
    data: { name: string; status: string };
  };
}
```

to:

```ts
export interface SeasonCreated extends BaseEvent {
  event: "season created";
  properties: {
    entity: EntityRef;
    data: {
      name: string;
      status: string;
      color?: string | null;
      planning_cycle_id?: string | null;
    };
  };
}
```

- [ ] **Step 4: Run test — PASS**

Run: `pnpm -F @smartout/telemetry test registry`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/telemetry/src/registry.ts packages/telemetry/src/registry.test.ts
git commit -m "$(cat <<'EOF'
feat(telemetry): extend SeasonCreated payload with color + planning_cycle_id

Matches the createSeason hook extension from step 0a so the emit at
use-seasons.ts:104-117 typechecks against the discriminated-union.

Ref: docs/superpowers/specs/2026-04-20-year-wheel-redesign-design.md §7.2

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

### Task 0.3: Register the six new telemetry events

**Files:**
- Modify: `packages/telemetry/src/registry.ts` — add interfaces in the discriminated-union block around line ~1260 (near `SeasonYearNavigated`), add runtime entries near line ~5280 (near `"season year_navigated"`).

- [ ] **Step 1: Write the failing test**

Add to `packages/telemetry/src/registry.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { EVENT_REGISTRY } from "./registry";
import type {
  SeasonDrawStarted,
  SeasonDrawCompleted,
  SeasonDrawCancelled,
  SeasonSidebarFilterChanged,
  SeasonYearWheelViewed,
  SeasonTabChanged,
} from "./registry";

describe("year-wheel canvas events are registered", () => {
  it.each([
    "season draw_started",
    "season draw_completed",
    "season draw_cancelled",
    "season sidebar_filter_changed",
    "season year_wheel_viewed",
    "season tab_changed",
  ])("%s is in EVENT_REGISTRY", (name) => {
    expect(EVENT_REGISTRY[name]).toBeDefined();
  });

  it("season draw_completed is categorized as operations", () => {
    expect(EVENT_REGISTRY["season draw_completed"].category).toBe("operations");
  });

  it("view/click events are categorized as navigation", () => {
    for (const name of [
      "season draw_started",
      "season draw_cancelled",
      "season sidebar_filter_changed",
      "season year_wheel_viewed",
      "season tab_changed",
    ]) {
      expect(EVENT_REGISTRY[name].category).toBe("navigation");
    }
  });

  it("no new event routes to activity_trail", () => {
    for (const name of [
      "season draw_started",
      "season draw_completed",
      "season draw_cancelled",
      "season sidebar_filter_changed",
      "season year_wheel_viewed",
      "season tab_changed",
    ]) {
      expect(EVENT_REGISTRY[name].destinations).not.toContain("activity_trail");
    }
  });
});
```

- [ ] **Step 2: Run — expect FAIL**

Run: `pnpm -F @smartout/telemetry test registry`
Expected: FAIL — events not registered.

- [ ] **Step 3: Add the six TS interfaces**

Locate the existing `SeasonYearNavigated` interface (around `registry.ts:1242-1262`). Immediately after it, add:

```ts
export interface SeasonDrawStarted extends BaseEvent {
  event: "season draw_started";
  properties: {
    data: { year: number; lane: number };
  };
}

export interface SeasonDrawCompleted extends BaseEvent {
  event: "season draw_completed";
  properties: {
    data: { start: string; end: string; lane: number };
  };
}

export interface SeasonDrawCancelled extends BaseEvent {
  event: "season draw_cancelled";
  properties: {
    data: { reason: "short_drag" | "esc" | "mouse_exit" | "sheet_abandoned" };
  };
}

export interface SeasonSidebarFilterChanged extends BaseEvent {
  event: "season sidebar_filter_changed";
  properties: {
    data: { filter: "all" | "active" | "draft" | "archived" };
  };
}

export interface SeasonYearWheelViewed extends BaseEvent {
  event: "season year_wheel_viewed";
  properties: {
    data: { year: number; seasons_count: number };
  };
}

export interface SeasonTabChanged extends BaseEvent {
  event: "season tab_changed";
  properties: {
    entity: EntityRef;
    data: { from: string; to: string };
  };
}
```

Locate the `Event` discriminated union type definition and add the six new interfaces to it. Grep `registry.ts` for `| SeasonYearNavigated` to find the exact line; add the six new members alongside.

- [ ] **Step 4: Register the six events at runtime**

Locate `"season year_navigated"` in the runtime `registerEvent()` block (around line ~5271). Add six `registerEvent(...)` calls matching the patterns used by `"season year_navigated"` + `"season block_clicked"`:

```ts
registerEvent<SeasonDrawStarted>({
  event: "season draw_started",
  category: "navigation",
  destinations: ["posthog", "logger"],
});

registerEvent<SeasonDrawCompleted>({
  event: "season draw_completed",
  category: "operations",
  destinations: ["posthog", "logger"],
});

registerEvent<SeasonDrawCancelled>({
  event: "season draw_cancelled",
  category: "navigation",
  destinations: ["posthog", "logger"],
});

registerEvent<SeasonSidebarFilterChanged>({
  event: "season sidebar_filter_changed",
  category: "navigation",
  destinations: ["posthog", "logger"],
});

registerEvent<SeasonYearWheelViewed>({
  event: "season year_wheel_viewed",
  category: "navigation",
  destinations: ["posthog", "logger"],
});

registerEvent<SeasonTabChanged>({
  event: "season tab_changed",
  category: "navigation",
  destinations: ["posthog", "logger"],
});
```

Check the exact `registerEvent()` function signature in the file and match it (different codebases use options objects vs positional args). If the existing pattern requires extra fields (e.g. `description`), copy the style.

- [ ] **Step 5: Run tests — PASS**

Run: `pnpm -F @smartout/telemetry test registry && pnpm turbo typecheck --filter=@smartout/telemetry`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add packages/telemetry/src/registry.ts packages/telemetry/src/registry.test.ts
git commit -m "$(cat <<'EOF'
feat(telemetry): register 6 year-wheel canvas events under season prefix

All six events use "season " prefix per ADR-0164 (domain not widget).
Dual registration per L-0072: export interface + runtime registerEvent.
Categories follow existing convention — operations for mutation-intent
(draw_completed), navigation for views and exploratory clicks. No event
routes to activity_trail; entity included on tab_changed for PostHog
enrichment only.

Events:
- season draw_started, draw_completed, draw_cancelled
- season sidebar_filter_changed
- season year_wheel_viewed
- season tab_changed

Ref: docs/superpowers/specs/2026-04-20-year-wheel-redesign-design.md §7.3

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Phase 1 — Season Route Foundation

Spec §11 step 1 + step 2. Copy the existing tabs into `/dashboard/season/[seasonId]/_components/` (originals stay), rewrite imports, build the route shell.

### Task 1.1: Copy the five tabs with import rewrites

**Files:**
- Create: `apps/web/src/app/dashboard/season/[seasonId]/_components/BudgetSetupTab.tsx`
- Create: `apps/web/src/app/dashboard/season/[seasonId]/_components/DayFactorsTab.tsx`
- Create: `apps/web/src/app/dashboard/season/[seasonId]/_components/HourFactorsTab.tsx`
- Create: `apps/web/src/app/dashboard/season/[seasonId]/_components/SeasonHoursTab.tsx`
- Create: `apps/web/src/app/dashboard/season/[seasonId]/_components/SeasonOverviewTab.tsx`

- [ ] **Step 1: Create the target directory**

```bash
mkdir -p apps/web/src/app/dashboard/season/\[seasonId\]/_components
```

- [ ] **Step 2: Copy each file verbatim**

```bash
for f in BudgetSetupTab DayFactorsTab HourFactorsTab SeasonHoursTab SeasonOverviewTab; do
  cp "apps/web/src/app/dashboard/year-wheel/_components/${f}.tsx" \
     "apps/web/src/app/dashboard/season/[seasonId]/_components/${f}.tsx"
done
```

- [ ] **Step 3: Rewrite relative imports in each copied file**

Open each of the five copied files. Find lines matching `from "../` (relative imports pointing into `year-wheel/`). Rewrite them to absolute or corrected relative:

- `../_hooks` → `@/app/dashboard/year-wheel/_hooks` (keep hooks in their canonical location for now — they're shared)
- `../_definitions/season-planning` → `@/app/dashboard/year-wheel/_definitions/season-planning`
- `../_lib/timeline-date` → `@/app/dashboard/year-wheel/_lib/timeline-date`

For imports within the copied group (e.g. one tab importing a helper from another tab — unlikely but possible), relative paths stay relative (`./X`).

**Grep before committing:**

```bash
grep -rn 'from "\.\./' apps/web/src/app/dashboard/season/\[seasonId\]/_components/
```

Expected: empty output.

- [ ] **Step 4: Typecheck**

Run: `pnpm turbo typecheck --filter=@smartout/web`
Expected: PASS. Both copies exist and compile.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/app/dashboard/season/
git commit -m "$(cat <<'EOF'
feat(season): copy 5 tabs to season/[seasonId]/_components/

Step 1 of year-wheel redesign migration. Copies BudgetSetupTab,
DayFactorsTab, HourFactorsTab, SeasonHoursTab, SeasonOverviewTab into
the new season route. Originals stay in year-wheel/_components/ so the
existing drawer keeps working. Relative imports rewritten to absolute
@/app/... paths. Content unchanged — SeasonOverviewTab is KPI+charts
per spec §5.4 fact-check.

Ref: docs/superpowers/specs/2026-04-20-year-wheel-redesign-design.md §11 step 1

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

### Task 1.2: Build the season route shell

**Files:**
- Create: `apps/web/src/app/dashboard/season/[seasonId]/page.tsx`
- Create: `apps/web/src/app/dashboard/season/[seasonId]/loading.tsx`
- Create: `apps/web/src/app/dashboard/season/[seasonId]/season-page-client.tsx`
- Create: `apps/web/src/app/dashboard/season/[seasonId]/_components/SeasonBreadcrumb.tsx`
- Create: `apps/web/src/app/dashboard/season/[seasonId]/_components/SeasonSubmenu.tsx`

- [ ] **Step 1: Write server page**

```tsx
// apps/web/src/app/dashboard/season/[seasonId]/page.tsx
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { resolveDashboardContext } from "@/app/dashboard/_data/resolve-page-context";
import { SeasonPageClient } from "./season-page-client";
import SeasonPageLoading from "./loading";

export default async function SeasonPage({
  params,
  searchParams,
}: {
  params: Promise<{ seasonId: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const { seasonId } = await params;
  const { tab } = await searchParams;

  const ctx = await resolveDashboardContext();
  if (!ctx) notFound();

  return (
    <Suspense fallback={<SeasonPageLoading />}>
      <SeasonPageClient
        seasonId={seasonId}
        initialTab={(tab as TabKey) ?? "budget"}
        workspaceId={ctx.workspace.workspace_id}
      />
    </Suspense>
  );
}

type TabKey = "budget" | "day" | "hour" | "hours" | "overview";
```

- [ ] **Step 2: Write loading skeleton**

```tsx
// apps/web/src/app/dashboard/season/[seasonId]/loading.tsx
export default function SeasonPageLoading() {
  return (
    <div className="container mx-auto max-w-6xl px-6 py-8" aria-busy="true" aria-label="Laster sesong">
      <div className="mb-6 h-4 w-64 animate-pulse rounded bg-muted" />
      <div className="mb-4 flex gap-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-9 w-24 animate-pulse rounded-md bg-muted" />
        ))}
      </div>
      <div className="h-96 animate-pulse rounded-xl bg-muted" />
    </div>
  );
}
```

- [ ] **Step 3: Write client shell with submenu routing**

```tsx
// apps/web/src/app/dashboard/season/[seasonId]/season-page-client.tsx
"use client";

import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { notFound } from "next/navigation";
import { useSeasons } from "@/app/dashboard/year-wheel/_hooks";
import { useTelemetry } from "@smartout/telemetry/client";
import { SeasonBreadcrumb } from "./_components/SeasonBreadcrumb";
import { SeasonSubmenu } from "./_components/SeasonSubmenu";
import { BudgetSetupTab } from "./_components/BudgetSetupTab";
import { DayFactorsTab } from "./_components/DayFactorsTab";
import { HourFactorsTab } from "./_components/HourFactorsTab";
import { SeasonHoursTab } from "./_components/SeasonHoursTab";
import { SeasonOverviewTab } from "./_components/SeasonOverviewTab";
import { useSeasonBudget } from "@/app/dashboard/year-wheel/_hooks";

export type TabKey = "budget" | "day" | "hour" | "hours" | "overview";
const VALID_TABS: readonly TabKey[] = ["budget", "day", "hour", "hours", "overview"];

type Props = {
  seasonId: string;
  initialTab: TabKey;
  workspaceId: string;
};

export function SeasonPageClient({ seasonId, initialTab, workspaceId }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { emit } = useTelemetry();

  const { data: seasons, isLoading } = useSeasons();
  const season = seasons?.find((s) => s.season_id === seasonId);

  const rawTab = searchParams.get("tab");
  const activeTab: TabKey = VALID_TABS.includes(rawTab as TabKey) ? (rawTab as TabKey) : initialTab;

  const { budget } = useSeasonBudget(seasonId);

  // Fire page-view telemetry on mount and tab changes
  useEffect(() => {
    if (!season) return;
    emit({
      event: "season year_wheel_viewed",
      workspace_id: workspaceId,
      actor_id: "", // BFF fills from resolveDashboardContext client companion
      properties: {
        data: {
          year: season.start_date ? new Date(season.start_date).getUTCFullYear() : new Date().getUTCFullYear(),
          seasons_count: seasons?.length ?? 0,
        },
      },
    });
  }, [season, seasons, emit, workspaceId]);

  if (isLoading) return null; // Suspense shows loading.tsx
  if (!season) notFound();

  const handleTabChange = (next: TabKey) => {
    if (next === activeTab) return;
    emit({
      event: "season tab_changed",
      workspace_id: workspaceId,
      actor_id: "",
      properties: {
        entity: {
          entity_type: "season",
          entity_id: seasonId,
          entity_label: season.name,
        },
        data: { from: activeTab, to: next },
      },
    });
    const params = new URLSearchParams(searchParams);
    params.set("tab", next);
    router.push(`/dashboard/season/${seasonId}?${params.toString()}`);
  };

  return (
    <div className="container mx-auto max-w-6xl px-6 py-8">
      <SeasonBreadcrumb
        year={season.start_date ? new Date(season.start_date).getUTCFullYear() : new Date().getUTCFullYear()}
        seasonName={season.name}
        status={season.status}
      />
      <SeasonSubmenu active={activeTab} onChange={handleTabChange} />
      <div className="mt-6">
        {activeTab === "budget" && (
          <BudgetSetupTab seasonId={seasonId} seasonBudgetId={budget?.season_budget_id ?? null} />
        )}
        {activeTab === "day" && <DayFactorsTab seasonBudgetId={budget?.season_budget_id ?? null} />}
        {activeTab === "hour" && <HourFactorsTab seasonBudgetId={budget?.season_budget_id ?? null} />}
        {activeTab === "hours" && <SeasonHoursTab seasonId={seasonId} />}
        {activeTab === "overview" && (
          <SeasonOverviewTab
            seasonId={seasonId}
            seasonBudgetId={budget?.season_budget_id ?? ""}
            seasonStartDate={season.start_date}
            seasonEndDate={season.end_date}
          />
        )}
      </div>
    </div>
  );
}
```

(Note: adjust prop shapes to match the actual exported props of each copied tab — read the tab files to verify.)

- [ ] **Step 4: Write breadcrumb**

```tsx
// apps/web/src/app/dashboard/season/[seasonId]/_components/SeasonBreadcrumb.tsx
import Link from "next/link";
import { ChevronLeft } from "lucide-react";

type Props = {
  year: number;
  seasonName: string;
  status: "draft" | "active" | "archived";
};

const STATUS_LABEL: Record<Props["status"], string> = {
  draft: "Utkast",
  active: "Aktiv",
  archived: "Arkivert",
};

export function SeasonBreadcrumb({ year, seasonName, status }: Props) {
  return (
    <nav className="mb-4 flex items-center gap-2 text-sm text-muted-foreground" aria-label="Breadcrumb">
      <Link
        href={`/dashboard/year-wheel?year=${year}`}
        className="inline-flex items-center gap-1 hover:text-foreground"
      >
        <ChevronLeft className="h-4 w-4" />
        Årshjul {year}
      </Link>
      <span>/</span>
      <span className="text-foreground">{seasonName}</span>
      <span>·</span>
      <span>{STATUS_LABEL[status]}</span>
    </nav>
  );
}
```

- [ ] **Step 5: Write submenu tab strip**

```tsx
// apps/web/src/app/dashboard/season/[seasonId]/_components/SeasonSubmenu.tsx
"use client";

import type { TabKey } from "../season-page-client";

const TABS: readonly { key: TabKey; label: string }[] = [
  { key: "budget", label: "Budsjett" },
  { key: "day", label: "Dag" },
  { key: "hour", label: "Time" },
  { key: "hours", label: "Åpningstider" },
  { key: "overview", label: "Oversikt" },
];

type Props = {
  active: TabKey;
  onChange: (next: TabKey) => void;
};

export function SeasonSubmenu({ active, onChange }: Props) {
  return (
    <div role="tablist" aria-label="Sesongseksjoner" className="flex gap-1 border-b border-border">
      {TABS.map((tab) => {
        const isActive = tab.key === active;
        return (
          <button
            key={tab.key}
            role="tab"
            aria-selected={isActive}
            aria-controls={`season-tab-${tab.key}`}
            onClick={() => onChange(tab.key)}
            className={`relative px-4 py-2 text-sm font-medium transition-colors ${
              isActive
                ? "text-foreground after:absolute after:inset-x-0 after:-bottom-px after:h-0.5 after:bg-orange-500"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}
```

(Use the Nordic brand-orange token — verify the correct Tailwind utility; if `bg-orange-500` is not a project token, swap to `bg-[var(--brand)]` or the tokens file reference.)

- [ ] **Step 6: Smoke — visit the route**

Start dev server: `op run --env-file=.env.template -- pnpm -F @smartout/web dev`. Pick an existing season id from `SELECT season_id, name FROM season LIMIT 1;` in Supabase Local, then open:

```
http://localhost:3060/dashboard/season/<season-id>?tab=budget
```

Expected: page renders with breadcrumb, submenu, and Budget tab content. Clicking a tab updates URL and swaps content.

- [ ] **Step 7: Typecheck + commit**

```bash
pnpm turbo typecheck --filter=@smartout/web
git add apps/web/src/app/dashboard/season/
git commit -m "$(cat <<'EOF'
feat(season): scaffold /dashboard/season/[seasonId] route with submenu

Server page + loading skeleton + client shell with 5-tab submenu
(Budsjett / Dag / Time / Åpningstider / Oversikt). Default tab is
budget. Tab clicks use router.push (Back returns to previous tab).
Emits "season year_wheel_viewed" on mount and "season tab_changed"
on switch.

Ref: docs/superpowers/specs/2026-04-20-year-wheel-redesign-design.md §5

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Phase 2 — Year-Wheel Shell Components

Spec §3 — isolated components, no wiring to page yet. Each component is a separate commit so review is granular.

### Task 2.1: `YearWheelTopbar`

**Files:**
- Create: `apps/web/src/app/dashboard/year-wheel/_components/shell/YearWheelTopbar.tsx`

- [ ] **Step 1: Scaffold the component**

Implement per spec §3.2. Key props and structure:

```tsx
// apps/web/src/app/dashboard/year-wheel/_components/shell/YearWheelTopbar.tsx
"use client";

import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";

type Props = {
  year: number;
  onYearChange: (year: number) => void;
  onNewSeasonHint: () => void; // shows toast "Dra i lerretet for å tegne en sesong"
};

export function YearWheelTopbar({ year, onYearChange, onNewSeasonHint }: Props) {
  return (
    <header className="flex items-center gap-4 border-b border-border bg-card px-7 py-3.5">
      <div className="text-[11px] font-semibold uppercase tracking-[2px] text-muted-foreground">
        Smartout <span className="mx-1.5 opacity-50">/</span> Planlegging
      </div>
      <h1 className="m-0 font-heading text-[28px] font-normal tracking-[-0.02em]">
        Årshjul
      </h1>
      <div className="ml-2 flex items-center gap-0.5">
        <button
          onClick={() => onYearChange(year - 1)}
          className="inline-flex h-7 w-7 items-center justify-center rounded-md text-foreground hover:bg-muted"
          aria-label="Forrige år"
        >
          <ChevronLeft className="h-3.5 w-3.5" strokeWidth={2.2} />
        </button>
        <div className="min-w-[60px] px-2.5 text-center font-mono text-[15px] font-bold">
          {year}
        </div>
        <button
          onClick={() => onYearChange(year + 1)}
          className="inline-flex h-7 w-7 items-center justify-center rounded-md text-foreground hover:bg-muted"
          aria-label="Neste år"
        >
          <ChevronRight className="h-3.5 w-3.5" strokeWidth={2.2} />
        </button>
      </div>
      <div className="ml-auto flex items-center gap-2.5">
        <Button onClick={onNewSeasonHint} size="sm" className="gap-1.5">
          <Plus className="h-3.5 w-3.5" strokeWidth={2.4} />
          Ny sesong
        </Button>
      </div>
    </header>
  );
}
```

Omits the "Seeded fra Riksavtalen" pill per spec §7.4 (deferred).

- [ ] **Step 2: Typecheck**

Run: `pnpm turbo typecheck --filter=@smartout/web`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/app/dashboard/year-wheel/_components/shell/YearWheelTopbar.tsx
git commit -m "feat(year-wheel): YearWheelTopbar component per spec §3.2"
```

### Task 2.2: `SeasonSidebar`

**Files:**
- Create: `apps/web/src/app/dashboard/year-wheel/_components/shell/SeasonSidebar.tsx`

- [ ] **Step 1: Scaffold**

Implement per spec §3.3. Props:

```tsx
type FilterKey = "all" | "active" | "draft" | "archived";
type Props = {
  seasons: Season[];
  selectedId: string | null;
  filter: FilterKey;
  onSelect: (id: string) => void;
  onFilterChange: (filter: FilterKey) => void;
  year: number;
};
```

Structure: aside `className="hidden md:flex md:w-[260px] xl:w-[260px] lg:w-[220px] shrink-0 flex-col overflow-y-auto border-r border-border bg-card"`. Header with filter pills (role="tablist"), list of season buttons with 3px status-color bar + name + dates (font-mono), gap badge if `season.missing?.length > 0`, footer tip "Tegn nye sesonger — klikk og dra i lerretet".

- [ ] **Step 2: Wire filter telemetry**

On filter change, emit `"season sidebar_filter_changed"` with `data: { filter }`.

- [ ] **Step 3: Typecheck + visual smoke + commit**

```bash
pnpm turbo typecheck --filter=@smartout/web
git add apps/web/src/app/dashboard/year-wheel/_components/shell/SeasonSidebar.tsx
git commit -m "feat(year-wheel): SeasonSidebar with filter pills + season list per §3.3"
```

### Task 2.3: `CompanionRail`

**Files:**
- Create: `apps/web/src/app/dashboard/year-wheel/_components/shell/CompanionRail.tsx`

- [ ] **Step 1: Scaffold per spec §3.5**

Three cards: "Aktiv nå" (if an active season exists), "Neste hendelser" (top 4 upcoming planning events), "Gaps før aktivering" (drafts with `missing?.length > 0`). Width 280px, hidden at `<1280px` via Tailwind `hidden xl:flex`.

Revenue actual: render "—" + 0%-filled bar (no data plumbed yet).

- [ ] **Step 2: Typecheck + visual smoke + commit**

```bash
git add apps/web/src/app/dashboard/year-wheel/_components/shell/CompanionRail.tsx
git commit -m "feat(year-wheel): CompanionRail with active snapshot + next events + gaps"
```

### Task 2.4: `LegendChip`

**Files:**
- Create: `apps/web/src/app/dashboard/year-wheel/_components/shell/LegendChip.tsx`

- [ ] **Step 1: Scaffold per spec §3.6**

Horizontal chip with block-status swatches, pin-category dots (internal=muted, cultural_commercial=brand-orange, business_critical=destructive), AI dashed swatch, `◷` marker. No state, no props beyond optional className.

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/app/dashboard/year-wheel/_components/shell/LegendChip.tsx
git commit -m "feat(year-wheel): LegendChip static visual reference"
```

### Task 2.5: `AiSuggestionCard` — empty-state only

**Files:**
- Create: `apps/web/src/app/dashboard/year-wheel/_components/shell/AiSuggestionCard.tsx`

- [ ] **Step 1: Scaffold per spec §3.6 (post-council rewrite)**

```tsx
// apps/web/src/app/dashboard/year-wheel/_components/shell/AiSuggestionCard.tsx
import { Sparkles } from "lucide-react";

// Empty-state scaffold per L-0046 theatre rule. When a real AI suggestion
// engine lands, a separate ADR introduces the event, the buttons, and
// the handler together. Until then: no buttons, no emit, no registered event.
export function AiSuggestionCard() {
  return (
    <div
      className="flex items-start gap-3 rounded-xl border border-dashed border-muted/50 bg-muted/20 px-4 py-3.5"
      aria-label="AI-forslag kommer snart"
    >
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-muted">
        <Sparkles className="h-4 w-4 text-muted-foreground" />
      </div>
      <div className="flex-1">
        <div className="text-sm font-medium text-muted-foreground">
          Ingen AI-forslag ennå
        </div>
        <div className="text-xs text-muted-foreground/80">
          Kommer når forslagsmotoren er koblet på.
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/app/dashboard/year-wheel/_components/shell/AiSuggestionCard.tsx
git commit -m "feat(year-wheel): AiSuggestionCard empty-state only (L-0046)"
```

---

## Phase 3 — Canvas Rebuild

Spec §3.4 + §4.1 + §8.1–8.2. Canvas owns month guides, lane-packed blocks, pins, watermark, draw-to-create. Highest-risk component — TDD the pure functions first.

### Task 3.1: Lane-packing (pure function + test)

**Files:**
- Create: `apps/web/src/app/dashboard/year-wheel/_components/canvas/lane-pack.ts`
- Create: `apps/web/src/app/dashboard/year-wheel/_components/canvas/lane-pack.test.ts`

- [ ] **Step 1: Write failing test**

```ts
// apps/web/src/app/dashboard/year-wheel/_components/canvas/lane-pack.test.ts
import { describe, it, expect } from "vitest";
import { assignLanes, type LaneableSeason } from "./lane-pack";

const mk = (id: string, start: string, end: string): LaneableSeason => ({
  season_id: id,
  start_date: start,
  end_date: end,
});

describe("assignLanes", () => {
  it("places non-overlapping seasons on lane 0", () => {
    const result = assignLanes([
      mk("a", "2026-01-01", "2026-02-01"),
      mk("b", "2026-03-01", "2026-04-01"),
    ]);
    expect(result.map((s) => s.lane)).toEqual([0, 0]);
  });

  it("puts overlapping seasons on separate lanes", () => {
    const result = assignLanes([
      mk("a", "2026-01-01", "2026-06-01"),
      mk("b", "2026-03-01", "2026-09-01"),
    ]);
    expect(result.find((s) => s.season_id === "a")!.lane).toBe(0);
    expect(result.find((s) => s.season_id === "b")!.lane).toBe(1);
  });

  it("reuses lane 0 when an earlier season has ended", () => {
    const result = assignLanes([
      mk("a", "2026-01-01", "2026-02-01"),
      mk("b", "2026-01-15", "2026-03-01"),
      mk("c", "2026-04-01", "2026-05-01"),
    ]);
    expect(result.find((s) => s.season_id === "c")!.lane).toBe(0);
  });

  it("sorts input by start date before assigning", () => {
    const result = assignLanes([
      mk("later", "2026-06-01", "2026-08-01"),
      mk("earlier", "2026-01-01", "2026-03-01"),
    ]);
    expect(result[0].season_id).toBe("earlier");
  });

  it("handles seasons with null dates by skipping them", () => {
    const result = assignLanes([
      { season_id: "null", start_date: null, end_date: null },
      mk("ok", "2026-01-01", "2026-02-01"),
    ]);
    expect(result.find((s) => s.season_id === "null")).toBeUndefined();
    expect(result.find((s) => s.season_id === "ok")!.lane).toBe(0);
  });
});
```

- [ ] **Step 2: Run — FAIL**

Run: `pnpm -F @smartout/web test lane-pack`
Expected: FAIL (module does not exist).

- [ ] **Step 3: Implement**

```ts
// apps/web/src/app/dashboard/year-wheel/_components/canvas/lane-pack.ts
export type LaneableSeason = {
  season_id: string;
  start_date: string | null;
  end_date: string | null;
};

export type LanedSeason<T extends LaneableSeason> = T & { lane: number };

export function assignLanes<T extends LaneableSeason>(seasons: T[]): LanedSeason<T>[] {
  const withDates = seasons.filter(
    (s): s is T & { start_date: string; end_date: string } =>
      s.start_date != null && s.end_date != null,
  );
  const sorted = [...withDates].sort((a, b) => a.start_date.localeCompare(b.start_date));
  const laneEnds: string[] = [];

  return sorted.map((season) => {
    for (let i = 0; i < laneEnds.length; i++) {
      if (laneEnds[i]! < season.start_date) {
        laneEnds[i] = season.end_date;
        return { ...season, lane: i };
      }
    }
    laneEnds.push(season.end_date);
    return { ...season, lane: laneEnds.length - 1 };
  });
}
```

- [ ] **Step 4: Run — PASS**

Run: `pnpm -F @smartout/web test lane-pack`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/app/dashboard/year-wheel/_components/canvas/lane-pack.ts apps/web/src/app/dashboard/year-wheel/_components/canvas/lane-pack.test.ts
git commit -m "feat(year-wheel): pure assignLanes helper + tests"
```

### Task 3.2: `NormalDriftWatermark`

**Files:**
- Create: `apps/web/src/app/dashboard/year-wheel/_components/canvas/NormalDriftWatermark.tsx`

- [ ] **Step 1: Scaffold per spec §3.4.1**

```tsx
// apps/web/src/app/dashboard/year-wheel/_components/canvas/NormalDriftWatermark.tsx
// Watermark lives behind blocks. Light-mode: 6% mix. Dark-mode: 10% mix (per spec §3.4.1 override).
export function NormalDriftWatermark({ centerY }: { centerY: number }) {
  return (
    <>
      <div
        aria-hidden
        className="absolute inset-0 pointer-events-none yw-watermark-hatch"
        style={{
          WebkitMaskImage: "linear-gradient(to bottom, transparent 0, #000 80px, #000 100%)",
          maskImage: "linear-gradient(to bottom, transparent 0, #000 80px, #000 100%)",
        }}
      />
      <div
        aria-hidden
        className="absolute left-1/2 -translate-x-1/2 font-heading italic uppercase tracking-[0.12em] text-muted-foreground/40 text-[22px] pointer-events-none"
        style={{ top: centerY - 12 }}
      >
        Normal drift
      </div>
    </>
  );
}
```

Add the hatch + dark-mode override to `apps/web/src/app/globals.css`:

```css
.yw-watermark-hatch {
  background-image: repeating-linear-gradient(
    135deg,
    transparent 0 14px,
    color-mix(in oklab, var(--muted) 6%, transparent) 14px 15px
  );
}

:where([data-theme="dark"]) .yw-watermark-hatch {
  background-image: repeating-linear-gradient(
    135deg,
    transparent 0 14px,
    color-mix(in oklab, var(--muted) 10%, transparent) 14px 15px
  );
}
```

- [ ] **Step 2: Typecheck + commit**

```bash
git add apps/web/src/app/dashboard/year-wheel/_components/canvas/NormalDriftWatermark.tsx apps/web/src/app/globals.css
git commit -m "feat(year-wheel): NormalDriftWatermark with dark-mode override"
```

### Task 3.3: `TimelineBlock` (new)

**Files:**
- Create: `apps/web/src/app/dashboard/year-wheel/_components/canvas/TimelineBlock.tsx`

- [ ] **Step 1: Implement per spec §3.4.5**

```tsx
"use client";

import { motion } from "framer-motion";
import type { Season } from "@/app/dashboard/year-wheel/_hooks";

type Props = {
  season: Season & { lane: number };
  x: number;
  width: number;
  y: number;
  height: number;
  isSelected: boolean;
  onSelect: (id: string) => void;
};

export function TimelineBlock({ season, x, width, y, height, isSelected, onSelect }: Props) {
  const isActive = season.status === "active";
  const isDraft = season.status === "draft";
  const isArchived = season.status === "archived";
  const baseColor = season.color ?? "var(--brand)";

  const bg = isActive
    ? baseColor
    : isArchived
      ? `color-mix(in oklab, ${baseColor} 25%, var(--secondary))`
      : `color-mix(in oklab, ${baseColor} 12%, var(--card))`;

  return (
    <motion.button
      type="button"
      onClick={() => onSelect(season.season_id)}
      className="absolute overflow-hidden whitespace-nowrap rounded-[10px] px-3 text-sm font-semibold text-ellipsis"
      style={{
        left: x,
        top: y,
        width: Math.max(20, width),
        height,
        background: bg,
        color: isActive ? "#fff" : "var(--foreground)",
        border: isDraft
          ? `1.5px dashed ${baseColor}`
          : isSelected
            ? "2px solid var(--foreground)"
            : "1px solid transparent",
        boxShadow: isActive
          ? `0 2px 8px color-mix(in oklab, ${baseColor} 25%, transparent)`
          : undefined,
        zIndex: isSelected ? 3 : 2,
      }}
      whileHover={{ y: y - 1 }}
      transition={{ type: "spring", stiffness: 400, damping: 30, mass: 0.8 }}
      aria-label={`${season.name}, ${season.start_date} til ${season.end_date}, status ${season.status}`}
    >
      {isActive && (
        <span
          className="mr-2 inline-block h-1.5 w-1.5 rounded-full bg-white"
          style={{ boxShadow: "0 0 0 3px rgba(255,255,255,0.25)" }}
        />
      )}
      {season.name}
    </motion.button>
  );
}
```

Uses Tier B spring (stiffness 400 / damping 30 / mass 0.8) for hover per spec §8.1.

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/app/dashboard/year-wheel/_components/canvas/TimelineBlock.tsx
git commit -m "feat(year-wheel): new TimelineBlock with status-aware styling (Tier B motion)"
```

### Task 3.4: `TimelinePin` (new, 24×24 hit-area)

**Files:**
- Create: `apps/web/src/app/dashboard/year-wheel/_components/canvas/TimelinePin.tsx`

- [ ] **Step 1: Implement per spec §3.4.4 + §8.2 hit-area rule**

```tsx
"use client";

import { useState } from "react";
import type { PlanningEvent } from "@/app/dashboard/year-wheel/_hooks";

type Props = {
  event: PlanningEvent & { x: number; xEnd: number | null };
  onSelect: (id: string) => void;
};

const CAT_COLOR: Record<string, string> = {
  internal: "var(--muted-foreground)",
  cultural_commercial: "var(--brand)",
  business_critical: "var(--destructive)",
};

export function TimelinePin({ event, onSelect }: Props) {
  const [hover, setHover] = useState(false);
  const color = CAT_COLOR[event.category] ?? "var(--muted-foreground)";
  const isRange = event.xEnd != null && event.xEnd > event.x;
  const isAi = event.source === "ai_generated";
  const hasRing = (event.demand_multiplier ?? 1) > 1.5 || (event.demand_multiplier ?? 1) < 0.5;

  if (isRange) {
    const width = Math.max(12, event.xEnd! - event.x);
    return (
      <button
        type="button"
        onClick={() => onSelect(event.planning_event_id)}
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
        className="absolute rounded-[5px]"
        style={{
          left: event.x,
          top: 23, // pinsY - 5
          width,
          height: 10,
          background: `color-mix(in oklab, ${color} 80%, var(--card))`,
          border: `1px solid ${color}`,
        }}
        aria-label={event.name}
      />
    );
  }

  return (
    <button
      type="button"
      onClick={() => onSelect(event.planning_event_id)}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      className="absolute inline-flex items-center justify-center"
      // 24x24 hit-area wraps 12x12 visual dot (spec §8.2)
      style={{ left: event.x - 12, top: 22 - 6, width: 24, height: 24 }}
      aria-label={event.name}
    >
      <span
        aria-hidden
        className="h-3 w-3 rounded-full"
        style={{
          background: isAi ? `color-mix(in oklab, ${color} 40%, var(--card))` : color,
          border: isAi
            ? `2px dashed ${color}`
            : hasRing
              ? `3px solid color-mix(in oklab, ${color} 30%, transparent)`
              : "1.5px solid var(--card)",
          boxShadow: "0 1px 2px rgba(0,0,0,0.15)",
          transform: hover ? "scale(1.2)" : "scale(1)",
          transition: "transform 150ms",
        }}
      />
    </button>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/app/dashboard/year-wheel/_components/canvas/TimelinePin.tsx
git commit -m "feat(year-wheel): new TimelinePin with 24x24 accessible hit-area"
```

### Task 3.5: `DrawPhantom`

**Files:**
- Create: `apps/web/src/app/dashboard/year-wheel/_components/canvas/DrawPhantom.tsx`

- [ ] **Step 1: Implement per spec §4.1**

```tsx
"use client";

type Props = {
  startX: number;
  currentX: number;
  top: number;
  height: number;
  startDate: string;
  endDate: string;
};

export function DrawPhantom({ startX, currentX, top, height, startDate, endDate }: Props) {
  const left = Math.min(startX, currentX);
  const width = Math.abs(currentX - startX);
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute flex items-center justify-center rounded-[10px] font-mono text-xs font-semibold"
      style={{
        left,
        top,
        width,
        height,
        background: "color-mix(in oklab, var(--brand) 18%, transparent)",
        border: "1.5px dashed var(--brand)",
        color: "var(--brand)",
      }}
    >
      <span aria-live="polite" className="sr-only">
        Tegner sesong {startDate} til {endDate}
      </span>
      <span>
        {startDate} → {endDate}
      </span>
    </div>
  );
}
```

`aria-live` region announces the date range as the user drags.

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/app/dashboard/year-wheel/_components/canvas/DrawPhantom.tsx
git commit -m "feat(year-wheel): DrawPhantom with aria-live date announcement"
```

### Task 3.6: `YearCanvas` — wire it all together

**Files:**
- Create: `apps/web/src/app/dashboard/year-wheel/_components/canvas/YearCanvas.tsx`

- [ ] **Step 1: Implement per spec §3.4 + §4.1**

Key responsibilities:
- ResizeObserver sets canvas width
- Month guides (12 vertical lines + uppercase labels)
- Today marker (post-mount deferred — carry forward the hydration-safe pattern from the existing `YearWheelTimeline.tsx:100-115`)
- `NormalDriftWatermark` layered behind blocks
- Pin row (uses `TimelinePin`)
- Lane-packed block row (uses `TimelineBlock` + `assignLanes`)
- `DrawPhantom` during draw
- Mouse handlers for draw-to-create: `mousedown` → `mousemove` → `mouseup` (commit or cancel)
- `mouseleave` and `Esc` cancel the draw
- Emits `"season draw_started"`, `"season draw_completed"`, `"season draw_cancelled"`

Reference the existing `YearWheelTimeline.tsx` for the date-math + resize observer idioms (keep, don't reinvent). Dimensions: `laneH = 44`, `pinsY = 28`, `blocksStartY = 60`. Cursor: `crosshair` normally, `ew-resize` during draw.

Props:

```tsx
type Props = {
  year: number;
  seasons: Season[];
  events: PlanningEvent[];
  selectedId: string | null;
  onSelectSeason: (id: string) => void;
  onSelectEvent: (id: string) => void;
  onDrawCreate: (args: { start: string; end: string }) => void;
};
```

- [ ] **Step 2: Add keyboard Esc handler**

Inside `YearCanvas`, on mount:

```tsx
useEffect(() => {
  const onKey = (e: KeyboardEvent) => {
    if (e.key === "Escape" && drawRef.current) {
      cancelDraw("esc");
    }
  };
  window.addEventListener("keydown", onKey);
  return () => window.removeEventListener("keydown", onKey);
}, []);
```

- [ ] **Step 3: Visual smoke**

Render `<YearCanvas>` alone with mock data in a test harness route or storybook (if available) OR temporarily wire into the existing page to smoke it. Verify: watermark shows, blocks render on lanes, pins render at correct dates, draw-to-create produces phantom with live dates, Esc cancels, mouseleave cancels.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/app/dashboard/year-wheel/_components/canvas/YearCanvas.tsx
git commit -m "feat(year-wheel): YearCanvas linear timeline with watermark + draw-to-create

Wires TimelineBlock + TimelinePin + DrawPhantom + NormalDriftWatermark.
Emits season draw_started / draw_completed / draw_cancelled. Esc and
mouseleave cancel an in-progress draw. Carries forward the post-mount
today-marker defer from the old YearWheelTimeline to avoid hydration
mismatch."
```

---

## Phase 4 — Quick-Create Sheet

### Task 4.1: `SeasonQuickCreateSheet`

**Files:**
- Create: `apps/web/src/app/dashboard/year-wheel/_components/SeasonQuickCreateSheet.tsx`

- [ ] **Step 1: Implement per spec §4.2**

```tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { useSeasons, usePlanningCycles } from "@/app/dashboard/year-wheel/_hooks";
import { toast } from "sonner";

const COLOR_PRESETS = [
  "var(--brand)",
  "#c18200",
  "#e7000b",
  "#2784d5",
  "#864ad2",
  "#2ba85a",
];

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialStart: string;
  initialEnd: string;
  year: number;
  onAbandon?: (reason: "sheet_abandoned") => void;
};

export function SeasonQuickCreateSheet({
  open,
  onOpenChange,
  initialStart,
  initialEnd,
  year,
  onAbandon,
}: Props) {
  const router = useRouter();
  const { createSeason } = useSeasons();
  const { data: cycles } = usePlanningCycles();
  const activeCycleForYear = cycles?.find(
    (c) => new Date(c.start_date).getUTCFullYear() === year,
  );

  const [name, setName] = useState("Ny sesong");
  const [startDate, setStartDate] = useState(initialStart);
  const [endDate, setEndDate] = useState(initialEnd);
  const [color, setColor] = useState(COLOR_PRESETS[0]!);
  const [submitting, setSubmitting] = useState(false);

  const handleClose = (next: boolean) => {
    if (!next && !submitting) {
      onAbandon?.("sheet_abandoned");
    }
    onOpenChange(next);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const created = await createSeason.mutateAsync({
        name: name.trim(),
        startDate,
        endDate,
        color,
        planningCycleId: activeCycleForYear?.planning_cycle_id ?? null,
      });
      onOpenChange(false);
      router.push(`/dashboard/season/${created.season_id}?tab=budget`);
    } catch (err: unknown) {
      toast.error(`Kunne ikke opprette sesong: ${(err as Error).message}`);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={handleClose}>
      <SheetContent side="right" className="w-full sm:max-w-md">
        <form onSubmit={handleSubmit}>
          <SheetHeader>
            <SheetTitle className="font-heading">Ny sesong</SheetTitle>
            <SheetDescription>Fyll inn navn og bekreft perioden.</SheetDescription>
          </SheetHeader>
          <div className="my-6 space-y-5">
            <div>
              <Label htmlFor="season-name">Navn</Label>
              <Input
                id="season-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                autoFocus
                minLength={1}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="start-date">Start</Label>
                <Input
                  id="start-date"
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  required
                />
              </div>
              <div>
                <Label htmlFor="end-date">Slutt</Label>
                <Input
                  id="end-date"
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  required
                />
              </div>
            </div>
            <div>
              <Label>Farge</Label>
              <div className="mt-1.5 flex gap-2">
                {COLOR_PRESETS.map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => setColor(preset)}
                    className={`h-7 w-7 rounded-full border-2 ${
                      color === preset ? "border-foreground" : "border-transparent"
                    }`}
                    style={{ background: preset }}
                    aria-label={`Velg farge ${preset}`}
                  />
                ))}
              </div>
            </div>
            {!activeCycleForYear && (
              <div className="rounded-md border border-dashed border-muted p-3 text-xs text-muted-foreground">
                Ingen planning cycle for {year}. Sesongen opprettes uten cycle-binding.
              </div>
            )}
          </div>
          <SheetFooter>
            <Button type="button" variant="outline" onClick={() => handleClose(false)}>
              Avbryt
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? "Oppretter…" : "Opprett sesong"}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}
```

- [ ] **Step 2: Typecheck + commit**

```bash
pnpm turbo typecheck --filter=@smartout/web
git add apps/web/src/app/dashboard/year-wheel/_components/SeasonQuickCreateSheet.tsx
git commit -m "feat(year-wheel): SeasonQuickCreateSheet with Enter-submits form"
```

---

## Phase 5 — Shell Integration

### Task 5.1: Rewrite `year-wheel-page-client.tsx`

**Files:**
- Modify: `apps/web/src/app/dashboard/year-wheel/year-wheel-page-client.tsx` (full rewrite)

- [ ] **Step 1: Replace the file content**

New structure:

```tsx
"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { YearWheelTopbar } from "./_components/shell/YearWheelTopbar";
import { SeasonSidebar } from "./_components/shell/SeasonSidebar";
import { CompanionRail } from "./_components/shell/CompanionRail";
import { LegendChip } from "./_components/shell/LegendChip";
import { AiSuggestionCard } from "./_components/shell/AiSuggestionCard";
import { YearCanvas } from "./_components/canvas/YearCanvas";
import { SeasonQuickCreateSheet } from "./_components/SeasonQuickCreateSheet";
import { useSeasons, usePlanningEvents } from "./_hooks";
import { useTelemetry } from "@smartout/telemetry/client";

type FilterKey = "all" | "active" | "draft" | "archived";

type Props = { workspaceId: string };

export function YearWheelPageClient({ workspaceId }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { emit } = useTelemetry();

  const urlYear = searchParams.get("year");
  const year = urlYear ? parseInt(urlYear, 10) : new Date().getUTCFullYear();

  const [filter, setFilter] = useState<FilterKey>("all");
  const [quickCreate, setQuickCreate] = useState<{ start: string; end: string } | null>(null);

  const { data: seasons } = useSeasons();
  const { data: events } = usePlanningEvents({ year });

  const filteredSeasons = (seasons ?? []).filter((s) => {
    if (filter === "all") return true;
    return s.status === filter;
  });

  const handleYearChange = (next: number) => {
    const params = new URLSearchParams(searchParams);
    params.set("year", String(next));
    router.push(`/dashboard/year-wheel?${params.toString()}`);
    emit({
      event: "season year_navigated",
      workspace_id: workspaceId,
      actor_id: "",
      properties: { data: { from: year, to: next } },
    });
  };

  const handleFilterChange = (next: FilterKey) => {
    setFilter(next);
    emit({
      event: "season sidebar_filter_changed",
      workspace_id: workspaceId,
      actor_id: "",
      properties: { data: { filter: next } },
    });
  };

  const handleNewSeasonHint = () => {
    toast.info("Klikk og dra i lerretet for å tegne en sesong.");
  };

  const handleSelectSeason = (id: string) => {
    router.push(`/dashboard/season/${id}?tab=budget`);
    emit({
      event: "season block_clicked",
      workspace_id: workspaceId,
      actor_id: "",
      properties: {
        entity: { entity_type: "season", entity_id: id, entity_label: seasons?.find((s) => s.season_id === id)?.name ?? "" },
      },
    });
  };

  const handleSelectEvent = (id: string) => {
    // Keep existing PlanningEventDialog behavior — import and render the dialog component here
    // (or set local state to show it). Spec §6 says existing dialog is preserved.
    emit({
      event: "season pin_clicked",
      workspace_id: workspaceId,
      actor_id: "",
      properties: {
        entity: { entity_type: "planning_event", entity_id: id, entity_label: events?.find((e) => e.planning_event_id === id)?.name ?? "" },
      },
    });
    // open dialog...
  };

  const handleDrawCreate = ({ start, end }: { start: string; end: string }) => {
    setQuickCreate({ start, end });
    emit({
      event: "season draw_completed",
      workspace_id: workspaceId,
      actor_id: "",
      properties: { data: { start, end, lane: 0 } },
    });
  };

  return (
    <div className="flex h-screen flex-col bg-background text-foreground">
      <YearWheelTopbar year={year} onYearChange={handleYearChange} onNewSeasonHint={handleNewSeasonHint} />
      <div className="flex min-h-0 flex-1">
        <SeasonSidebar
          seasons={seasons ?? []}
          selectedId={null}
          filter={filter}
          onSelect={handleSelectSeason}
          onFilterChange={handleFilterChange}
          year={year}
        />
        <main className="flex min-w-0 flex-1 flex-col gap-4 overflow-auto p-6">
          <div>
            <h2 className="mb-1 font-heading text-[40px] font-normal italic tracking-[-0.025em]">
              Hele året i ett blikk
            </h2>
            <p className="max-w-[680px] text-sm leading-relaxed text-muted-foreground">
              Ikke-sesong er <b className="font-medium text-foreground">Normal drift</b> — arvet fra workspace. Fargede blokker overstyrer lokalt. Klikk og dra for å tegne nye sesonger.
            </p>
          </div>
          <YearCanvas
            year={year}
            seasons={filteredSeasons}
            events={events ?? []}
            selectedId={null}
            onSelectSeason={handleSelectSeason}
            onSelectEvent={handleSelectEvent}
            onDrawCreate={handleDrawCreate}
          />
          <LegendChip />
          <AiSuggestionCard />
        </main>
        <CompanionRail seasons={seasons ?? []} events={events ?? []} year={year} />
      </div>
      {quickCreate && (
        <SeasonQuickCreateSheet
          open={!!quickCreate}
          onOpenChange={(open) => !open && setQuickCreate(null)}
          initialStart={quickCreate.start}
          initialEnd={quickCreate.end}
          year={year}
          onAbandon={(reason) => {
            emit({
              event: "season draw_cancelled",
              workspace_id: workspaceId,
              actor_id: "",
              properties: { data: { reason } },
            });
          }}
        />
      )}
    </div>
  );
}
```

- [ ] **Step 2: Update `page.tsx` if signature changed**

If the new client accepts `workspaceId`, make sure `page.tsx` passes it:

```tsx
// apps/web/src/app/dashboard/year-wheel/page.tsx — verify this
const ctx = await resolveDashboardContext();
return <YearWheelPageClient workspaceId={ctx.workspace.workspace_id} />;
```

- [ ] **Step 3: Full smoke on the route**

Start dev server and open `http://localhost:3060/dashboard/year-wheel`. Verify:
- 3-column layout renders
- Topbar year-nav works
- Sidebar filter pills work
- Canvas shows watermark + blocks + pins
- Draw on canvas opens quick-create sheet
- Submit creates season and redirects to `/dashboard/season/[id]?tab=budget`
- Clicking a block also routes to the season page
- Filter change emits telemetry (check dev logger or PostHog)

- [ ] **Step 4: Typecheck + commit**

```bash
pnpm turbo typecheck --filter=@smartout/web
git add apps/web/src/app/dashboard/year-wheel/year-wheel-page-client.tsx apps/web/src/app/dashboard/year-wheel/page.tsx
git commit -m "$(cat <<'EOF'
feat(year-wheel): rebuild page client with 3-column shell + new canvas

Full rewrite of year-wheel-page-client.tsx. Wires the new
YearWheelTopbar + SeasonSidebar + CompanionRail + YearCanvas +
LegendChip + AiSuggestionCard. Draw-to-create → SeasonQuickCreateSheet
→ redirect to /dashboard/season/[id]?tab=budget. All telemetry
(year_navigated, block_clicked, pin_clicked, sidebar_filter_changed,
draw_completed, draw_cancelled) emits through the typed registry.
Existing PlanningEventDialog preserved for pin-click.

Ref: docs/superpowers/specs/2026-04-20-year-wheel-redesign-design.md §3-§5

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Phase 6 — Polish

### Task 6.1: Replace `prompt()` in `HourFactorsTab` with Popover + Input

**Files:**
- Modify: `apps/web/src/app/dashboard/season/[seasonId]/_components/HourFactorsTab.tsx`

- [ ] **Step 1: Find the `prompt()` call**

Read the file, find where `prompt(` is called in the bar-click handler.

- [ ] **Step 2: Replace with Popover**

Use shadcn `Popover` + `Input`. Structure:

```tsx
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

function HourFactorCell({ hour, value, onChange }: {
  hour: number;
  value: number;
  onChange: (next: number) => void;
}) {
  const [draft, setDraft] = useState(value);
  const [open, setOpen] = useState(false);
  const commit = () => {
    onChange(Math.max(0, draft));
    setOpen(false);
  };
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button className="..." /* existing bar styling */>...</button>
      </PopoverTrigger>
      <PopoverContent className="w-60">
        <label className="text-xs text-muted-foreground">Faktor kl {hour}:00</label>
        <Input
          type="number"
          step="0.1"
          min="0"
          value={draft}
          onChange={(e) => setDraft(parseFloat(e.target.value) || 0)}
          onKeyDown={(e) => {
            if (e.key === "Enter") commit();
            if (e.key === "Escape") setOpen(false);
          }}
          autoFocus
        />
        <div className="mt-2 flex justify-end gap-2">
          <Button size="sm" variant="ghost" onClick={() => setOpen(false)}>Avbryt</Button>
          <Button size="sm" onClick={commit}>Lagre</Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
```

Refactor the existing bar-rendering loop to use `<HourFactorCell />`.

- [ ] **Step 2: Also fix the bar-fill color recipe per spec §8.2**

Replace any `color-mix(in oklab, var(--orange) X%, var(--border))` with `color-mix(in oklab, var(--orange) X%, var(--muted))`.

- [ ] **Step 3: Manual smoke both themes**

Toggle light/dark in the app. Verify the bar-fill is readable in both.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/app/dashboard/season/\[seasonId\]/_components/HourFactorsTab.tsx
git commit -m "refactor(season): replace prompt() with Popover+Input; fix dark-mode bar fill"
```

### Task 6.2: Verify Instrument Serif italic loader

**Files:**
- Modify: `apps/web/src/app/layout.tsx` (if italic not loaded)

- [ ] **Step 1: Check current loader config**

Open `apps/web/src/app/layout.tsx`. Find the Instrument Serif `next/font` import (pattern: `import { Instrument_Serif } from "next/font/google"`). Check whether the options include `style: ["normal", "italic"]`.

- [ ] **Step 2: Add italic style if missing**

If the `style` option is missing or only `["normal"]`:

```tsx
const instrumentSerif = Instrument_Serif({
  subsets: ["latin"],
  weight: "400",
  style: ["normal", "italic"],   // <-- add
  variable: "--font-heading",
  display: "swap",
});
```

- [ ] **Step 3: Visual verification**

Restart dev server. Open year-wheel page, inspect the "Hele året i ett blikk" h2. It should render as a true italic (smooth strokes, alt glyphs), not synthetic oblique (simple slant).

- [ ] **Step 4: Commit (only if changed)**

```bash
git add apps/web/src/app/layout.tsx
git commit -m "fix(fonts): load Instrument Serif italic face for year-wheel heading"
```

### Task 6.3: Keyboard create path (Alt+N)

**Files:**
- Modify: `apps/web/src/app/dashboard/year-wheel/year-wheel-page-client.tsx`

- [ ] **Step 1: Add keyboard handler**

Inside `YearWheelPageClient`, add:

```tsx
useEffect(() => {
  const onKey = (e: KeyboardEvent) => {
    if (e.altKey && e.key.toLowerCase() === "n" && !quickCreate) {
      e.preventDefault();
      const today = new Date();
      const plus7 = new Date(today.getTime() + 7 * 86400000);
      const fmt = (d: Date) =>
        `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
      setQuickCreate({ start: fmt(today), end: fmt(plus7) });
    }
  };
  window.addEventListener("keydown", onKey);
  return () => window.removeEventListener("keydown", onKey);
}, [quickCreate]);
```

- [ ] **Step 2: Smoke — Alt+N opens the sheet**

In the browser on the year-wheel page, press Alt+N. The quick-create sheet should open with start=today, end=today+7, focus on name field.

- [ ] **Step 3: Commit**

```bash
git commit -am "feat(year-wheel): Alt+N keyboard shortcut opens quick-create sheet"
```

### Task 6.4: Cascade-task href migration

**Files:**
- Create: `supabase/migrations/20260420120000_cascade_task_hrefs_season_route.sql`

- [ ] **Step 1: Read the existing migration for reference**

Open `supabase/migrations/20260503100000_update_cascade_task_hrefs_year_wheel.sql`. Lines 344, 353, 364, 375 hardcode `'/dashboard/year-wheel'`. Identify the four gap-types that need tab-specific paths.

- [ ] **Step 2: Write the new migration**

```sql
-- apps/web/supabase/migrations/20260420120000_cascade_task_hrefs_season_route.sql
-- Redirect cascade-task hrefs from /dashboard/year-wheel to /dashboard/season/<active-season>?tab=<key>
-- per 2026-04-20 year-wheel redesign spec (§11 step 6.5).
-- Fallback: if no active season in workspace, keep the old year-wheel href.

BEGIN;

-- Replace href for budget-gap tasks → season budget tab
UPDATE cascade_task
SET href = CASE
  WHEN EXISTS (SELECT 1 FROM season WHERE season.workspace_id = cascade_task.workspace_id AND season.status = 'active')
  THEN '/dashboard/season/' || (SELECT season_id FROM season WHERE season.workspace_id = cascade_task.workspace_id AND season.status = 'active' LIMIT 1)::text || '?tab=budget'
  ELSE '/dashboard/year-wheel'
END
WHERE gap_type = 'budget'
  AND href = '/dashboard/year-wheel';

-- day_factor → tab=day
UPDATE cascade_task
SET href = CASE
  WHEN EXISTS (SELECT 1 FROM season WHERE season.workspace_id = cascade_task.workspace_id AND season.status = 'active')
  THEN '/dashboard/season/' || (SELECT season_id FROM season WHERE season.workspace_id = cascade_task.workspace_id AND season.status = 'active' LIMIT 1)::text || '?tab=day'
  ELSE '/dashboard/year-wheel'
END
WHERE gap_type = 'day_factor'
  AND href = '/dashboard/year-wheel';

-- hour_factor → tab=hour
UPDATE cascade_task
SET href = CASE
  WHEN EXISTS (SELECT 1 FROM season WHERE season.workspace_id = cascade_task.workspace_id AND season.status = 'active')
  THEN '/dashboard/season/' || (SELECT season_id FROM season WHERE season.workspace_id = cascade_task.workspace_id AND season.status = 'active' LIMIT 1)::text || '?tab=hour'
  ELSE '/dashboard/year-wheel'
END
WHERE gap_type = 'hour_factor'
  AND href = '/dashboard/year-wheel';

-- season_hours → tab=hours
UPDATE cascade_task
SET href = CASE
  WHEN EXISTS (SELECT 1 FROM season WHERE season.workspace_id = cascade_task.workspace_id AND season.status = 'active')
  THEN '/dashboard/season/' || (SELECT season_id FROM season WHERE season.workspace_id = cascade_task.workspace_id AND season.status = 'active' LIMIT 1)::text || '?tab=hours'
  ELSE '/dashboard/year-wheel'
END
WHERE gap_type = 'season_hours'
  AND href = '/dashboard/year-wheel';

COMMIT;
```

(Verify the exact `gap_type` values and `cascade_task` column names by reading the existing migration. Adjust this SQL if the columns differ.)

- [ ] **Step 3: Apply locally**

```bash
npx supabase migration up --local
```

Expected: migration applies without error.

- [ ] **Step 4: Regenerate types**

```bash
pnpm turbo types:generate --filter=@smartout/supabase
```

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/20260420120000_cascade_task_hrefs_season_route.sql packages/supabase/src/database.types.ts
git commit -m "feat(migrations): update cascade-task hrefs to /dashboard/season/[id] route"
```

---

## Phase 7 — Cleanup

### Task 7.1: Tighten `CreateSeasonInput` (step 0c)

**Files:**
- Modify: `packages/year-wheel/src/hooks/use-seasons.ts`

- [ ] **Step 1: Decide the tightening**

After the quick-create sheet is live (Phase 4) and the old `SeasonCreateSheet` is gone (Task 7.2 below), we can make `startDate` + `endDate` required. But `duplicateYear` still calls the hook — verify its callsite passes both.

```bash
grep -n "createSeason\|CreateSeasonInput" packages/year-wheel/src/hooks/use-seasons.ts
```

Look at the `duplicateYear` mutation (around lines 260-383 per earlier council trace). If it uses `createSeason.mutateAsync(...)` with both dates, the tighten is safe. If it doesn't, keep them optional.

- [ ] **Step 2: Apply tighten if safe**

If `duplicateYear` passes both dates:

```ts
export type CreateSeasonInput = {
  name: string;
  startDate: string;        // was optional
  endDate: string;          // was optional
  color?: string | null;
  planningCycleId?: string | null;
};
```

If not safe, leave as optional and note in a comment: `// Optional at type level because duplicateYear doesn't always have dates.`

- [ ] **Step 3: Typecheck + test + commit**

```bash
pnpm turbo typecheck --filter=@smartout/year-wheel --filter=@smartout/web
pnpm -F @smartout/year-wheel test use-seasons
```

Commit either way:

```bash
git add packages/year-wheel/src/hooks/use-seasons.ts
git commit -m "chore(year-wheel): step 0c — tighten CreateSeasonInput (or document why not)"
```

### Task 7.2: Delete retired files + move deferred tabs

**Files:**
- Delete: listed in "File Structure" → "Retired files"
- Move: `SeasonGoalsTab.tsx`, `SeasonProceduresTab.tsx` → `_deferred/`

- [ ] **Step 1: Verify no lingering imports**

```bash
grep -rn "YearWheelTimeline\|SeasonDrawer\|MachineRoomSheet\|SeasonCreateSheet\|YearNavigation" apps/web/src/ packages/
```

Expected: only matches inside the files being deleted. Any external matches → resolve before proceeding.

- [ ] **Step 2: Delete the retired files**

```bash
cd apps/web/src/app/dashboard/year-wheel/_components
rm YearWheelTimeline.tsx SeasonDrawer.tsx MachineRoomSheet.tsx SeasonCreateSheet.tsx YearNavigation.tsx TimelineBlock.tsx TimelinePin.tsx BudgetSetupTab.tsx DayFactorsTab.tsx HourFactorsTab.tsx SeasonHoursTab.tsx SeasonOverviewTab.tsx
cd -
```

- [ ] **Step 3: Move deferred tabs**

```bash
mkdir -p apps/web/src/app/dashboard/season/\[seasonId\]/_components/_deferred
git mv apps/web/src/app/dashboard/year-wheel/_components/SeasonGoalsTab.tsx apps/web/src/app/dashboard/season/\[seasonId\]/_components/_deferred/
git mv apps/web/src/app/dashboard/year-wheel/_components/SeasonProceduresTab.tsx apps/web/src/app/dashboard/season/\[seasonId\]/_components/_deferred/
```

- [ ] **Step 4: Typecheck**

Run: `pnpm turbo typecheck --filter=@smartout/web`
Expected: PASS. If any import errors surface → fix them (likely in the moved deferred tabs that still import from `../_hooks`).

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "$(cat <<'EOF'
chore(year-wheel): retire drawer + machine room + create sheet + old timeline

Removes 12 files now superseded by the new shell + season route. Moves
Goals and Procedures tabs to _deferred/ pending P2 (activation-engine
wiring + regulatory_framework binding).

Ref: docs/superpowers/specs/2026-04-20-year-wheel-redesign-design.md §11 step 7

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

### Task 7.3: Update E2E tests

**Files:**
- Modify: `apps/e2e/tests/season-planning.spec.ts:39-60`

- [ ] **Step 1: Read the current test**

Read `apps/e2e/tests/season-planning.spec.ts` lines 39-60+. Identify which scenarios reference Goals / Procedures tabs.

- [ ] **Step 2: Update selectors or skip**

Two options per spec §14 acceptance:

- **Option A** — update selectors to point at the new route: `/dashboard/season/[id]?tab=budget` and follow the submenu tabs that remain (Budsjett, Dag, Time, Åpningstider, Oversikt).
- **Option B** — mark Goals/Procedures scenarios with `test.skip(true, "P2 deferred per 2026-04-20 council")` and add a comment linking to the redesign spec.

Pick option B for speed unless the scenarios are small enough to rewrite quickly (under an hour).

- [ ] **Step 3: Run E2E**

```bash
pnpm -F @smartout/e2e test --grep "season-planning"
```

Expected: PASS (either the rewritten tests or the skipped ones).

- [ ] **Step 4: Commit**

```bash
git add apps/e2e/tests/season-planning.spec.ts
git commit -m "test(e2e): update season-planning selectors for new route; skip Goals/Procedures (P2)"
```

### Task 7.4: Update `ROUTES.md` + final smoke

**Files:**
- Modify: `docs/reference/ROUTES.md`

- [ ] **Step 1: Add the season route to the docs**

Find the year-wheel entry in `docs/reference/ROUTES.md`. Add below it:

```markdown
| `/dashboard/season/[seasonId]?tab=<key>` | Dashboard / Planlegging | Detailed season editing. Primary submenu: Budsjett / Dag / Time / Åpningstider / Oversikt. `?tab=budget` is the default. Goals + Procedures deferred to P2 per 2026-04-20 spec. |
```

- [ ] **Step 2: Final typecheck on the whole monorepo**

```bash
pnpm turbo typecheck
```

Expected: PASS everywhere.

- [ ] **Step 3: Manual smoke — full acceptance walk per spec §14**

In the browser:

1. Navigate to `/dashboard/year-wheel` — 3-column shell renders.
2. Drag on the canvas — phantom appears with live dates.
3. Release — quick-create sheet opens with start/end pre-filled.
4. Submit — season created, redirects to `/dashboard/season/<id>?tab=budget`.
5. Click submenu tabs — URL updates, content swaps.
6. Press browser Back — returns to previous tab (not year-wheel — that's `router.push` behavior).
7. Click a season block on the canvas — routes to season page.
8. Toggle light ↔ dark — watermark visible in both; hour-factor bars readable in both.
9. Press Alt+N — quick-create sheet opens with today+7 defaults.
10. Resize to 1280px — rail hides; sidebar stays.
11. Resize to 1023px — sidebar narrows to 220px.
12. Open PostHog / logger — all six new events fire with correct shapes.

- [ ] **Step 4: Final commit**

```bash
git add docs/reference/ROUTES.md
git commit -m "$(cat <<'EOF'
docs(year-wheel): register /dashboard/season/[seasonId] route

Closes year-wheel redesign migration. Spec
docs/superpowers/specs/2026-04-20-year-wheel-redesign-design.md
fully implemented across 7 phases / ~20 commits on feat/year-wheel.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Acceptance (from spec §14 — verify before merge to `development`)

- [ ] `/dashboard/year-wheel` renders the new 3-column shell.
- [ ] `/dashboard/season/[seasonId]?tab=budget` renders the submenu with Budsjett landing by default.
- [ ] Dragging on the canvas creates a phantom and, on release, opens the quick-create sheet pre-filled.
- [ ] Submitting the sheet creates the season and redirects to `/dashboard/season/[newId]?tab=budget`.
- [ ] Clicking an existing season block on the canvas routes to the season page.
- [ ] Tab navigation within the season page uses `router.push` (Back returns to the previous tab).
- [ ] `pnpm turbo typecheck` passes after every migration step.
- [ ] Sidebar, rail, topbar, canvas, legend, AI-suggestion card all render and respond at 1440px and 1280px viewports.
- [ ] All 12 retired files are deleted.
- [ ] `apps/e2e/tests/season-planning.spec.ts` passes.
- [ ] All six new telemetry events emit with typed `emit()` and land in PostHog + logger. `"season created"` continues to land in `activity_trail`.
- [ ] `AiSuggestionCard` renders as empty-state; no buttons, no emit.
- [ ] Hour-factor editor uses Popover + Input, not `prompt()`.
- [ ] New migration `20260420120000_cascade_task_hrefs_season_route.sql` applies and updates hrefs.
- [ ] Instrument Serif italic renders correctly (no synthetic oblique).

---

## Out of scope (confirmed deferred per spec §11.5)

- Activation gate card + "hva mangler" checklist
- Activate / Archive / Duplicate buttons
- Seeded-from-Riksavtalen provenance chip
- `SeasonGoalsTab` and `SeasonProceduresTab` (moved to `_deferred/`)
- Activation-engine wiring completeness (trigger works; downstream session lifecycle is separate concern)
- Real AI suggestion engine
- Revenue-actual plumbing for "Aktiv nå" rail
- Mobile year-wheel (read-only per ADR-0133)

Each of the above is tracked as a future follow-up spec / ADR per the scope-reset note in spec §11.5.
