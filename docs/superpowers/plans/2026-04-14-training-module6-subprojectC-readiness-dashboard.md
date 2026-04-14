---
title: "Module 6 Training — Sub-project C: Readiness Dashboard Enhancements"
status: draft
updated: 2026-04-14
created: 2026-04-14
module: training
tags: [training, module-6, readiness, dashboard, competence-matrix, kpi]
---

# Module 6 Training — Sub-project C: Readiness Dashboard Enhancements

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Upgrade the HMS readiness dashboard to leverage the denormalized progress columns from Sub-project 0. Replace binary completed/not badges with real progress indicators, add department-level readiness summaries, surface new assignment statuses (`not_started`, `in_progress`, `waived`), and show upcoming review schedules.

**Architecture:** Pure frontend enhancement. All data already exists in `protocol_assignment` (added by Sub-project 0 migration). No new migrations, no new API endpoints. Extend existing hooks to fetch new columns, update existing components, create one new component (`DepartmentReadiness`).

**Tech Stack:** React 19, TypeScript, TanStack Query, shadcn/ui (Card, Badge, Button, Tooltip, Collapsible), Tailwind v4 CSS variables, `@smartout/i18n`

**Depends on:** Sub-project 0 (schema foundation) must be merged first — provides `procedures_total`, `procedures_completed`, `tests_total`, `tests_passed`, `confirmations_total`, `confirmations_signed`, `assigned_via`, `next_review_at`, `protocol_version`, and extended `protocol_assignment_status` enum.

---

## File Structure

### New files
| File | Responsibility |
|------|---------------|
| `apps/web/src/app/dashboard/hms/_components/DepartmentReadiness.tsx` | Department-level readiness summary with collapsible per-employee detail |

### Modified files
| File | Change |
|------|--------|
| `apps/web/src/app/dashboard/hms/_components/CompetenceMatrix.tsx` | Fetch denormalized progress, replace CellBadge with progress indicator, add new statuses, show assignment source on hover |
| `apps/web/src/app/dashboard/hms/_components/OversiktDashboard.tsx` | Add "Neste forfall" KPI card, update readiness calc to use real progress, integrate DepartmentReadiness |
| `apps/web/src/app/dashboard/hms/_hooks/use-governance-filtered.ts` | Account for `not_started`, `in_progress`, `waived` statuses in stats |
| `apps/web/src/app/dashboard/_hooks/use-governance-overview.ts` | Extend countMap to track `not_started`, `in_progress`, `waived` counts |
| `apps/web/src/app/dashboard/_hooks/dashboard-types.ts` | Add `notStartedCount`, `inProgressCount`, `waivedCount` to `ProtocolOverviewItem` |

---

## Task 1: Enhance CompetenceMatrix with progress bars

**Files:**
- Modify: `apps/web/src/app/dashboard/hms/_components/CompetenceMatrix.tsx`

- [ ] **Step 1: Update MatrixRow type and add progress types**

Replace the existing `MatrixRow` type at the top of the file with extended types that include denormalized progress data and all six statuses:

```typescript
type AssignmentStatus =
  | "not_started"
  | "in_progress"
  | "completed"
  | "expired"
  | "waived"
  | "pending"
  | "not_assigned";

type AssignmentProgress = {
  proceduresTotal: number;
  proceduresCompleted: number;
  testsTotal: number;
  testsPassed: number;
  confirmationsTotal: number;
  confirmationsSigned: number;
};

type CellData = {
  status: AssignmentStatus;
  percent: number;
  progress: AssignmentProgress | null;
  assignedVia: string | null;
};

type MatrixRow = {
  profileId: string;
  profileName: string;
  departmentName: string | null;
  protocols: Record<string, CellData>;
  readinessPercent: number;
};

type ProtocolColumn = {
  protocolId: string;
  protocolName: string;
};
```

- [ ] **Step 2: Update useCompetenceData to fetch denormalized columns**

Modify the `assignmentsRes` query inside `useCompetenceData` to fetch all new columns:

```typescript
supabase
  .from("protocol_assignment")
  .select(
    "profile_id, protocol_id, status, assigned_via, procedures_total, procedures_completed, tests_total, tests_passed, confirmations_total, confirmations_signed"
  )
  .eq("workspace_id", workspace.workspace_id),
```

