---
title: "Plan B — Driftsoversikt Enhancement"
status: draft
updated: 2026-04-13
created: 2026-04-13
module: operations
tags: [driftsoversikt, operations, haccp, plan]
---

# Plan B — Driftsoversikt Enhancement Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enhance the existing Aktiv Pipeline page (`/dashboard/operations/`) with HACCP temperature status and cleaning checklist status cards, fix hardcoded Norwegian strings and colors, and add deviation severity breakdown.

**Architecture:** Enhancement of existing page — no new routes. Add 2 queries to `useOperationsData()`, add 2 KPI cards, fix i18n/color violations. Prereq: fix createDeviation bug.

**Tech Stack:** Next.js App Router, TanStack Query, shadcn/ui, Supabase, @smartout/telemetry, packages/i18n

**Spec:** `docs/superpowers/specs/2026-04-13-missing-features-renhold-drift-skiftbytte-design.md` § Feature 2

**IMPORTANT:** This plan touches ONLY `/dashboard/operations/` and `packages/ai/src/capabilities/operations/tools.ts`. Do NOT modify HMS, governance, or schedule files.

---

## File Map

| Action | File | Responsibility |
|--------|------|----------------|
| Modify | `packages/ai/src/capabilities/operations/tools.ts` | Fix createDeviation bug (prereq) |
| Create | `packages/i18n/locales/nb/operations.json` | Norwegian operations labels |
| Create | `packages/i18n/locales/en/operations.json` | English operations labels |
| Modify | `apps/web/src/app/dashboard/operations/_hooks/use-operations-data.ts` | Add HACCP + cleaning queries |
| Modify | `apps/web/src/app/dashboard/operations/page.tsx` | Add 2 KPI cards, fix i18n + colors |

---

### Task 1: Fix createDeviation Bug (Prereq)

**Files:**
- Modify: `packages/ai/src/capabilities/operations/tools.ts`

- [ ] **Step 1: Read the current createDeviation tool**

Read `packages/ai/src/capabilities/operations/tools.ts` lines 155-200.

- [ ] **Step 2: Add domain to the Zod schema**

Find the `schema: z.object({` block in the `createDeviation` tool definition. Add `domain` field:

```typescript
  schema: z.object({
    title: z.string().min(3).describe("Short title describing the deviation"),
    description: z.string().optional().describe("Detailed description of what happened"),
    domain: z
      .enum(["safety", "customer", "procedure", "system", "material"])
      .default("procedure")
      .describe("Deviation domain category"),
    severity: z
      .enum(["low", "medium", "high", "critical"])
      .optional()
      .default("medium")
      .describe("Severity level of the deviation"),
    department_id: z
      .string()
      .uuid()
      .optional()
      .describe("Department ID. If omitted, uses the employee's department."),
  }),
```

- [ ] **Step 3: Add domain to the insert payload**

Find the `.insert({` block and add `domain: params.domain,` to the payload:

```typescript
    const { data, error } = await supabase
      .from("deviation")
      .insert({
        workspace_id: ctx.workspaceId,
        department_id: deptId,
        domain: params.domain,
        reported_by: ctx.profileId,
        title: params.title,
        description: params.description ?? null,
        severity: params.severity,
        status: "open",
      })
```

- [ ] **Step 4: Run typecheck**

```bash
pnpm --filter ai typecheck
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/ai/src/capabilities/operations/tools.ts
git commit -m "fix(ai): add missing domain field to createDeviation tool schema"
```

---

### Task 2: Operations i18n Labels

**Files:**
- Create: `packages/i18n/locales/nb/operations.json`
- Create: `packages/i18n/locales/en/operations.json`

- [ ] **Step 1: Create Norwegian operations labels**

These replace the hardcoded strings in the existing operations page:

```json
{
  "operations.title": "Aktiv Pipeline",
  "operations.live": "LIVE",
  "operations.reportDeviation": "Registrer avvik",
  "operations.taskCompletion": "Fullføring",
  "operations.stressLevel": "Stressnivå",
  "operations.overdue": "Forfalt",
  "operations.upcoming": "Kommende",
  "operations.staffPresent": "Til stede",
  "operations.activeTasks": "Aktive",
  "operations.temperature": "Temperatur",
  "operations.temperatureOk": "OK",
  "operations.temperatureDeviation": "Avvik",
  "operations.temperatureStale": "Siste måling over 2 timer gammel",
  "operations.temperatureNone": "Ingen målinger i dag",
  "operations.cleaning": "Renholdssjekk",
  "operations.cleaningProgress": "{{done}}/{{total}} fullført",
  "operations.cleaningNone": "Ingen sjekklister i dag",
  "operations.deviations": "Åpne avvik",
  "operations.deviationsCritical": "Kritisk",
  "operations.deviationsHigh": "Høy",
  "operations.deviationsMedium": "Middels",
  "operations.deviationsLow": "Lav",
  "operations.stressLow": "Lav",
  "operations.stressMedium": "Middels",
  "operations.stressHigh": "Høy",
  "operations.departments": "Avdelinger",
  "operations.revenueVsCost": "Omsetning vs. lønnskostnad",
  "operations.shortStaff": "Underbemannet",
  "operations.nextHours": "Neste 2 timer",
  "operations.loading": "Laster driftsdata..."
}
```

- [ ] **Step 2: Create English operations labels**

```json
{
  "operations.title": "Active Pipeline",
  "operations.live": "LIVE",
  "operations.reportDeviation": "Report deviation",
  "operations.taskCompletion": "Completion",
  "operations.stressLevel": "Stress Level",
  "operations.overdue": "Overdue",
  "operations.upcoming": "Upcoming",
  "operations.staffPresent": "Present",
  "operations.activeTasks": "Active",
  "operations.temperature": "Temperature",
  "operations.temperatureOk": "OK",
  "operations.temperatureDeviation": "Deviation",
  "operations.temperatureStale": "Last reading over 2 hours ago",
  "operations.temperatureNone": "No readings today",
  "operations.cleaning": "Cleaning Check",
  "operations.cleaningProgress": "{{done}}/{{total}} completed",
  "operations.cleaningNone": "No checklists today",
  "operations.deviations": "Open Deviations",
  "operations.deviationsCritical": "Critical",
  "operations.deviationsHigh": "High",
  "operations.deviationsMedium": "Medium",
  "operations.deviationsLow": "Low",
  "operations.stressLow": "Low",
  "operations.stressMedium": "Medium",
  "operations.stressHigh": "High",
  "operations.departments": "Departments",
  "operations.revenueVsCost": "Revenue vs. labor cost",
  "operations.shortStaff": "Short staffed",
  "operations.nextHours": "Next 2 hours",
  "operations.loading": "Loading operations data..."
}
```

- [ ] **Step 3: Commit**

```bash
git add packages/i18n/locales/nb/operations.json packages/i18n/locales/en/operations.json
git commit -m "feat(i18n): add operations dashboard labels (nb + en)"
```

---

### Task 3: Extend useOperationsData Hook

**Files:**
- Modify: `apps/web/src/app/dashboard/operations/_hooks/use-operations-data.ts`

- [ ] **Step 1: Read the full existing hook**

Read `apps/web/src/app/dashboard/operations/_hooks/use-operations-data.ts` to understand the query structure and `OperationsData` type.

- [ ] **Step 2: Extend the OperationsData type**

Add to the `OperationsData` type:

```typescript
export type HaccpReading = {
  department_id: string;
  temperature: number;
  is_within_range: boolean;
  logged_at: string;
  ccp_reference: string | null;
};

export type CleaningStatus = {
  done: number;
  total: number;
};

export type DeviationBreakdown = {
  critical: number;
  high: number;
  medium: number;
  low: number;
  total: number;
};

export type OperationsData = {
  // ... existing fields ...

  // New: HACCP temperature status
  haccpReadings: HaccpReading[];
  haccpStatus: "ok" | "deviation" | "stale" | "none";
  lastHaccpTime: string | null;

  // New: Cleaning checklist status
  cleaningStatus: CleaningStatus;

  // Enhanced: Deviation severity breakdown
  deviationBreakdown: DeviationBreakdown;
};
```

- [ ] **Step 3: Add HACCP and cleaning queries to the queryFn**

