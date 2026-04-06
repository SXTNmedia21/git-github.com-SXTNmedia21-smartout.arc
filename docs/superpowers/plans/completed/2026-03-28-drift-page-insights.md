---
title: Drift Page Insights Implementation Plan
status: draft
updated: 2026-03-28
created: 2026-03-28
module: hms
tags: [drift, insights, operations, council-approved]
---

# Drift Page Insights Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an operational insights strip to the HMS Drift page so admins can see session completion, task progress, deviations, and overdue tasks at a glance.

**Architecture:** Compose existing hooks (`useDepartmentSessions`, `useDeviations`) with one new hook for overdue task count. Render a compact horizontal insight strip above the session table (admin) using CSS variable-based metric cells. No new tables, no charting libraries.

**Tech Stack:** React 19, TanStack Query, Supabase client, Tailwind v4 (CSS variables), `@smartout/i18n`

**Council verdict:** APPROVE WITH CHANGES (2026-03-28). All 4 agents reviewed. No new tables. No AI. Phase 0 fix operations tools first.

---

## File Structure

| Action | File                                                               | Responsibility                                                    |
| ------ | ------------------------------------------------------------------ | ----------------------------------------------------------------- |
| Fix    | `packages/ai/src/capabilities/operations/tools.ts`                 | Fix 7 wrong column references                                     |
| Create | `apps/web/src/app/dashboard/hms/_hooks/use-drift-insights.ts`      | Compose existing hooks + overdue count query into derived metrics |
| Create | `apps/web/src/app/dashboard/hms/_components/DriftInsightStrip.tsx` | Compact horizontal row of 4 metric cells (admin only)             |
| Modify | `apps/web/src/app/dashboard/hms/drift/page.tsx`                    | Import and render DriftInsightStrip above DriftSessionTable       |
| Modify | `packages/i18n/locales/nb/dashboard.json`                          | Add `hms.drift_insights.*` keys                                   |
| Modify | `packages/i18n/locales/en/dashboard.json`                          | Add `hms.drift_insights.*` keys                                   |

---

### Task 1: Fix Operations Tools Column Names (Phase 0)

**Files:**

- Fix: `packages/ai/src/capabilities/operations/tools.ts`

This is the critical prerequisite. Three tools reference columns that don't exist on the actual database tables.

**Correct column names (verified against `database.types.ts`):**

- `session_task` PK: `id` (correct as-is in some places)
- `session_task.assigned_to` (NOT `assigned_profile_id`)
- `department_session` PK: `department_session_id` (NOT `id`)
- `department_session.session_date` (NOT `date`)
- `deviation` PK: `deviation_id` (NOT `id`)

- [ ] **Step 1: Fix `getMyTasks` — wrong column name**

In `packages/ai/src/capabilities/operations/tools.ts` line 27, change:

```typescript
// BEFORE (broken):
.eq("assigned_profile_id", ctx.profileId)

// AFTER (correct):
.eq("assigned_to", ctx.profileId)
```

- [ ] **Step 2: Fix `getSessionInfo` — wrong select and filter columns**

In `packages/ai/src/capabilities/operations/tools.ts` line 65, change:

```typescript
// BEFORE (broken):
.select("id, status, date, opened_at, closed_at, department:department_id(name)")

// AFTER (correct):
.select("department_session_id, status, session_date, opened_at, closed_at, tasks_total, tasks_completed, department:department_id(name)")
```

In line 68, change:

```typescript
// BEFORE (broken):
.eq("date", today)

// AFTER (correct):
.eq("session_date", today)
```

- [ ] **Step 3: Fix `getDepartmentStatus` — wrong select, filter, and reference**

In `packages/ai/src/capabilities/operations/tools.ts` line 111, change:

```typescript
// BEFORE (broken):
.select("id")

// AFTER (correct):
.select("department_session_id")
```

In line 114, change:

```typescript
// BEFORE (broken):
.eq("date", today)

// AFTER (correct):
.eq("session_date", today)
```