- [ ] **Step 3: Update assignment map building to include progress data**

Replace the assignment map building logic with a richer structure that stores progress and source:

```typescript
// Build assignment lookup: profileId -> protocolId -> assignment data
type AssignmentData = {
  status: string;
  assignedVia: string | null;
  proceduresTotal: number;
  proceduresCompleted: number;
  testsTotal: number;
  testsPassed: number;
  confirmationsTotal: number;
  confirmationsSigned: number;
};

const assignmentMap = new Map<string, Map<string, AssignmentData>>();
for (const a of assignmentsRes.data ?? []) {
  if (!assignmentMap.has(a.profile_id)) assignmentMap.set(a.profile_id, new Map());
  assignmentMap.get(a.profile_id)!.set(a.protocol_id, {
    status: a.status,
    assignedVia: a.assigned_via,
    proceduresTotal: a.procedures_total ?? 0,
    proceduresCompleted: a.procedures_completed ?? 0,
    testsTotal: a.tests_total ?? 0,
    testsPassed: a.tests_passed ?? 0,
    confirmationsTotal: a.confirmations_total ?? 0,
    confirmationsSigned: a.confirmations_signed ?? 0,
  });
}
```

- [ ] **Step 4: Update row building to calculate real progress percent**

Replace the row building loop to compute progress from denormalized counts instead of binary completed/not:

```typescript
const rows: MatrixRow[] = (profilesRes.data ?? []).map((profile) => {
  const dept = profile.department as unknown as { name: string } | null;
  const assignments = assignmentMap.get(profile.profile_id) ?? new Map();

  const protocols: MatrixRow["protocols"] = {};
  let totalWeightedProgress = 0;
  let assignedCount = 0;

  for (const col of columns) {
    const assignment = assignments.get(col.protocolId);
    if (assignment) {
      assignedCount++;
      const totalSteps =
        assignment.proceduresTotal + assignment.testsTotal + assignment.confirmationsTotal;
      const completedSteps =
        assignment.proceduresCompleted + assignment.testsPassed + assignment.confirmationsSigned;
      const percent = totalSteps > 0 ? Math.round((completedSteps / totalSteps) * 100) : 0;

      totalWeightedProgress += percent;

      protocols[col.protocolId] = {
        status: assignment.status as AssignmentStatus,
        percent,
        progress: {
          proceduresTotal: assignment.proceduresTotal,
          proceduresCompleted: assignment.proceduresCompleted,
          testsTotal: assignment.testsTotal,
          testsPassed: assignment.testsPassed,
          confirmationsTotal: assignment.confirmationsTotal,
          confirmationsSigned: assignment.confirmationsSigned,
        },
        assignedVia: assignment.assignedVia,
      };
    } else {
      protocols[col.protocolId] = {
        status: "not_assigned",
        percent: 0,
        progress: null,
        assignedVia: null,
      };
    }
  }

  return {
    profileId: profile.profile_id,
    profileName: profile.display_name ?? "Ukjent",
    departmentName: dept?.name ?? null,
    protocols,
    readinessPercent:
      assignedCount > 0 ? Math.round(totalWeightedProgress / assignedCount) : 0,
  };
});
```

- [ ] **Step 5: Replace CellBadge with ProgressCell component**

Replace the `CellBadge` function with a new `ProgressCell` component that shows a mini progress bar for in-progress items and status badges for terminal states. Add Tooltip import at the top of the file:

```typescript
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Building2,
  Users as UsersIcon,
  MapPin,
  UserPlus,
  Briefcase,
  Calendar,
  Layers,
} from "lucide-react";
```

Then the component:

```typescript
/** Icon for assignment source — shown on hover */
const ASSIGNED_VIA_ICONS: Record<string, typeof Building2> = {
  workspace: Layers,
  department: Building2,
  team: UsersIcon,
  location: MapPin,
  position: Briefcase,
  manual: UserPlus,
  season: Calendar,
};

const ASSIGNED_VIA_LABELS: Record<string, string> = {
  workspace: "Tildelt via arbeidssted",
  department: "Tildelt via avdeling",
  team: "Tildelt via team",
  location: "Tildelt via lokasjon",
  position: "Tildelt via stilling",
  manual: "Manuelt tildelt",
  season: "Tildelt via sesong",
};

function ProgressCell({ cell, t }: { cell: CellData; t: (key: string) => string }) {
  const { status, percent, progress, assignedVia } = cell;

  // Terminal / non-progress states
  if (status === "not_assigned") {
    return <span className="text-muted-foreground text-[10px]">--</span>;
  }

  if (status === "waived") {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge className="bg-yellow-500/15 text-[10px] text-yellow-600 line-through hover:bg-yellow-500/15">
            Frafalt
          </Badge>
        </TooltipTrigger>
        <TooltipContent>
          <p className="text-xs">Protokollen er frafalt for denne ansatte</p>
        </TooltipContent>
      </Tooltip>
    );
  }

  if (status === "completed") {
    return (
      <CellWithSource assignedVia={assignedVia}>
        <Badge className="bg-green-500/15 text-[10px] text-green-600 hover:bg-green-500/15">
          {t("hms.competence_matrix.status_ok")}
        </Badge>
      </CellWithSource>
    );
  }

  if (status === "expired") {
    return (
      <CellWithSource assignedVia={assignedVia}>
        <Badge className="bg-red-500/15 text-[10px] text-red-600 hover:bg-red-500/15">
          {t("hms.competence_matrix.status_expired")}
        </Badge>
      </CellWithSource>
    );
  }

  // not_started — no progress yet
  if (status === "not_started") {
    return (
      <CellWithSource assignedVia={assignedVia}>
        <Badge variant="outline" className="text-muted-foreground text-[10px]">
          Ikke startet
        </Badge>
      </CellWithSource>
    );
  }

  // in_progress or legacy pending — show mini progress bar
  const label = progress
    ? `${progress.proceduresCompleted + progress.testsPassed + progress.confirmationsSigned}/${progress.proceduresTotal + progress.testsTotal + progress.confirmationsTotal}`
    : `${percent}%`;

  return (
    <CellWithSource assignedVia={assignedVia}>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="flex flex-col items-center gap-0.5">
            <div className="bg-muted h-1.5 w-12 overflow-hidden rounded-full">
              <div
                className="h-full rounded-full bg-blue-500 transition-all"
                style={{ width: `${percent}%` }}
              />
            </div>
            <span className="text-muted-foreground text-[9px]">{label}</span>
          </div>
        </TooltipTrigger>
        <TooltipContent>
          {progress && (
            <div className="space-y-1 text-xs">
              <p>Prosedyrer: {progress.proceduresCompleted}/{progress.proceduresTotal}</p>
              <p>Tester: {progress.testsPassed}/{progress.testsTotal}</p>
              <p>Bekreftelser: {progress.confirmationsSigned}/{progress.confirmationsTotal}</p>
            </div>
          )}
        </TooltipContent>
      </Tooltip>
    </CellWithSource>
  );
}

/** Wraps a cell with an assignment source icon on hover */
function CellWithSource({
  assignedVia,
  children,
}: {
  assignedVia: string | null;
  children: React.ReactNode;
}) {
  if (!assignedVia) return <>{children}</>;

  const SourceIcon = ASSIGNED_VIA_ICONS[assignedVia] ?? Layers;
  const sourceLabel = ASSIGNED_VIA_LABELS[assignedVia] ?? assignedVia;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div className="group relative inline-flex flex-col items-center">
          {children}
          <SourceIcon className="text-muted-foreground mt-0.5 h-2.5 w-2.5 opacity-0 transition-opacity group-hover:opacity-100" />
        </div>
      </TooltipTrigger>
      <TooltipContent>
        <p className="text-xs">{sourceLabel}</p>
      </TooltipContent>
    </Tooltip>
  );
}
```

- [ ] **Step 6: Update the matrix table body to use ProgressCell**

In the `<tbody>` of the matrix table, replace the `CellBadge` usage:

```typescript
{data.columns.map((col) => (
  <td key={col.protocolId} className="px-2 py-2 text-center">
    <ProgressCell
      cell={row.protocols[col.protocolId] ?? { status: "not_assigned", percent: 0, progress: null, assignedVia: null }}
      t={t}
    />
  </td>
))}
```