Find the `Promise.all` block and add two new queries:

```typescript
// Add to Promise.all:
const haccpQuery = supabase
  .from("haccp_log")
  .select("department_id, temperature, is_within_range, logged_at, ccp_reference")
  .eq("workspace_id", wsId)
  .gte("logged_at", todayStart)
  .order("logged_at", { ascending: false });

const cleaningQuery = supabase
  .from("session_task")
  .select(`
    id, status, completed_at,
    session_hook:session_hook_id(
      linked_procedure_id,
      procedure:linked_procedure_id(procedure_type)
    )
  `)
  .eq("workspace_id", wsId)
  .in("department_session_id", sessionIds)
  .not("session_hook_id", "is", null);
```

- [ ] **Step 4: Process the new query results**

After `Promise.all` resolves, add processing:

```typescript
// HACCP status
const haccpReadings = (haccpResult.data ?? []) as HaccpReading[];
const latestHaccp = haccpReadings[0];
let haccpStatus: "ok" | "deviation" | "stale" | "none" = "none";
let lastHaccpTime: string | null = null;

if (latestHaccp) {
  lastHaccpTime = latestHaccp.logged_at;
  const hoursSince = (Date.now() - new Date(latestHaccp.logged_at).getTime()) / 3600000;
  if (hoursSince > 2) {
    haccpStatus = "stale";
  } else if (haccpReadings.some((r) => !r.is_within_range)) {
    haccpStatus = "deviation";
  } else {
    haccpStatus = "ok";
  }
}

// Cleaning status
const cleaningTasks = (cleaningResult.data ?? []).filter(
  (t: any) => t.session_hook?.procedure?.procedure_type === "maintenance"
);
const cleaningDone = cleaningTasks.filter((t: any) => t.status === "completed").length;
const cleaningStatus: CleaningStatus = {
  done: cleaningDone,
  total: cleaningTasks.length,
};

// Deviation severity breakdown
const allDeviations = deviationResult.data ?? [];
const openDevs = allDeviations.filter((d: any) => d.status === "open" || d.status === "acknowledged");
const deviationBreakdown: DeviationBreakdown = {
  critical: openDevs.filter((d: any) => d.severity === "critical").length,
  high: openDevs.filter((d: any) => d.severity === "high").length,
  medium: openDevs.filter((d: any) => d.severity === "medium").length,
  low: openDevs.filter((d: any) => d.severity === "low").length,
  total: openDevs.length,
};
```

Add to the returned object: `haccpReadings, haccpStatus, lastHaccpTime, cleaningStatus, deviationBreakdown`.

- [ ] **Step 5: Update the deviation query to include severity**

Check the existing deviation query — ensure it selects `severity`. If it only selects `status`, add `severity` to the select string.

- [ ] **Step 6: Run typecheck**

```bash
pnpm --filter web typecheck
```

Expected: PASS. Some page.tsx errors expected (new fields not consumed yet).

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/app/dashboard/operations/_hooks/use-operations-data.ts
git commit -m "feat(operations): add HACCP and cleaning queries to operations data hook"
```

---

### Task 4: Add Temperature and Cleaning KPI Cards

**Files:**
- Modify: `apps/web/src/app/dashboard/operations/page.tsx`

- [ ] **Step 1: Read the full existing page**

Read `apps/web/src/app/dashboard/operations/page.tsx` to understand the KPI card rendering pattern. Note: existing cards use hardcoded strings like "Fullføring", "Stressnivå", etc.

- [ ] **Step 2: Add Thermometer and ClipboardCheck icons to imports**

```typescript
import { Percent, Gauge, Clock, Users, Activity, AlertCircle, Loader2, Thermometer, ClipboardCheck } from "lucide-react";
```

- [ ] **Step 3: Add Temperature KPI card after the 6th existing card**

Use the same card pattern as existing cards. Add after the "Aktive" (Active Tasks) card:

```typescript
{/* Temperature status */}
<div className={`rounded-xl border p-4 ${
  data.haccpStatus === "ok" ? "border-success/20 bg-success/5" :
  data.haccpStatus === "deviation" ? "border-destructive/20 bg-destructive/5" :
  data.haccpStatus === "stale" ? "border-warning/20 bg-warning/5" :
  "border-border bg-background"
}`}>
  <div className="flex items-center gap-2">
    <Thermometer className={`h-4 w-4 ${
      data.haccpStatus === "ok" ? "text-success" :
      data.haccpStatus === "deviation" ? "text-destructive" :
      "text-muted-foreground"
    }`} />
    <span className="text-muted-foreground text-xs font-medium">
      {t("operations.temperature")}
    </span>
  </div>
  <p className="mt-1 text-2xl font-bold font-heading">
    {data.haccpStatus === "none"
      ? "—"
      : data.haccpStatus === "ok"
        ? t("operations.temperatureOk")
        : t("operations.temperatureDeviation")}
  </p>
  {data.haccpStatus === "stale" && (
    <p className="text-warning text-xs mt-1">{t("operations.temperatureStale")}</p>
  )}
  {data.lastHaccpTime && (
    <p className="text-muted-foreground text-xs mt-0.5">
      {formatDistanceToNow(new Date(data.lastHaccpTime))}
    </p>
  )}
