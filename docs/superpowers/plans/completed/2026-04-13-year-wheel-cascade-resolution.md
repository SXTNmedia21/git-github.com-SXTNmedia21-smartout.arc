# Year Wheel Cascade Resolution Gap — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close the P0 cascade resolution gap: wire season activation to `department_operating_hours` so seasons affect actual scheduling. Fix the Calendar Guardian season selection bug. Add season-specific operating hours configuration in the SeasonDrawer.

**Architecture:** The cascade consumer (`resolveEffectiveHours()` in `apps/web/src/lib/cascade/resolve-hours.ts`) already correctly resolves season-specific hours when passed a `seasonId`. The gap is the producer side: no code creates `department_operating_hours` rows with a season's `season_id`, and no UI lets managers configure season-specific hours. This plan adds: (1) a new "Hours" tab in SeasonDrawer for per-department season hours, (2) a warning on season activation when no season-specific hours exist, (3) a Calendar Guardian fix to scope season lookup by session context. No schema changes needed — `department_operating_hours` already has a `season_id` column.

**Tech Stack:** Next.js App Router, React 19, TanStack Query v5, Supabase (PostgreSQL + RLS), `@smartout/telemetry`, `@smartout/design-tokens`

**Branch:** `feat/year-wheel-cascade-resolution`

**Parallel with:** `fix/year-wheel-design-debt` (zero file overlap — this plan touches `lib/cascade/`, `stage-engine/`, and adds a new hook/tab. That plan touches existing `_components/` CSS.)

---

## Context: The Gap

When a user activates a season in the Year Wheel:

1. `activateSeason` in `use-seasons.ts` validates budget + factors exist
2. Archives the previously active season
3. Sets `season.status = 'active'`

**Missing:** No `department_operating_hours` rows are created with `season_id = <activated_season_id>`. The cascade resolution function `resolveEffectiveHours()` (resolve-hours.ts:29-117) accepts an optional `seasonId` and correctly prioritizes season-specific hours over defaults. But nobody calls it with a season because no season-specific data exists.

**Result:** Activating a season changes D4 (budgets, factors) but has zero effect on D1 (operating hours). Shifts are scheduled against default hours regardless of active season.