- [ ] **Step 7: Wrap CompetenceMatrix return in TooltipProvider**

Import `TooltipProvider` and wrap the entire return JSX:

```typescript
import { TooltipProvider } from "@/components/ui/tooltip";
```

Then wrap the `<div className="space-y-4">` with `<TooltipProvider delayDuration={200}>...</TooltipProvider>`.

---

## Task 2: Add Department Readiness Summary

**Files:**
- Create: `apps/web/src/app/dashboard/hms/_components/DepartmentReadiness.tsx`

- [ ] **Step 1: Create the DepartmentReadiness component**

```typescript
"use client";

import { useContext, useMemo, useState } from "react";
import { ChevronDown, ChevronRight, Building2 } from "lucide-react";
import { useTranslation } from "@smartout/i18n";
import { DashboardContext } from "@/components/dashboard/DashboardShell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Badge } from "@/components/ui/badge";

type EmployeeSummary = {
  profileId: string;
  profileName: string;
  readinessPercent: number;
  assignedCount: number;
  completedCount: number;
};

type DepartmentSummary = {
  name: string;
  employeeCount: number;
  avgReadiness: number;
  totalAssigned: number;
  totalCompleted: number;
  employees: EmployeeSummary[];
};

type DepartmentReadinessProps = {
  rows: Array<{
    profileId: string;
    profileName: string;
    departmentName: string | null;
    protocols: Record<string, { status: string; percent: number }>;
    readinessPercent: number;
  }>;
};

function readinessColor(percent: number): string {
  if (percent >= 80) return "text-green-600";
  if (percent >= 50) return "text-yellow-600";
  return "text-red-600";
}

function readinessBg(percent: number): string {
  if (percent >= 80) return "bg-green-500";
  if (percent >= 50) return "bg-yellow-500";
  return "bg-red-500";
}

function DepartmentRow({ dept }: { dept: DepartmentSummary }) {
  const [open, setOpen] = useState(false);

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger asChild>
        <button
          type="button"
          className="hover:bg-muted/50 flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors"
        >
          {open ? (
            <ChevronDown className="text-muted-foreground h-4 w-4 shrink-0" />
          ) : (
            <ChevronRight className="text-muted-foreground h-4 w-4 shrink-0" />
          )}
          <Building2 className="text-muted-foreground h-4 w-4 shrink-0" />
          <div className="min-w-0 flex-1">
            <p className="text-foreground text-sm font-medium">{dept.name}</p>
            <p className="text-muted-foreground text-xs">
              {dept.employeeCount} ansatte
            </p>
          </div>
          {/* Progress bar */}
          <div className="flex items-center gap-2">
            <div className="bg-muted h-2 w-20 overflow-hidden rounded-full">
              <div
                className={`h-full rounded-full transition-all ${readinessBg(dept.avgReadiness)}`}
                style={{ width: `${dept.avgReadiness}%` }}
              />
            </div>
            <span className={`min-w-[3ch] text-right text-sm font-bold ${readinessColor(dept.avgReadiness)}`}>
              {dept.avgReadiness}%
            </span>
          </div>
          <Badge variant="outline" className="text-muted-foreground text-[10px]">
            {dept.totalCompleted}/{dept.totalAssigned}
          </Badge>
        </button>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="border-border/50 ml-11 space-y-1 border-l pl-3 pt-1 pb-2">
          {dept.employees.map((emp) => (
            <div
              key={emp.profileId}
              className="flex items-center gap-3 rounded px-2 py-1.5 text-sm"
            >
              <span className="text-foreground min-w-0 flex-1 truncate">
                {emp.profileName}
              </span>
              <div className="flex items-center gap-2">
                <div className="bg-muted h-1.5 w-14 overflow-hidden rounded-full">
                  <div
                    className={`h-full rounded-full transition-all ${readinessBg(emp.readinessPercent)}`}
                    style={{ width: `${emp.readinessPercent}%` }}
                  />
                </div>
                <span
                  className={`min-w-[3ch] text-right text-xs font-medium ${readinessColor(emp.readinessPercent)}`}
                >
                  {emp.readinessPercent}%
                </span>
              </div>
              <span className="text-muted-foreground text-[10px]">
                {emp.completedCount}/{emp.assignedCount}
              </span>
            </div>
          ))}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

export function DepartmentReadiness({ rows }: DepartmentReadinessProps) {
  const { t } = useTranslation("dashboard");
  const { isDark } = useContext(DashboardContext);

  const departments = useMemo(() => {
    const deptMap = new Map<string, EmployeeSummary[]>();

    for (const row of rows) {
      const deptName = row.departmentName ?? "Uten avdeling";
      if (!deptMap.has(deptName)) deptMap.set(deptName, []);

      const protocols = Object.values(row.protocols);
      const assigned = protocols.filter((p) => p.status !== "not_assigned");
      const completed = protocols.filter((p) => p.status === "completed");

      deptMap.get(deptName)!.push({
        profileId: row.profileId,
        profileName: row.profileName,
        readinessPercent: row.readinessPercent,
        assignedCount: assigned.length,
        completedCount: completed.length,
      });
    }

    const summaries: DepartmentSummary[] = [];
    for (const [name, employees] of deptMap) {
      const totalAssigned = employees.reduce((s, e) => s + e.assignedCount, 0);
      const totalCompleted = employees.reduce((s, e) => s + e.completedCount, 0);
      const avgReadiness =
        employees.length > 0
          ? Math.round(employees.reduce((s, e) => s + e.readinessPercent, 0) / employees.length)
          : 0;

      summaries.push({
        name,
        employeeCount: employees.length,
        avgReadiness,
        totalAssigned,
        totalCompleted,
        employees: employees.sort((a, b) => a.readinessPercent - b.readinessPercent),
      });
    }

    return summaries.sort((a, b) => a.avgReadiness - b.avgReadiness);
  }, [rows]);

  if (departments.length === 0) return null;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Building2 className="text-muted-foreground h-5 w-5" />
          Avdelingsvis beredskap
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-1 pt-0">
        {departments.map((dept) => (
          <DepartmentRow key={dept.name} dept={dept} />
        ))}
      </CardContent>
    </Card>
  );
}
```