</div>
```

- [ ] **Step 4: Add Cleaning KPI card**

```typescript
{/* Cleaning checklist status */}
<div className={`rounded-xl border p-4 ${
  data.cleaningStatus.total === 0 ? "border-border bg-background" :
  data.cleaningStatus.done === data.cleaningStatus.total ? "border-success/20 bg-success/5" :
  "border-warning/20 bg-warning/5"
}`}>
  <div className="flex items-center gap-2">
    <ClipboardCheck className={`h-4 w-4 ${
      data.cleaningStatus.done === data.cleaningStatus.total && data.cleaningStatus.total > 0
        ? "text-success"
        : "text-muted-foreground"
    }`} />
    <span className="text-muted-foreground text-xs font-medium">
      {t("operations.cleaning")}
    </span>
  </div>
  <p className="mt-1 text-2xl font-bold font-heading">
    {data.cleaningStatus.total === 0
      ? "—"
      : t("operations.cleaningProgress", {
          done: data.cleaningStatus.done,
          total: data.cleaningStatus.total,
        })}
  </p>
  {data.cleaningStatus.total === 0 && (
    <p className="text-muted-foreground text-xs mt-1">{t("operations.cleaningNone")}</p>
  )}
</div>
```

- [ ] **Step 5: Adjust the grid to 4 columns for 8 cards**

Change the card grid from the existing layout to accommodate 8 cards:

```typescript
<div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
```

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/app/dashboard/operations/page.tsx
git commit -m "feat(operations): add temperature and cleaning KPI cards"
```

---

### Task 5: Fix i18n and Color Violations

**Files:**
- Modify: `apps/web/src/app/dashboard/operations/page.tsx`

- [ ] **Step 1: Replace all hardcoded Norwegian strings with i18n calls**

Search for all hardcoded strings in page.tsx and replace:
- `"Aktiv Pipeline"` → `t("operations.title")`
- `"LIVE"` → `t("operations.live")`
- `"Registrer avvik"` → `t("operations.reportDeviation")`
- `"Fullføring"` → `t("operations.taskCompletion")`
- `"Stressnivå"` → `t("operations.stressLevel")`
- `"Forfalt"` → `t("operations.overdue")`
- `"Kommende"` → `t("operations.upcoming")`
- `"Til stede"` → `t("operations.staffPresent")`
- `"Aktive"` → `t("operations.activeTasks")`
- `"Lav"` / `"Middels"` / `"Høy"` → `t("operations.stressLow")` etc.
- `"Avdelinger"` → `t("operations.departments")`

Add i18n hook import (check existing pattern in the codebase — likely `useTranslation` from `packages/i18n`).

- [ ] **Step 2: Replace hardcoded colors with CSS variables**