In line 134, change:

```typescript
// BEFORE (broken):
if (session?.id) {

// AFTER (correct):
if (session?.department_session_id) {
```

In line 139, change the reference to match the corrected select:

```typescript
// BEFORE (broken):
.eq("department_session_id", session.id)

// AFTER (correct):
.eq("department_session_id", session.department_session_id)
```

- [ ] **Step 4: Fix `completeTask` — wrong column name**

In `packages/ai/src/capabilities/operations/tools.ts` line 223, change:

```typescript
// BEFORE (broken):
.eq("assigned_profile_id", ctx.profileId)

// AFTER (correct):
.eq("assigned_to", ctx.profileId)
```

- [ ] **Step 5: Fix `createDeviation` — wrong select column**

In `packages/ai/src/capabilities/operations/tools.ts` line 197, change:

```typescript
// BEFORE (broken):
.select("id, title, severity, status")

// AFTER (correct):
.select("deviation_id, title, severity, status")
```

- [ ] **Step 6: Verify all changes compile**

Run: `pnpm --filter ai typecheck 2>&1 | head -20`
Expected: No type errors in `tools.ts`

If the `ai` package doesn't have a typecheck script, run:

```bash
npx tsc --noEmit --project packages/ai/tsconfig.json 2>&1 | head -20
```

- [ ] **Step 7: Commit Phase 0 fix**

```bash
git add packages/ai/src/capabilities/operations/tools.ts
git commit -m "$(cat <<'EOF'
fix(ai): correct column names in operations capability tools

getMyTasks and completeTask used 'assigned_profile_id' instead of 'assigned_to'.
getSessionInfo and getDepartmentStatus used 'id'/'date' instead of
'department_session_id'/'session_date'. createDeviation used 'id' instead
of 'deviation_id'. All three tools were non-functional due to Supabase
returning empty results on non-existent columns.

Discovered during council review of Drift page insights feature.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: Add i18n Keys for Drift Insights

**Files:**

- Modify: `packages/i18n/locales/nb/dashboard.json`
- Modify: `packages/i18n/locales/en/dashboard.json`

- [ ] **Step 1: Add Norwegian keys**

Add the following nested object to `packages/i18n/locales/nb/dashboard.json` at the top level:

```json
"hms": {
  "drift_insights": {
    "sessions_label": "Økter i dag",
    "sessions_active": "{{count}} aktiv",
    "sessions_active_plural": "{{count}} aktive",
    "sessions_closed": "{{count}} lukket",
    "sessions_all_closed": "Alle lukket",
    "sessions_none": "Ingen økter",
    "tasks_label": "Oppgaver fullført",
    "tasks_sublabel": "{{completed}} av {{total}}",
    "deviations_label": "Åpne avvik",
    "deviations_none": "Ingen",
    "deviations_blocking": "{{count}} blokkerer",
    "overdue_label": "Forfalte oppgaver",
    "overdue_none": "Ingen",
    "no_data": "Ingen data for denne datoen"
  }
}
```

- [ ] **Step 2: Add English keys**

Add the following to `packages/i18n/locales/en/dashboard.json` at the top level:

```json
"hms": {
  "drift_insights": {
    "sessions_label": "Sessions today",
    "sessions_active": "{{count}} active",
    "sessions_active_plural": "{{count}} active",
    "sessions_closed": "{{count}} closed",
    "sessions_all_closed": "All closed",
    "sessions_none": "No sessions",
    "tasks_label": "Tasks completed",
    "tasks_sublabel": "{{completed}} of {{total}}",
    "deviations_label": "Open deviations",
    "deviations_none": "None",
    "deviations_blocking": "{{count}} blocking",
    "overdue_label": "Overdue tasks",
    "overdue_none": "None",
    "no_data": "No data for this date"
  }
}
```

- [ ] **Step 3: Commit i18n keys**

```bash
git add packages/i18n/locales/nb/dashboard.json packages/i18n/locales/en/dashboard.json
git commit -m "$(cat <<'EOF'
feat(i18n): add drift insights translation keys