---

## Task 3: Enhance OversiktDashboard KPIs

**Files:**
- Modify: `apps/web/src/app/dashboard/hms/_components/OversiktDashboard.tsx`
- Modify: `apps/web/src/app/dashboard/_hooks/use-governance-overview.ts`
- Modify: `apps/web/src/app/dashboard/_hooks/dashboard-types.ts`

- [ ] **Step 1: Extend ProtocolOverviewItem type**

In `apps/web/src/app/dashboard/_hooks/dashboard-types.ts`, add the new status counts to `ProtocolOverviewItem`:

```typescript
// Add these fields alongside existing completedCount, pendingCount, expiredCount:
notStartedCount: number;
inProgressCount: number;
waivedCount: number;
```

- [ ] **Step 2: Update useGovernanceOverview to count new statuses**

In `apps/web/src/app/dashboard/_hooks/use-governance-overview.ts`, extend the countMap to track all six statuses:

Replace the countMap type and counting logic:

```typescript
const countMap = new Map<
  string,
  {
    completed: number;
    pending: number;
    expired: number;
    not_started: number;
    in_progress: number;
    waived: number;
    total: number;
  }
>();

for (const a of assignments ?? []) {
  const existing = countMap.get(a.protocol_id) ?? {
    completed: 0,
    pending: 0,
    expired: 0,
    not_started: 0,
    in_progress: 0,
    waived: 0,
    total: 0,
  };
  existing.total++;
  const status = a.status as string;
  if (status === "completed") existing.completed++;
  else if (status === "pending") existing.pending++;
  else if (status === "expired") existing.expired++;
  else if (status === "not_started") existing.not_started++;
  else if (status === "in_progress") existing.in_progress++;
  else if (status === "waived") existing.waived++;
  countMap.set(a.protocol_id, existing);
}
```

And in the items mapping, add the new counts:

```typescript
notStartedCount: counts.not_started,
inProgressCount: counts.in_progress,
waivedCount: counts.waived,
```

Also update `completionPercent` to use progress-based calculation. Modify the query to also fetch denormalized progress:

```typescript
const { data: assignments, error: assignmentError } = await supabase
  .from("protocol_assignment")
  .select(
    "protocol_id, status, procedures_total, procedures_completed, tests_total, tests_passed, confirmations_total, confirmations_signed"
  )
  .in("protocol_id", protocolIds);
```