Replace Tailwind color classes with semantic tokens:
- `text-emerald-500` → `text-success`
- `bg-emerald-50` / `bg-emerald-500/10` → `bg-success/5` / `bg-success/10`
- `border-emerald-200` / `border-emerald-500/20` → `border-success/20`
- `text-orange-500` → `text-warning`
- `bg-orange-50` / `bg-orange-500/10` → `bg-warning/5` / `bg-warning/10`
- `border-orange-200` / `border-orange-500/20` → `border-warning/20`
- `text-red-500` → `text-destructive`
- `bg-red-50` / `bg-red-500/10` → `bg-destructive/5` / `bg-destructive/10`
- `text-zinc-900` → `text-foreground`
- `bg-zinc-800` → `bg-card`
- `text-zinc-500` → `text-muted-foreground`

Update the `stressColors()` and `completionColors()` helper functions to use CSS variables.

- [ ] **Step 3: Run typecheck and verify visually**

```bash
pnpm --filter web typecheck && pnpm --filter web dev
```

Navigate to `/dashboard/operations/`. Verify all text renders correctly (no raw i18n keys visible). Verify colors match in both light and dark mode.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/app/dashboard/operations/page.tsx
git commit -m "fix(operations): replace hardcoded Norwegian strings and colors with i18n and CSS variables"
```

---

### Task 6: Enhance Deviation Card with Severity Breakdown

**Files:**
- Modify: `apps/web/src/app/dashboard/operations/page.tsx`

- [ ] **Step 1: Find the existing deviation/open deviations card**

Search for `openDeviations` or `AlertCircle` in page.tsx.

- [ ] **Step 2: Replace simple count with severity breakdown**

Replace the single number with a breakdown:

```typescript
{/* Deviations with severity breakdown */}
<div className={`rounded-xl border p-4 ${
  data.deviationBreakdown.total > 0
    ? data.deviationBreakdown.critical > 0
      ? "border-destructive/20 bg-destructive/5"
      : "border-warning/20 bg-warning/5"
    : "border-border bg-background"
}`}>
  <div className="flex items-center gap-2">
    <AlertCircle className={`h-4 w-4 ${
      data.deviationBreakdown.critical > 0 ? "text-destructive" :
      data.deviationBreakdown.total > 0 ? "text-warning" :
      "text-muted-foreground"
    }`} />
    <span className="text-muted-foreground text-xs font-medium">
      {t("operations.deviations")}
    </span>
  </div>
  <p className="mt-1 text-2xl font-bold font-heading">{data.deviationBreakdown.total}</p>
  {data.deviationBreakdown.total > 0 && (
    <div className="mt-1 flex gap-2 text-xs">
      {data.deviationBreakdown.critical > 0 && (
        <span className="text-destructive">{data.deviationBreakdown.critical} {t("operations.deviationsCritical")}</span>
      )}
      {data.deviationBreakdown.high > 0 && (
        <span className="text-warning">{data.deviationBreakdown.high} {t("operations.deviationsHigh")}</span>
      )}
      {data.deviationBreakdown.medium > 0 && (
        <span className="text-muted-foreground">{data.deviationBreakdown.medium} {t("operations.deviationsMedium")}</span>
      )}
    </div>
  )}
</div>
```

- [ ] **Step 3: Run dev server and verify**

```bash
pnpm --filter web dev
```

Navigate to `/dashboard/operations/`. Create test deviations with different severities. Verify breakdown renders.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/app/dashboard/operations/page.tsx
git commit -m "feat(operations): add deviation severity breakdown to KPI card"
```

---

### Task 7: Final Verification

- [ ] **Step 1: Run full typecheck**

```bash
pnpm typecheck
```

Expected: 0 errors.

- [ ] **Step 2: Verify all 8 KPI cards render**

Start dev server, navigate to `/dashboard/operations/`:
1. Tasks (completion %) — existing, now with i18n
2. Stress Level — existing, now with i18n + CSS vars
3. Overdue — existing
4. Upcoming — existing
5. Staff Present — existing
6. Active — existing
7. Temperature — NEW, shows OK/Avvik/Stale/None
8. Cleaning — NEW, shows X/Y progress

- [ ] **Step 3: Verify dark mode**

Toggle dark mode. All cards should use CSS variable colors (no raw emerald/orange/zinc).

- [ ] **Step 4: Commit any remaining fixes**

```bash
git add -A && git commit -m "fix(operations): address driftsoversikt integration issues"
```