Adds hms.drift_insights namespace with Norwegian and English keys
for session count, task completion, deviations, and overdue metrics.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 3: Create the Drift Insights Hook

**Files:**

- Create: `apps/web/src/app/dashboard/hms/_hooks/use-drift-insights.ts`

This hook composes existing hooks (`useDepartmentSessions`, `useDeviations`) and adds one direct query for overdue task count. It returns derived metrics.

- [ ] **Step 1: Create the hook file**

Create `apps/web/src/app/dashboard/hms/_hooks/use-drift-insights.ts`:

```typescript
"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useWorkspaceOptional } from "@/lib/workspace-context";
import { createClient } from "@smartout/supabase/client";
import { useDepartmentSessions, type DepartmentSessionRow } from "./use-department-sessions";
import { useDeviations } from "./use-deviations";

export type DriftInsights = {
  /** Total sessions for the selected date */
  totalSessions: number;
  /** Sessions currently active */
  activeSessions: number;
  /** Sessions that have been closed */
  closedSessions: number;
  /** Sessions that were missed */
  missedSessions: number;
  /** Sessions awaiting sign-off */
  pendingSignoffSessions: number;
  /** Aggregate task completion percentage (0-100) */
  taskCompletionPercent: number;
  /** Total tasks across all sessions */
  totalTasks: number;
  /** Completed tasks across all sessions */
  completedTasks: number;
  /** Number of open deviations (open + acknowledged + escalated) */
  openDeviations: number;
  /** Number of deviations that block day approval */
  blockingDeviations: number;
  /** Number of overdue + escalated tasks across today's sessions */
  overdueTasks: number;
};

const EMPTY_INSIGHTS: DriftInsights = {
  totalSessions: 0,
  activeSessions: 0,
  closedSessions: 0,
  missedSessions: 0,
  pendingSignoffSessions: 0,
  taskCompletionPercent: 0,
  totalTasks: 0,
  completedTasks: 0,
  openDeviations: 0,
  blockingDeviations: 0,
  overdueTasks: 0,
};

/**
 * Derives operational insights for the Drift page from existing session,
 * deviation, and task data. Composes useDepartmentSessions + useDeviations
 * with one additional query for overdue task count.
 */
export function useDriftInsights(date: string) {
  const ctx = useWorkspaceOptional();
  const wsId = ctx?.workspace.workspace_id;

  const { data: sessions, isLoading: sessionsLoading } = useDepartmentSessions(date);
  const { data: deviations, isLoading: deviationsLoading } = useDeviations({
    status: ["open", "acknowledged", "escalated"],
  });

  // Get session IDs to query overdue tasks
  const sessionIds = useMemo(() => (sessions ?? []).map((s) => s.sessionId), [sessions]);

  // Direct query for overdue/escalated task count across today's sessions
  const { data: overdueCount, isLoading: overdueLoading } = useQuery({
    queryKey: ["hms", "overdue-tasks", wsId, date, sessionIds],
    enabled: !!wsId && sessionIds.length > 0,
    staleTime: 15 * 1000,
    queryFn: async (): Promise<number> => {
      const supabase = createClient();
      const { count, error } = await supabase
        .from("session_task")
        .select("id", { count: "exact", head: true })
        .eq("workspace_id", wsId!)
        .in("department_session_id", sessionIds)
        .in("status", ["overdue", "escalated"]);

      if (error) throw error;
      return count ?? 0;
    },
  });

  const isLoading = sessionsLoading || deviationsLoading || overdueLoading;

  const insights = useMemo((): DriftInsights => {
    if (!sessions) return EMPTY_INSIGHTS;

    const totalSessions = sessions.length;
    const activeSessions = sessions.filter((s) => s.status === "active").length;
    const closedSessions = sessions.filter((s) => s.status === "closed").length;
    const missedSessions = sessions.filter((s) => s.status === "missed").length;
    const pendingSignoffSessions = sessions.filter((s) => s.status === "pending_signoff").length;

    const totalTasks = sessions.reduce((sum, s) => sum + s.tasksTotal, 0);
    const completedTasks = sessions.reduce((sum, s) => sum + s.tasksCompleted, 0);
    const taskCompletionPercent =
      totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

    const openDeviations = deviations?.length ?? 0;
    const blockingDeviations = deviations?.filter((d) => d.blocksDayApproval).length ?? 0;

    return {
      totalSessions,
      activeSessions,
      closedSessions,
      missedSessions,
      pendingSignoffSessions,
      taskCompletionPercent,
      totalTasks,
      completedTasks,
      openDeviations,
      blockingDeviations,
      overdueTasks: overdueCount ?? 0,
    };
  }, [sessions, deviations, overdueCount]);

  return { insights, isLoading };
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `cd /home/sxtnl/dev/smartout.ai && pnpm --filter web typecheck 2>&1 | grep -E "error|Error" | head -10`

Expected: No errors related to `use-drift-insights.ts`. If there are existing errors in other files, ignore them — focus only on the new file.

- [ ] **Step 3: Commit the hook**

```bash
git add apps/web/src/app/dashboard/hms/_hooks/use-drift-insights.ts
git commit -m "$(cat <<'EOF'
feat(hms): add use-drift-insights hook for operational metrics