Then compute a progress-weighted completion percent:

```typescript
// After the countMap loop, build a progress map
const progressMap = new Map<string, { totalSteps: number; completedSteps: number }>();
for (const a of assignments ?? []) {
  const existing = progressMap.get(a.protocol_id) ?? { totalSteps: 0, completedSteps: 0 };
  const total = (a.procedures_total ?? 0) + (a.tests_total ?? 0) + (a.confirmations_total ?? 0);
  const done = (a.procedures_completed ?? 0) + (a.tests_passed ?? 0) + (a.confirmations_signed ?? 0);
  existing.totalSteps += total;
  existing.completedSteps += done;
  progressMap.set(a.protocol_id, existing);
}
```

In items mapping, replace the completionPercent calculation:

```typescript
const progress = progressMap.get(p.protocol_id);
const completionPercent = progress && progress.totalSteps > 0
  ? Math.round((progress.completedSteps / progress.totalSteps) * 100)
  : counts.total > 0
    ? Math.round((counts.completed / counts.total) * 100)
    : 0;
```

Use `completionPercent` instead of the inline calculation.

- [ ] **Step 3: Add "Neste forfall" KPI and DepartmentReadiness to OversiktDashboard**

In `apps/web/src/app/dashboard/hms/_components/OversiktDashboard.tsx`:

Add imports at the top:

```typescript
import { CalendarClock } from "lucide-react";
import { useCompetenceData } from "./CompetenceMatrix";
import { DepartmentReadiness } from "./DepartmentReadiness";
```

**Note:** `useCompetenceData` must be exported from CompetenceMatrix.tsx. Add `export` to its function declaration: `export function useCompetenceData()`.

Inside the component, after the existing hooks, add:

```typescript
const { data: competenceData } = useCompetenceData();
```

Add a query for upcoming reviews. Insert after the `openDeviationCount` line:

```typescript
// Count assignments with next_review_at within 30 days
const { data: upcomingReviews } = useQuery({
  queryKey: ["hms", "upcoming-reviews", workspace.workspace_id],
  staleTime: 5 * 60 * 1000,
  queryFn: async (): Promise<number> => {
    const supabase = createClient();
    const thirtyDaysFromNow = new Date();
    thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);

    const { count, error } = await supabase
      .from("protocol_assignment")
      .select("*", { count: "exact", head: true })
      .eq("workspace_id", workspace.workspace_id)
      .not("next_review_at", "is", null)
      .lte("next_review_at", thirtyDaysFromNow.toISOString());

    if (error) throw error;
    return count ?? 0;
  },
});
const upcomingReviewCount = upcomingReviews ?? 0;
```

Add the necessary imports:

```typescript
import { useQuery } from "@tanstack/react-query";
import { createClient } from "@smartout/supabase/client";
import { useWorkspace } from "@/lib/workspace-context";
```

Inside the component, add workspace access:

```typescript
const { workspace } = useWorkspace();
```

Add the new KPI card inside the grid (after the existing 4 cards, making it a 5th card):

```typescript
<KpiCard
  icon={CalendarClock}
  label="Kommende fornyelser"
  value={upcomingReviewCount}
  sublabel="Neste 30 dager"
  variant={upcomingReviewCount > 5 ? "warning" : "default"}
/>
```

Update the grid from `lg:grid-cols-4` to `lg:grid-cols-5` to accommodate the 5th card. If that is too tight, keep `lg:grid-cols-4` and let the 5th card wrap to the next row.