**The fix has three parts:**
1. **Configuration surface** — Let managers set per-department hours for a season (new "Hours" tab in SeasonDrawer)
2. **Activation warning** — When activating a season with zero season-specific hours, warn the user (but don't block — D4-only seasons are valid)
3. **Calendar Guardian fix** — Stop the guardian from selecting the wrong season

---

## Task 1: Create `useSeasonOperatingHours` hook

**Files:**
- Create: `apps/web/src/app/dashboard/year-wheel/_hooks/use-season-operating-hours.ts`
- Modify: `apps/web/src/app/dashboard/year-wheel/_hooks/index.ts`

- [ ] **Step 1: Write the hook**

```typescript
/**
 * use-season-operating-hours.ts
 * Manages department_operating_hours rows scoped to a specific season.
 * These rows override default (season_id=NULL) hours when a season is active.
 * Connected to: resolve-hours.ts (cascade consumer), SeasonHoursTab.tsx (UI)
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSupabase } from "@/lib/supabase/client";
import { useWorkspace } from "@/hooks/use-workspace";
import { emit } from "@smartout/telemetry";

import type { Database } from "@smartout/supabase";

type DepartmentOperatingHoursRow =
  Database["public"]["Tables"]["department_operating_hours"]["Row"];
type DepartmentOperatingHoursInsert =
  Database["public"]["Tables"]["department_operating_hours"]["Insert"];

const DAYS_OF_WEEK = [0, 1, 2, 3, 4, 5, 6] as const;

/**
 * Fetches and manages department_operating_hours rows for a specific season.
 * Returns the season-scoped hours grouped by department, and mutations
 * to copy default hours as a starting point and save edits.
 */
export function useSeasonOperatingHours(seasonId: string | null) {
  const supabase = useSupabase();
  const { workspace } = useWorkspace();
  const queryClient = useQueryClient();
  const workspaceId = workspace?.workspace_id;

  const queryKey = ["season-operating-hours", workspaceId, seasonId] as const;

  const query = useQuery({
    queryKey,
    queryFn: async () => {
      if (!workspaceId || !seasonId) return [];

      const { data, error } = await supabase
        .from("department_operating_hours")
        .select("*")
        .eq("workspace_id", workspaceId)
        .eq("season_id", seasonId)
        .order("department_id")
        .order("day_of_week");

      if (error) throw error;
      return data as DepartmentOperatingHoursRow[];
    },
    enabled: !!workspaceId && !!seasonId,
    staleTime: 5 * 60 * 1000,
  });

  /**
   * Copies the default operating hours (season_id=NULL) for all departments
   * as the starting point for season-specific hours. This lets managers
   * start from "what we have now" and adjust, rather than building from scratch.
   */
  const copyDefaultHours = useMutation({
    mutationFn: async () => {
      if (!workspaceId || !seasonId) throw new Error("Missing context");

      const { data: existing } = await supabase
        .from("department_operating_hours")
        .select("id")
        .eq("workspace_id", workspaceId)
        .eq("season_id", seasonId)
        .limit(1);

      if (existing && existing.length > 0) {
        throw new Error("Season already has operating hours configured");
      }

      const { data: defaults, error: fetchError } = await supabase
        .from("department_operating_hours")
        .select("*")
        .eq("workspace_id", workspaceId)
        .is("season_id", null)
        .order("department_id")
        .order("day_of_week");

      if (fetchError) throw fetchError;
      if (!defaults || defaults.length === 0) {
        throw new Error("No default operating hours to copy");
      }

      const seasonRows: DepartmentOperatingHoursInsert[] = defaults.map(
        (row) => ({
          workspace_id: workspaceId,
          department_id: row.department_id,
          location_id: row.location_id,
          season_id: seasonId,
          day_of_week: row.day_of_week,
          open_time: row.open_time,
          close_time: row.close_time,
          open_offset_minutes: row.open_offset_minutes,
          close_offset_minutes: row.close_offset_minutes,
          is_closed: row.is_closed,
          is_derived: true,
          provenance: { source: "copy_from_default", copied_at: new Date().toISOString() },
        }),
      );

      const { error: insertError } = await supabase
        .from("department_operating_hours")
        .insert(seasonRows);

      if (insertError) throw insertError;
      return seasonRows.length;
    },
    onSuccess: (count) => {
      queryClient.invalidateQueries({ queryKey });
      emit("season operating_hours_copied", {
        entity_type: "season",
        entity_id: seasonId!,
        metadata: { rows_copied: count },
      });
    },
  });

  /**
   * Updates a single operating hours row. Used by the per-day time pickers
   * in the SeasonHoursTab.
   */
  const updateHours = useMutation({
    mutationFn: async (update: {
      id: string;
      open_time?: string | null;
      close_time?: string | null;
      is_closed?: boolean;
    }) => {
      const { error } = await supabase
        .from("department_operating_hours")
        .update({
          open_time: update.open_time,
          close_time: update.close_time,
          is_closed: update.is_closed,
          is_derived: false,
          provenance: { source: "manual_edit", edited_at: new Date().toISOString() },
          updated_at: new Date().toISOString(),
        })
        .eq("id", update.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
      emit("season operating_hours_updated", {
        entity_type: "season",
        entity_id: seasonId!,
      });
    },
  });

  /**
   * Deletes all season-specific hours (reverts to default hours).
   */
  const removeSeasonHours = useMutation({
    mutationFn: async () => {
      if (!workspaceId || !seasonId) throw new Error("Missing context");

      const { error } = await supabase
        .from("department_operating_hours")
        .delete()
        .eq("workspace_id", workspaceId)
        .eq("season_id", seasonId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
      emit("season operating_hours_removed", {
        entity_type: "season",
        entity_id: seasonId!,
      });
    },
  });

  const hasSeasonHours = (query.data?.length ?? 0) > 0;

  return {
    hours: query.data ?? [],
    isLoading: query.isLoading,
    hasSeasonHours,
    copyDefaultHours,
    updateHours,
    removeSeasonHours,
  };
}
```

- [ ] **Step 2: Export from hooks index**

Add to `apps/web/src/app/dashboard/year-wheel/_hooks/index.ts`:

```typescript
export { useSeasonOperatingHours } from "./use-season-operating-hours";
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/app/dashboard/year-wheel/_hooks/use-season-operating-hours.ts \
       apps/web/src/app/dashboard/year-wheel/_hooks/index.ts
git commit -m "feat(year-wheel): add useSeasonOperatingHours hook for D1 wiring"
```

---

## Task 2: Register telemetry events

**Files:**
- Modify: `packages/telemetry/src/registry.ts`

- [ ] **Step 1: Add season operating hours events to the registry**

Find the season events section and add:

```typescript
"season operating_hours_copied": {
  entity: "season",
  verb: "operating_hours_copied",
  destinations: ["posthog", "logger", "activity_trail"],
},
"season operating_hours_updated": {
  entity: "season",
  verb: "operating_hours_updated",
  destinations: ["posthog", "logger", "activity_trail"],
},
"season operating_hours_removed": {
  entity: "season",
  verb: "operating_hours_removed",
  destinations: ["posthog", "logger", "activity_trail"],
},
```

- [ ] **Step 2: Commit**

```bash
git add packages/telemetry/src/registry.ts
git commit -m "feat(telemetry): register season operating hours events"
```

---

## Task 3: Create SeasonHoursTab component

**Files:**
- Create: `apps/web/src/app/dashboard/year-wheel/_components/SeasonHoursTab.tsx`

- [ ] **Step 1: Write the component**

```typescript
/**
 * SeasonHoursTab.tsx
 * Per-department operating hours configuration for a season.
 * Lets managers copy default hours as a starting point, then adjust
 * open/close times per day-of-week per department for the season.
 *
 * Connected to: useSeasonOperatingHours (data), SeasonDrawer (parent),
 * resolveEffectiveHours (cascade consumer that reads these rows)
 */

"use client";

import { useState } from "react";
import { Clock, Copy, Trash2, ChevronDown, ChevronRight } from "lucide-react";
import { useTranslation } from "@smartout/i18n";
import { toast } from "sonner";

import { Button } from "@smartout/ui/button";
import { useSeasonOperatingHours } from "../_hooks";

import type { Database } from "@smartout/supabase";

type DepartmentOperatingHoursRow =
  Database["public"]["Tables"]["department_operating_hours"]["Row"];

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;

type SeasonHoursTabProps = {
  seasonId: string;
};

/**
 * Displays season-specific operating hours grouped by department.
 * If no season hours exist, shows a CTA to copy from default hours.
 * Each department section is collapsible and shows 7 day rows with
 * open/close time inputs.
 */
export function SeasonHoursTab({ seasonId }: SeasonHoursTabProps) {
  const { t } = useTranslation("dashboard");
  const {
    hours,
    isLoading,
    hasSeasonHours,
    copyDefaultHours,
    updateHours,
    removeSeasonHours,
  } = useSeasonOperatingHours(seasonId);

  const [expandedDepts, setExpandedDepts] = useState<Set<string>>(new Set());

  const handleCopyDefaults = () => {
    copyDefaultHours.mutate(undefined, {
      onSuccess: (count) => {
        toast.success(t("yearWheel.hours_copied", { count }));
      },
      onError: (err) => {
        toast.error(err.message);
      },
    });
  };

  const handleRemoveAll = () => {
    if (!window.confirm(t("yearWheel.confirm_remove_hours"))) return;
    removeSeasonHours.mutate(undefined, {
      onSuccess: () => toast.success(t("yearWheel.hours_removed")),
      onError: (err) => toast.error(err.message),
    });
  };

  const toggleDept = (deptId: string) => {
    setExpandedDepts((prev) => {
      const next = new Set(prev);
      if (next.has(deptId)) next.delete(deptId);
      else next.add(deptId);
      return next;
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12 text-muted-foreground">
        <Clock className="mr-2 h-4 w-4 animate-spin" />
        {t("common.loading")}
      </div>
    );
  }

  if (!hasSeasonHours) {
    return (
      <div className="flex flex-col items-center gap-4 py-12 text-center">
        <Clock className="h-8 w-8 text-muted-foreground" />
        <div>
          <p className="text-sm font-medium text-foreground">
            {t("yearWheel.no_season_hours")}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {t("yearWheel.no_season_hours_description")}
          </p>
        </div>
        <Button
          onClick={handleCopyDefaults}
          disabled={copyDefaultHours.isPending}
          className="gap-2"
        >
          <Copy className="h-4 w-4" />
          {copyDefaultHours.isPending
            ? t("common.loading")
            : t("yearWheel.copy_default_hours")}
        </Button>
      </div>
    );
  }

  const byDepartment = groupByDepartment(hours);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">
          {t("yearWheel.season_hours_description")}
        </p>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleRemoveAll}
          disabled={removeSeasonHours.isPending}
          className="gap-1 text-destructive hover:text-destructive"
        >
          <Trash2 className="h-3 w-3" />
          {t("yearWheel.reset_to_defaults")}
        </Button>
      </div>

      {Object.entries(byDepartment).map(([deptId, rows]) => {
        const isExpanded = expandedDepts.has(deptId);
        const deptName = rows[0]?.department_id ?? deptId;

        return (
          <div key={deptId} className="rounded-lg border border-border bg-card">
            <button
              onClick={() => toggleDept(deptId)}
              className="flex w-full items-center gap-2 p-3 text-left hover:bg-accent"
            >
              {isExpanded ? (
                <ChevronDown className="h-4 w-4 text-muted-foreground" />
              ) : (
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              )}
              <span className="text-sm font-medium text-card-foreground">
                {deptName}
              </span>
              <span className="ml-auto text-xs text-muted-foreground">
                {rows.filter((r) => !r.is_closed).length}/7{" "}
                {t("yearWheel.days_open")}
              </span>
            </button>

            {isExpanded && (
              <div className="border-t border-border px-3 pb-3">
                {WEEKDAYS.map((dayLabel, dayIndex) => {
                  const row = rows.find((r) => r.day_of_week === dayIndex);
                  if (!row) return null;

                  return (
                    <DayRow
                      key={row.id}
                      dayLabel={dayLabel}
                      row={row}
                      onUpdate={(update) =>
                        updateHours.mutate({ id: row.id, ...update })
                      }
                    />
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

type DayRowProps = {
  dayLabel: string;
  row: DepartmentOperatingHoursRow;
  onUpdate: (update: {
    open_time?: string | null;
    close_time?: string | null;
    is_closed?: boolean;
  }) => void;
};

function DayRow({ dayLabel, row, onUpdate }: DayRowProps) {
  return (
    <div className="flex items-center gap-3 border-b border-border/50 py-2 last:border-0">
      <span className="w-10 text-xs font-medium text-muted-foreground">
        {dayLabel}
      </span>

      {row.is_closed ? (
        <button
          onClick={() => onUpdate({ is_closed: false, open_time: "10:00", close_time: "22:00" })}
          className="text-xs text-destructive hover:underline"
        >
          Closed — click to open
        </button>
      ) : (
        <>
          <input
            type="time"
            value={row.open_time ?? ""}
            onChange={(e) => onUpdate({ open_time: e.target.value })}
            className="h-8 rounded border border-input bg-background px-2 text-xs text-foreground"
          />
          <span className="text-xs text-muted-foreground">—</span>
          <input
            type="time"
            value={row.close_time ?? ""}
            onChange={(e) => onUpdate({ close_time: e.target.value })}
            className="h-8 rounded border border-input bg-background px-2 text-xs text-foreground"
          />
          <button
            onClick={() => onUpdate({ is_closed: true })}
            className="ml-auto text-xs text-muted-foreground hover:text-destructive"
          >
            ✕
          </button>
        </>
      )}
    </div>
  );
}

function groupByDepartment(
  rows: DepartmentOperatingHoursRow[],
): Record<string, DepartmentOperatingHoursRow[]> {
  const grouped: Record<string, DepartmentOperatingHoursRow[]> = {};
  for (const row of rows) {
    const key = row.department_id;
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(row);
  }
  return grouped;
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/app/dashboard/year-wheel/_components/SeasonHoursTab.tsx
git commit -m "feat(year-wheel): add SeasonHoursTab for per-department season hours"
```

---

## Task 4: Add Hours tab to SeasonDrawer

**Files:**
- Modify: `apps/web/src/app/dashboard/year-wheel/_components/SeasonDrawer.tsx`

- [ ] **Step 1: Import SeasonHoursTab and add to tab list**

Add `"hours"` to the `DrawerTab` type. Add a Clock icon tab after Overview:

```typescript
import { SeasonHoursTab } from "./SeasonHoursTab";

type DrawerTab = "overview" | "hours" | "goals" | "procedures";

// In the tabs array:
const tabs = [
  { key: "overview", label: t("yearWheel.tab_overview"), icon: LayoutDashboard },
  { key: "hours", label: t("yearWheel.tab_hours"), icon: Clock },
  { key: "goals", label: t("yearWheel.tab_goals"), icon: Target },
  { key: "procedures", label: t("yearWheel.tab_procedures"), icon: ShieldCheck },
] as const;
```

- [ ] **Step 2: Render the tab content**

In the tab content switch:

```typescript
{activeTab === "hours" && (
  <SeasonHoursTab seasonId={season.season_id} />
)}
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/app/dashboard/year-wheel/_components/SeasonDrawer.tsx
git commit -m "feat(year-wheel): add Hours tab to SeasonDrawer"
```

---

## Task 5: Add activation warning for missing season hours

**Files:**
- Modify: `apps/web/src/app/dashboard/year-wheel/_hooks/use-seasons.ts`

- [ ] **Step 1: Add season hours check to activateSeason**

After the existing budget/factor validation (before the archive step), add a check for season-specific operating hours. This is a WARNING, not a blocker — D4-only seasons are valid:

```typescript
// After hour_factor count check, before archiving:

// Check for season-specific operating hours (warning, not blocker)
const { count: hoursCount } = await supabase
  .from("department_operating_hours")
  .select("*", { count: "exact", head: true })
  .eq("workspace_id", workspaceId)
  .eq("season_id", seasonId);

if (!hoursCount || hoursCount === 0) {
  const proceed = window.confirm(
    "This season has no custom operating hours. " +
    "Default hours will be used for scheduling. " +
    "Continue activation?"
  );
  if (!proceed) return null;
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/app/dashboard/year-wheel/_hooks/use-seasons.ts
git commit -m "feat(year-wheel): add activation warning for missing season hours"
```

---

## Task 6: Fix Calendar Guardian season selection

**Files:**
- Modify: `services/stage-engine/src/core/calendar-guardian.ts`

- [ ] **Step 1: Fix the season query to respect active status**

The current query at lines 91-98 picks the newest season by `created_at`, including drafts. Fix it to prefer the active season:

```typescript
// Before (lines 91-98):
const { data: season } = await supabaseAdmin
  .from("season")
  .select("start_date, end_date")
  .eq("workspace_id", session.workspace_id)
  .in("status", ["draft", "active"])
  .order("created_at", { ascending: false })
  .limit(1)
  .single();

// After:
// Prefer the active season (max 1 per workspace per ADR-0085).
// Fall back to newest draft only if no active season exists.
const { data: activeSeason } = await supabaseAdmin
  .from("season")
  .select("start_date, end_date")
  .eq("workspace_id", session.workspace_id)
  .eq("status", "active")
  .limit(1)
  .maybeSingle();

const season = activeSeason
  ? activeSeason
  : (
      await supabaseAdmin
        .from("season")
        .select("start_date, end_date")
        .eq("workspace_id", session.workspace_id)
        .eq("status", "draft")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle()
    ).data;
```

- [ ] **Step 2: Add a log when falling back to draft**

```typescript
if (!activeSeason && season) {
  console.warn(
    `[CalendarGuardian] No active season for workspace ${session.workspace_id}. ` +
    `Falling back to newest draft season.`
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add services/stage-engine/src/core/calendar-guardian.ts
git commit -m "fix(stage-engine): fix Calendar Guardian to prefer active season over newest draft"
```

---

## Task 7: Add i18n keys for season hours

**Files:**
- Modify: `packages/i18n/src/locales/nb/dashboard.json`
- Modify: `packages/i18n/src/locales/en/dashboard.json`

- [ ] **Step 1: Add Norwegian keys**

Add under the `yearWheel` namespace:

```json
{
  "yearWheel": {
    "tab_hours": "Åpningstider",
    "no_season_hours": "Ingen sesong-åpningstider konfigurert",
    "no_season_hours_description": "Denne sesongen bruker standard åpningstider. Kopier standardtidene som utgangspunkt for å tilpasse.",
    "copy_default_hours": "Kopier standardtider",
    "hours_copied": "{{count}} åpningstider kopiert",
    "hours_removed": "Sesong-åpningstider fjernet",
    "confirm_remove_hours": "Fjerne alle sesong-åpningstider? Sesongen vil bruke standardtidene.",
    "season_hours_description": "Åpningstider spesifikke for denne sesongen. Endringer påvirker kun denne sesongen.",
    "reset_to_defaults": "Tilbakestill til standard",
    "days_open": "dager åpne"
  }
}
```

- [ ] **Step 2: Add English keys**

```json
{
  "yearWheel": {
    "tab_hours": "Operating Hours",
    "no_season_hours": "No season operating hours configured",
    "no_season_hours_description": "This season uses default operating hours. Copy defaults as a starting point to customize.",
    "copy_default_hours": "Copy default hours",
    "hours_copied": "{{count}} operating hours copied",
    "hours_removed": "Season operating hours removed",
    "confirm_remove_hours": "Remove all season operating hours? The season will use default hours.",
    "season_hours_description": "Operating hours specific to this season. Changes only affect this season.",
    "reset_to_defaults": "Reset to defaults",
    "days_open": "days open"
  }
}
```

- [ ] **Step 3: Commit**

```bash
git add packages/i18n/
git commit -m "feat(i18n): add season operating hours translation keys"
```

---

## Task 8: Verify cascade resolution works end-to-end

- [ ] **Step 1: Start Supabase local**

```bash
npx supabase start
```

- [ ] **Step 2: Run the app**

```bash
pnpm --filter web dev
```

- [ ] **Step 3: Manual verification flow**

1. Open Year Wheel → create a season (draft)
2. Open SeasonDrawer → go to "Hours" tab
3. Click "Copy default hours" → verify rows appear grouped by department
4. Edit one department's Monday hours (e.g., change open from 10:00 to 09:00)
5. Go to "Overview" tab → set up budget + day factors + hour factors
6. Activate the season → verify the warning appears about operating hours (should NOT appear since we configured hours)
7. Check `department_operating_hours` table in Supabase Studio → verify rows exist with the season_id

- [ ] **Step 4: Verify with no season hours**

1. Create a second season (draft)
2. Set budget + factors but do NOT configure hours
3. Activate → verify the warning dialog appears ("no custom operating hours")
4. Confirm → verify season activates anyway (D4-only is valid)

- [ ] **Step 5: Run typecheck**

```bash
pnpm --filter web typecheck
```

- [ ] **Step 6: Commit any fixes and push**

```bash
git push -u origin feat/year-wheel-cascade-resolution
```

---

## Task 9: Write ADR-0086 — Year Wheel Implementation Sequencing

**Files:**
- Create: `docs/decisions/0086-year-wheel-implementation-sequencing.md`
- Modify: `docs/decisions/0000-decision-log.md`

- [ ] **Step 1: Write the ADR**

```markdown
---
id: "0086"
title: "Year Wheel Implementation Sequencing"
status: accepted
date: 2026-04-13
module: year-wheel
tags: [cascade, design-system, agent, sequencing]
---

# ADR-0086: Year Wheel Implementation Sequencing

## Context

The Year Wheel PRD v2.0.0 consolidation (council reviewed 2026-04-12,
re-reviewed 2026-04-13) identified four implementation priorities:
A (Phase 1 features), B (design debt), C (cascade resolution gap),
D (stale plan cleanup). Council review revealed dependencies.

## Decision

### Sequencing

1. **D** (immediate): Mark stale gap-closure plan as superseded.
2. **B + C** (parallel): Design debt cleanup and cascade resolution
   gap can execute simultaneously — zero file overlap.
3. **A** (after B merges): Phase 1 features (FR-NAV-11, FR-SEA-15,
   FR-SEA-16, FR-NAV-12) depend on CSS variable system from B.
   FR-SEA-15 (fractal noise overlay) cannot be implemented correctly
   with isDark prop drilling.
4. **Agent wiring** (after C merges): Season capability registration,
   intent classifier update, and Year Wheel page tools are gated on
   cascade data pipeline completeness.

### Agent Trust Gate

Season tools must NOT be registered in the capability system until
the cascade resolution gap is closed. Registering tools that create
seasons which have no scheduling effect is a trust-destroying
pattern for the AI agent.

### D4-Only Seasons Are Valid

Activating a season without custom operating hours is valid. The
cascade resolution correctly falls back to default hours. The
activation flow should WARN but not BLOCK.

## Consequences

- Feature branches: `fix/year-wheel-design-debt` (B) and
  `feat/year-wheel-cascade-resolution` (C) can run in parallel.
- Phase 1 features (A) wait for B to merge before branch creation.
- Agent capability registration waits for C to merge.
- Calendar Guardian bug (wrong season selection) is included in C scope.
```

- [ ] **Step 2: Add to decision log**

Add as the first entry in `docs/decisions/0000-decision-log.md`.

- [ ] **Step 3: Commit**

```bash
git add docs/decisions/0086-year-wheel-implementation-sequencing.md \
       docs/decisions/0000-decision-log.md
git commit -m "docs(decisions): add ADR-0086 year-wheel implementation sequencing"
```