Composes useDepartmentSessions + useDeviations with a direct overdue
task count query. Returns derived metrics: session completion, task
progress, open deviations, and overdue count. No new tables — all
data derives from existing department_session, deviation, and
session_task tables.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 4: Create the Drift Insight Strip Component

**Files:**

- Create: `apps/web/src/app/dashboard/hms/_components/DriftInsightStrip.tsx`

A compact horizontal row of 4 metric cells. Each cell shows a label, value, and optional sublabel. Uses CSS variable classes only — no hardcoded colors. Follows the KPI card variant pattern from OversiktDashboard but as a strip, not a grid.

- [ ] **Step 1: Create the component file**

Create `apps/web/src/app/dashboard/hms/_components/DriftInsightStrip.tsx`:

```typescript
"use client";

import { useTranslation } from "@smartout/i18n";
import {
  CalendarCheck,
  ClipboardCheck,
  AlertTriangle,
  Clock,
  Loader2,
} from "lucide-react";
import { useDriftInsights } from "../_hooks/use-drift-insights";

type MetricCellProps = {
  icon: typeof CalendarCheck;
  label: string;
  value: string | number;
  sublabel?: string;
  variant?: "default" | "warning" | "critical";
};

function MetricCell({
  icon: Icon,
  label,
  value,
  sublabel,
  variant = "default",
}: MetricCellProps) {
  const variantStyles = {
    default: "border-border",
    warning: "border-warning/40",
    critical: "border-destructive/40",
  };

  const valueStyles = {
    default: "text-foreground",
    warning: "text-warning",
    critical: "text-destructive",
  };

  return (
    <div
      className={`flex min-w-0 flex-1 items-center gap-3 border-r px-4 py-3 last:border-r-0 ${variantStyles[variant]}`}
    >
      <div className="bg-muted flex h-8 w-8 shrink-0 items-center justify-center rounded-lg">
        <Icon className="text-muted-foreground h-4 w-4" />
      </div>
      <div className="min-w-0">
        <p className="text-muted-foreground text-[10px] font-medium uppercase tracking-wider">
          {label}
        </p>
        <p className={`text-lg font-bold leading-tight ${valueStyles[variant]}`}>
          {value}
        </p>
        {sublabel && (
          <p className="text-muted-foreground truncate text-[10px]">
            {sublabel}
          </p>
        )}
      </div>
    </div>
  );
}

type DriftInsightStripProps = {
  date: string;
};

export function DriftInsightStrip({ date }: DriftInsightStripProps) {
  const { insights, isLoading } = useDriftInsights(date);
  const { t } = useTranslation("dashboard");

  if (isLoading) {
    return (
      <div className="border-border bg-card/50 flex items-center justify-center rounded-xl border py-4">
        <Loader2 className="text-muted-foreground h-4 w-4 animate-spin" />
      </div>
    );
  }

  if (insights.totalSessions === 0) {
    return null;
  }

  // Session status sublabel
  const sessionSublabel =
    insights.activeSessions > 0
      ? t("hms.drift_insights.sessions_active", {
          count: insights.activeSessions,
        })
      : insights.closedSessions === insights.totalSessions
        ? t("hms.drift_insights.sessions_all_closed")
        : t("hms.drift_insights.sessions_closed", {
            count: insights.closedSessions,
          });

  // Session variant
  const sessionVariant =
    insights.missedSessions > 0 ? "critical" : "default";

  // Task variant
  const taskVariant =
    insights.taskCompletionPercent < 50
      ? "critical"
      : insights.taskCompletionPercent < 80
        ? "warning"
        : "default";

  // Deviation variant
  const deviationVariant =
    insights.blockingDeviations > 0
      ? "critical"
      : insights.openDeviations > 0
        ? "warning"
        : "default";

  // Deviation sublabel
  const deviationSublabel =
    insights.blockingDeviations > 0
      ? t("hms.drift_insights.deviations_blocking", {
          count: insights.blockingDeviations,
        })
      : undefined;

  // Overdue variant
  const overdueVariant =
    insights.overdueTasks > 0 ? "warning" : "default";

  return (
    <div className="border-border bg-card/50 flex rounded-xl border">
      <MetricCell
        icon={CalendarCheck}
        label={t("hms.drift_insights.sessions_label")}
        value={`${insights.closedSessions}/${insights.totalSessions}`}
        sublabel={sessionSublabel}
        variant={sessionVariant}
      />
      <MetricCell
        icon={ClipboardCheck}
        label={t("hms.drift_insights.tasks_label")}
        value={`${insights.taskCompletionPercent}%`}
        sublabel={t("hms.drift_insights.tasks_sublabel", {
          completed: insights.completedTasks,
          total: insights.totalTasks,
        })}
        variant={taskVariant}
      />
      <MetricCell
        icon={AlertTriangle}
        label={t("hms.drift_insights.deviations_label")}
        value={
          insights.openDeviations > 0
            ? insights.openDeviations
            : t("hms.drift_insights.deviations_none")
        }
        sublabel={deviationSublabel}
        variant={deviationVariant}
      />
      <MetricCell
        icon={Clock}
        label={t("hms.drift_insights.overdue_label")}
        value={
          insights.overdueTasks > 0
            ? insights.overdueTasks
            : t("hms.drift_insights.overdue_none")
        }
        variant={overdueVariant}
      />
    </div>
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `cd /home/sxtnl/dev/smartout.ai && pnpm --filter web typecheck 2>&1 | grep -i "DriftInsightStrip\|use-drift-insights" | head -10`

Expected: No errors related to the new files.

- [ ] **Step 3: Commit the component**

```bash
git add apps/web/src/app/dashboard/hms/_components/DriftInsightStrip.tsx
git commit -m "$(cat <<'EOF'
feat(hms): add DriftInsightStrip component for operational insights