Add `DepartmentReadiness` below the status block (after the `</div>` closing the KPI grid's parent):

```typescript
{/* Block A2: Department Readiness */}
{competenceData && competenceData.rows.length > 0 && (
  <DepartmentReadiness rows={competenceData.rows} />
)}
```

---

## Task 4: Update status handling across components

**Files:**
- Modify: `apps/web/src/app/dashboard/hms/_hooks/use-governance-filtered.ts`
- Modify: `apps/web/src/app/dashboard/_hooks/use-governance-overview.ts` (already modified in Task 3)
- Modify: `apps/web/src/app/dashboard/hms/_components/CompetenceMatrix.tsx` (already modified in Task 1)

- [ ] **Step 1: Update useGovernanceFiltered stats to account for new statuses**

In `apps/web/src/app/dashboard/hms/_hooks/use-governance-filtered.ts`, update the `stats` useMemo to include new status counts:

```typescript
const stats = useMemo(() => {
  const total = filtered.length;
  const overdue = filtered.filter((p) => p.expiredCount > 0).length;
  const avgCompletion =
    total > 0 ? Math.round(filtered.reduce((s, p) => s + p.completionPercent, 0) / total) : 0;
  const notStarted = filtered.reduce((s, p) => s + (p.notStartedCount ?? 0), 0);
  const inProgress = filtered.reduce((s, p) => s + (p.inProgressCount ?? 0), 0);
  const waived = filtered.reduce((s, p) => s + (p.waivedCount ?? 0), 0);
  return { total, overdue, avgCompletion, notStarted, inProgress, waived };
}, [filtered]);
```

- [ ] **Step 2: Verify all six statuses render correctly in CompetenceMatrix**

Confirm the `ProgressCell` component from Task 1 handles all six statuses:

| Status | Visual |
|--------|--------|
| `not_assigned` | Gray `--` text |
| `not_started` | Outline badge "Ikke startet" |
| `in_progress` | Blue mini progress bar with step count tooltip |
| `completed` | Green badge with checkmark text |
| `expired` | Red badge |
| `waived` | Yellow strikethrough badge with tooltip |
| `pending` | Blue mini progress bar (legacy, treated as in_progress) |

No additional code changes needed — this is a verification step.

- [ ] **Step 3: Remove old CellBadge function**

Delete the old `CellBadge` function from `CompetenceMatrix.tsx`. It is fully replaced by `ProgressCell`.

---

## Task 5: Typecheck and commit

**Files:** None created — verification only.

- [ ] **Step 1: Run typecheck**

```bash
pnpm turbo typecheck
```

Fix any type errors. Common issues to watch for:
- `assignedVia` column may be typed as the enum union or `string | null` in `database.types.ts` — cast as needed
- `procedures_total` etc. may be `number | null` in generated types — use `?? 0` fallback
- `useCompetenceData` export may need explicit return type for cross-file usage

- [ ] **Step 2: Run lint**

```bash
pnpm turbo lint -- --filter=apps/web
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/app/dashboard/hms/_components/CompetenceMatrix.tsx \
       apps/web/src/app/dashboard/hms/_components/DepartmentReadiness.tsx \
       apps/web/src/app/dashboard/hms/_components/OversiktDashboard.tsx \
       apps/web/src/app/dashboard/hms/_hooks/use-governance-filtered.ts \
       apps/web/src/app/dashboard/_hooks/use-governance-overview.ts \
       apps/web/src/app/dashboard/_hooks/dashboard-types.ts

git commit -m "feat(hms): enhance readiness dashboard with progress bars and department summary

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

## Verification Checklist

- [ ] `pnpm turbo typecheck` passes with 0 errors
- [ ] CompetenceMatrix shows mini progress bars for in-progress assignments
- [ ] CompetenceMatrix shows all 6 status badges (not_started, in_progress, completed, expired, waived, not_assigned)
- [ ] Hover on a cell shows assignment source icon (manual, department, etc.)
- [ ] Hover on in-progress cell shows procedure/test/confirmation breakdown
- [ ] DepartmentReadiness renders below KPI cards on OversiktDashboard
- [ ] DepartmentReadiness rows are collapsible, showing per-employee detail
- [ ] Department rows are color-coded: green >= 80%, orange 50-79%, red < 50%
- [ ] "Kommende fornyelser" KPI card shows count of assignments due for review within 30 days
- [ ] Readiness percentage uses weighted progress (not binary completed/not)
- [ ] useGovernanceFiltered stats include notStarted, inProgress, waived counts
- [ ] No hardcoded colors outside of status indicators (uses CSS variables)
- [ ] All shadcn/ui components used correctly (Card, Badge, Tooltip, Collapsible)
- [ ] TooltipProvider wraps tooltip-using components
- [ ] OversiktEmployee is unchanged (it already uses `@smartout/training` readiness)