Compact horizontal metric strip showing 4 KPIs: session completion,
task progress %, open deviations, and overdue tasks. Uses CSS variable
classes (no hardcoded colors), variant states (default/warning/critical),
and i18n keys. Renders above the session table on the admin Drift page.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 5: Integrate Insight Strip into the Drift Page

**Files:**

- Modify: `apps/web/src/app/dashboard/hms/drift/page.tsx`

The Drift page currently renders `DriftSessionTable` for admins and `DriftTaskList` for employees. We add `DriftInsightStrip` above the session table for admins only. The strip needs the same date state as the session table.

- [ ] **Step 1: Refactor to share date state**

The current `DriftSessionTable` manages its own `date` state internally. The insight strip also needs this date. We need to lift the date state to the page level.

Replace the entire contents of `apps/web/src/app/dashboard/hms/drift/page.tsx` with:

```typescript
"use client";

import { useContext, useState } from "react";
import { DashboardContext } from "@/components/dashboard/DashboardShell";
import { DriftSessionTable } from "../_components/DriftSessionTable";
import { DriftTaskList } from "../_components/DriftTaskList";
import { DriftInsightStrip } from "../_components/DriftInsightStrip";

export default function DriftPage() {
  const { isAdminMode } = useContext(DashboardContext);

  if (!isAdminMode) {
    return <DriftTaskList />;
  }

  return <AdminDriftView />;
}

function AdminDriftView() {
  const [date] = useState(() => new Date().toISOString().split("T")[0]!);

  return (
    <div className="space-y-4">
      <DriftInsightStrip date={date} />
      <DriftSessionTable />
    </div>
  );
}
```

**Important note:** The `DriftSessionTable` manages its own date state and the insight strip uses a separate date state initialized to today. This means when the admin navigates dates in the session table, the insight strip stays on today. This is intentional for v1 — the strip shows "today's pulse." If date sync is desired later, we can lift the date state from `DriftSessionTable` to a shared context. Do NOT refactor `DriftSessionTable`'s date management in this task.

- [ ] **Step 2: Verify the page renders**

Run: `cd /home/sxtnl/dev/smartout.ai && pnpm --filter web typecheck 2>&1 | grep -i "drift/page\|DriftInsightStrip" | head -10`

Expected: No type errors.

- [ ] **Step 3: Commit the integration**

```bash
git add apps/web/src/app/dashboard/hms/drift/page.tsx
git commit -m "$(cat <<'EOF'
feat(hms): integrate insight strip into drift page

Adds DriftInsightStrip above DriftSessionTable for admin users.
Shows today's operational pulse: session completion, task progress,
open deviations, and overdue tasks. Employee view unchanged.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 6: Final Verification

- [ ] **Step 1: Run full typecheck**

Run: `cd /home/sxtnl/dev/smartout.ai && pnpm turbo typecheck 2>&1 | tail -20`

Expected: All packages pass. If pre-existing errors exist, verify none are in files we touched.

- [ ] **Step 2: Run lint on touched files**

Run: `cd /home/sxtnl/dev/smartout.ai && pnpm --filter web lint 2>&1 | grep -E "error|warning" | head -20`

Expected: No new lint errors in our files.

- [ ] **Step 3: Verify git status is clean**

Run: `git status`

Expected: All changes committed. Working tree clean (except pre-existing unstaged changes).

---

## Out of Scope (Documented for Follow-Up)

| Item                                              | Why Deferred                                                                                           | Priority |
| ------------------------------------------------- | ------------------------------------------------------------------------------------------------------ | -------- |
| Employee inline insights                          | Admin-first per council decision. Employee gets personal stats in Phase 2.                             | Medium   |
| 7-day trend sparklines                            | Requires `use-department-sessions-range.ts` hook with date range queries.                              | Medium   |
| Telemetry `drift_insights_viewed` event           | Read-only feature, no mutations. Register in registry when adding user-facing analytics.               | Low      |
| Fix existing hardcoded colors in HMS components   | Pre-existing debt (140 files). Fix when touching those components.                                     | Low      |
| KpiCard extraction to shared component            | OversiktDashboard and platform-admin have different KpiCard versions. Extract when patterns stabilize. | Low      |
| Guardian evaluators for proactive drift alerts    | Phase 2 work — stage engine evaluators writing guardian_signal rows.                                   | Medium   |
| `daily_reconciliation` labor insights             | Data availability unknown. Add when reconciliation flow is confirmed populated.                        | Low      |
| Mobile parity for insight data                    | Hook lives in `_hooks/` (web-only). Extract query logic to `packages/` when mobile needs it.           | Medium   |
| Date sync between insight strip and session table | Currently strip shows today, table is navigable. Sync if users request it.                             | Low      |
