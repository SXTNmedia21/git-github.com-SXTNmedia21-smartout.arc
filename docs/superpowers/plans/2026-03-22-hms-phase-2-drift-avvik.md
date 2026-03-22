---
title: "HMS Phase 2: Drift + Avvik — Implementation Plan"
status: draft
created: 2026-03-22
updated: 2026-03-22
module: hms
tags: [hms, drift, avvik, implementation, phase-2]
---

# HMS Phase 2: Drift + Avvik — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the Drift and Avvik placeholder tabs with operational surfaces — employees execute tasks and report deviations, admins monitor sessions and manage exceptions.

**Architecture:** Three employee Drift layouts by context (timeline, list, card stack) + admin session table + soft sign-off. Deviation contract shared in packages/hms, web direct insert, admin kanban + list toggle. All mutations emit telemetry.

**Tech Stack:** Next.js 16 (App Router), React 19, TypeScript strict, Tailwind v4 (CSS config), shadcn/ui (new-york), TanStack Query v5, Supabase PostgreSQL, `@smartout/telemetry` emit.

**Spec:** `docs/superpowers/specs/2026-03-22-hms-phase-2-drift-avvik-design.md`

**Branch:** `feat/hms-phase-1` (continues on same branch)

**Cascade placement:** Drift = D6 (Production). Avvik = D6 origin → C1 calibration → C4 resolution. Sign-off = D6 lifecycle. All mutations emit telemetry per CLAUDE.md rule: "No mutation without emit."

---

## File Structure

### New files

| File                                                           | Responsibility                                      |
| -------------------------------------------------------------- | --------------------------------------------------- |
| `supabase/migrations/YYYYMMDDHHMMSS_hms_deviation_linkage.sql` | Add 3 FKs to deviation                              |
| `supabase/seed/hms-phase-2.sql`                                | Seed data for dev (tasks, hooks, deviations)        |
| `packages/hms/src/deviations/schema.ts`                        | DeviationPayload Zod schema + domain/severity types |
| `packages/hms/src/deviations/types.ts`                         | Shared TS types for deviation rows                  |
| `apps/web/.../hms/_hooks/use-session-tasks.ts`                 | Fetch tasks for a session                           |
| `apps/web/.../hms/_hooks/use-department-sessions.ts`           | Fetch sessions for a date                           |
| `apps/web/.../hms/_hooks/use-complete-task.ts`                 | Mark task completed + emit                          |
| `apps/web/.../hms/_hooks/use-signoff-session.ts`               | Sign-off mutation + emit                            |
| `apps/web/.../hms/_hooks/use-create-deviation.ts`              | Direct insert + emit                                |
| `apps/web/.../hms/_hooks/use-deviations.ts`                    | Fetch deviations with filters                       |
| `apps/web/.../hms/_hooks/use-update-deviation.ts`              | Status change + resolution + emit                   |
| `apps/web/.../hms/_components/DriftTaskList.tsx`               | Employee scrollable list                            |
| `apps/web/.../hms/_components/DriftTimeline.tsx`               | Employee timeline view                              |
| `apps/web/.../hms/_components/DriftFocusCard.tsx`              | Employee home widget                                |
| `apps/web/.../hms/_components/DriftSessionTable.tsx`           | Admin session table                                 |
| `apps/web/.../hms/_components/TaskCard.tsx`                    | Shared task card (expand + evidence + complete)     |
| `apps/web/.../hms/_components/SessionSignoffDrawer.tsx`        | Sign-off flow in Sheet                              |
| `apps/web/.../hms/_components/DeviationForm.tsx`               | Employee guided form                                |
| `apps/web/.../hms/_components/DeviationKanban.tsx`             | Admin kanban view                                   |
| `apps/web/.../hms/_components/DeviationListView.tsx`           | Admin list view                                     |
| `apps/web/.../hms/_components/DeviationDetailDrawer.tsx`       | Detail + resolution in Sheet                        |

### Modified files

| File                                                 | Change                              |
| ---------------------------------------------------- | ----------------------------------- |
| `packages/hms/src/index.ts`                          | Export deviations schema + types    |
| `packages/hms/package.json`                          | Add zod dependency                  |
| `packages/supabase/src/database.types.ts`            | Regenerate after migration          |
| `apps/web/.../hms/drift/page.tsx`                    | Replace placeholder with real views |
| `apps/web/.../hms/deviations/page.tsx`               | Replace placeholder with real views |
| `apps/web/.../hms/_components/OversiktDashboard.tsx` | Real deviation count                |
| `apps/web/.../hms/_components/OversiktEmployee.tsx`  | Add DriftFocusCard widget           |

---

## Task 1: Migration + Seed Data

**Files:**

- Create: `supabase/migrations/YYYYMMDDHHMMSS_hms_deviation_linkage.sql`
- Create: `supabase/seed/hms-phase-2.sql`
- Modify: `packages/supabase/src/database.types.ts` (regenerate)

- [ ] **Step 1: Create migration file**

```sql
-- Add three-level linkage to deviation table
-- source_task_id: D6 session_task where deviation was detected
-- procedure_id: K procedure that was violated
-- protocol_id: D3 compliance domain affected

ALTER TABLE deviation ADD COLUMN source_task_id UUID REFERENCES session_task(id);
ALTER TABLE deviation ADD COLUMN procedure_id UUID REFERENCES procedure(procedure_id);
ALTER TABLE deviation ADD COLUMN protocol_id UUID REFERENCES protocol(protocol_id);

CREATE INDEX idx_deviation_source_task ON deviation(source_task_id) WHERE source_task_id IS NOT NULL;
CREATE INDEX idx_deviation_procedure ON deviation(procedure_id) WHERE procedure_id IS NOT NULL;

COMMENT ON COLUMN deviation.source_task_id IS 'D6: session_task where deviation was detected';
COMMENT ON COLUMN deviation.procedure_id IS 'K: which standard was violated';
COMMENT ON COLUMN deviation.protocol_id IS 'D3: which compliance domain it affects';
```

Check latest migration timestamp: `ls supabase/migrations/ | tail -1` and increment.

- [ ] **Step 2: Apply migration locally**

Run: `docker exec -i $(docker ps -q -f name=supabase_db) psql -U postgres < supabase/migrations/<filename>.sql`
Expected: `ALTER TABLE` x3, `CREATE INDEX` x2, `COMMENT` x3, no errors.

- [ ] **Step 3: Create seed data file**

Create `supabase/seed/hms-phase-2.sql`. Query the DB first for real IDs:

```sql
-- Get workspace_id, department_ids, profile_ids, procedure_ids for seed data
SELECT workspace_id FROM workspace LIMIT 1;
SELECT department_id, name FROM department LIMIT 5;
SELECT profile_id, display_name FROM profile LIMIT 5;
SELECT procedure_id, name FROM procedure LIMIT 5;
SELECT department_session_id, status FROM department_session WHERE session_date = CURRENT_DATE;
```

Then seed:

- 3 `session_hook` entries (pre_open, scheduled at 10:00, pre_close) for the first department
- 5 `session_task` entries for today's active session (2 completed, 1 in-progress, 2 pending). Set `is_compliance_required = true` on 2 of them.
- 3 `deviation` entries: 1 open critical (linked to a task), 1 acknowledged medium (assigned), 1 resolved low

- [ ] **Step 4: Apply seed data**

Run: `docker exec -i $(docker ps -q -f name=supabase_db) psql -U postgres < supabase/seed/hms-phase-2.sql`

- [ ] **Step 5: Regenerate types**

Run: `npx supabase gen types typescript --local > packages/supabase/src/database.types.ts`

- [ ] **Step 6: Verify new columns in types**

Run: `grep -A 2 'source_task_id' packages/supabase/src/database.types.ts`
Expected: `source_task_id: string | null` in deviation Row type.

- [ ] **Step 7: Commit**

```bash
git add supabase/migrations/<filename>.sql supabase/seed/hms-phase-2.sql packages/supabase/src/database.types.ts
git commit -m "feat(hms): add deviation linkage FKs + Phase 2 seed data

source_task_id, procedure_id, protocol_id on deviation table.
Seed: 3 hooks, 5 tasks, 3 deviations for development.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

## Task 2: Shared Deviation Contract in packages/hms

**Files:**

- Create: `packages/hms/src/deviations/schema.ts`
- Create: `packages/hms/src/deviations/types.ts`
- Modify: `packages/hms/src/index.ts`
- Modify: `packages/hms/package.json`

- [ ] **Step 1: Add zod to packages/hms**

Edit `packages/hms/package.json` — add `"zod": "^3.25.0"` to dependencies. Run `pnpm install` from root.

- [ ] **Step 2: Create schema.ts**

```typescript
// packages/hms/src/deviations/schema.ts
import { z } from "zod";

export const deviationDomainValues = [
  "safety",
  "customer",
  "procedure",
  "system",
  "material",
] as const;

export const deviationSeverityValues = ["low", "medium", "high", "critical"] as const;

export const DeviationPayloadSchema = z.object({
  title: z.string().min(1).max(500),
  domain: z.enum(deviationDomainValues),
  severity: z.enum(deviationSeverityValues),
  description: z.string().max(2000).optional(),
  workspace_id: z.string().uuid(),
  department_id: z.string().uuid().nullable().optional(),
  session_id: z.string().uuid().nullable().optional(),
  source_task_id: z.string().uuid().nullable().optional(),
  procedure_id: z.string().uuid().nullable().optional(),
  protocol_id: z.string().uuid().nullable().optional(),
  linked_shift_id: z.string().uuid().nullable().optional(),
  reported_by: z.string().uuid().nullable().optional(),
});

export type DeviationPayload = z.infer<typeof DeviationPayloadSchema>;
export type DeviationDomain = (typeof deviationDomainValues)[number];
export type DeviationSeverity = (typeof deviationSeverityValues)[number];
```

**Note:** Domain values must match the `deviation_domain` enum in DB: `safety | customer | procedure | system | material`. Severity must match `deviation_severity`: `low | medium | high | critical`. Check `database.types.ts` to confirm these match before writing.

- [ ] **Step 3: Create types.ts**

```typescript
// packages/hms/src/deviations/types.ts
import type { DeviationDomain, DeviationSeverity } from "./schema";

export type DeviationStatus = "open" | "acknowledged" | "resolved" | "escalated";

export type DeviationRow = {
  deviationId: string;
  workspaceId: string;
  departmentId: string | null;
  sessionId: string | null;
  sourceTaskId: string | null;
  procedureId: string | null;
  protocolId: string | null;
  domain: DeviationDomain;
  severity: DeviationSeverity;
  status: DeviationStatus;
  title: string;
  description: string | null;
  reportedBy: string | null;
  resolvedBy: string | null;
  resolvedAt: string | null;
  resolutionNotes: string | null;
  attachments: unknown;
  blocksDay: boolean;
  requiresAction: boolean;
  createdAt: string;
  updatedAt: string;
};
```

- [ ] **Step 4: Update barrel export**

```typescript
// packages/hms/src/index.ts
export {
  DeviationPayloadSchema,
  deviationDomainValues,
  deviationSeverityValues,
  type DeviationPayload,
  type DeviationDomain,
  type DeviationSeverity,
} from "./deviations/schema";
export { type DeviationRow, type DeviationStatus } from "./deviations/types";
```

- [ ] **Step 5: Verify typecheck**

Run: `pnpm install && npx tsc --noEmit` from `packages/hms/`.

- [ ] **Step 6: Commit**

```bash
git add packages/hms/
git commit -m "feat(hms): shared deviation contract — Zod schema + types

DeviationPayloadSchema validates web + mobile payloads.
Domain/severity enums match DB. One contract, two adapters.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

## Task 3: Drift Data Hooks

**Files:**

- Create: `apps/web/.../hms/_hooks/use-session-tasks.ts`
- Create: `apps/web/.../hms/_hooks/use-department-sessions.ts`
- Create: `apps/web/.../hms/_hooks/use-complete-task.ts`
- Create: `apps/web/.../hms/_hooks/use-signoff-session.ts`

- [ ] **Step 1: Create use-department-sessions hook**

Fetches all sessions for a given date, joining department name. Used by admin session table.

```typescript
// Pattern: useQuery with workspace_id + date filter
// Query: supabase.from("department_session")
//   .select("*, department:department_id(name)")
//   .eq("workspace_id", wsId)
//   .eq("session_date", date)
//   .order("department_id")
```

Return type: `{ sessionId, departmentName, status, sessionDate, tasksTotal, tasksCompleted, ... }[]`

- [ ] **Step 2: Create use-session-tasks hook**

Fetches tasks for a specific session. Used by employee views and admin drill-down.

```typescript
// Pattern: useQuery with department_session_id filter
// Query: supabase.from("session_task")
//   .select("*")
//   .eq("department_session_id", sessionId)
//   .order("created_at")
// Optional: filter by assigned_to for employee view
```

Return type: `SessionTask[]` with mapped camelCase fields.

- [ ] **Step 3: Create use-complete-task hook**

TanStack mutation that updates `session_task` status + evidence + emits telemetry.

```typescript
// useMutation pattern:
// mutationFn: supabase.from("session_task").update({
//   status: "completed", completed_by: profileId, completed_at: new Date().toISOString(),
//   evidence: payload.evidence
// }).eq("id", taskId)
//
// onSuccess: emit({ event: "session task_completed", entity: "session_task", ... })
// + invalidate ["hms", "session-tasks", sessionId]
```

**Critical:** Must call `emit()` from `@smartout/telemetry` in `onSuccess`. Entity type: `"session_task"`. Check `packages/telemetry/src/registry.ts` for the exact event shape of `"session task_completed"`.

- [ ] **Step 4: Create use-signoff-session hook**

TanStack mutation that closes a session with sign-off type + notes.

```typescript
// mutationFn: supabase.from("department_session").update({
//   status: "closed", closed_at: new Date().toISOString(), closed_by: profileId,
//   signoff_notes: notes
// }).eq("department_session_id", sessionId)
//
// onSuccess: emit({ event: "session closed", entity: "department_session", ... })
// + invalidate ["hms", "department-sessions"]
```

- [ ] **Step 5: Verify typecheck**

Run: `cd apps/web && npx tsc --noEmit 2>&1 | grep "hms/"`
Expected: 0 errors.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/app/dashboard/hms/_hooks/
git commit -m "feat(hms): Drift data hooks — sessions, tasks, complete, sign-off

All mutations emit telemetry. TanStack Query invalidation on success.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

## Task 4: Drift Employee Components

**Files:**

- Create: `apps/web/.../hms/_components/TaskCard.tsx`
- Create: `apps/web/.../hms/_components/DriftTaskList.tsx`
- Create: `apps/web/.../hms/_components/DriftTimeline.tsx`
- Create: `apps/web/.../hms/_components/DriftFocusCard.tsx`

- [ ] **Step 1: Create TaskCard — shared task card component**

Expandable card with evidence fields. Used by all three layouts.

Props: `task: SessionTask`, `onComplete: (evidence) => void`, `onFlagDeviation: () => void`, `compact?: boolean`

States: collapsed (title + due + status badge) and expanded (+ description + evidence inputs + buttons).

Evidence inputs: number input (for measured values), text note, photo button (placeholder), checkbox.

Color coding: left border color based on task status/time (red=overdue, yellow=upcoming, blue=later, green=completed).

Use CSS variable classes: `border-border`, `bg-card`, `text-foreground`, `text-muted-foreground`. For status colors, raw Tailwind is acceptable (red-500, yellow-500, etc).

- [ ] **Step 2: Create DriftTaskList — scrollable list view**

Employee day overview. Maps `useSessionTasks()` → sorted `TaskCard` list.

Sort: overdue first, then by created_at ascending. Completed tasks at bottom, dimmed.

Summary bar at bottom: "X/Y fullfort" + "Z forfalt" count.

Context: used as default Drift employee view and admin drill-down.

- [ ] **Step 3: Create DriftTimeline — vertical timeline view**

Employee in-shift view. Same data as DriftTaskList but rendered on a vertical timeline.

"Now" marker: red dot with current time label, positioned based on session planned_open/planned_close range.

Tasks pinned to timeline at their created_at position. Completed tasks above "now" are dimmed. Overdue tasks highlighted.

Use absolute positioning within a relative container. Calculate task position as percentage of session duration.

- [ ] **Step 4: Create DriftFocusCard — home widget**

Single-card view for Oversikt employee. Shows the one most urgent task.

Logic: from `useSessionTasks()`, find first non-completed task sorted by priority (overdue > upcoming > later).

Shows: task title, due time, priority badge, "Utfor" button. Progress dots below showing total task count.

If no active session or no tasks: show empty state "Ingen aktive oppgaver".

- [ ] **Step 5: Verify typecheck**

Run: `cd apps/web && npx tsc --noEmit 2>&1 | grep "hms/"`

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/app/dashboard/hms/_components/TaskCard.tsx apps/web/src/app/dashboard/hms/_components/DriftTaskList.tsx apps/web/src/app/dashboard/hms/_components/DriftTimeline.tsx apps/web/src/app/dashboard/hms/_components/DriftFocusCard.tsx
git commit -m "feat(hms): Drift employee views — TaskCard, TaskList, Timeline, FocusCard

Three context-driven layouts: list (overview), timeline (in-shift), focus card (home).
Shared TaskCard with evidence capture and deviation flagging.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

## Task 5: Drift Admin + Sign-off

**Files:**

- Create: `apps/web/.../hms/_components/DriftSessionTable.tsx`
- Create: `apps/web/.../hms/_components/SessionSignoffDrawer.tsx`
- Modify: `apps/web/.../hms/drift/page.tsx`

- [ ] **Step 1: Create DriftSessionTable — admin session table**

Date picker at top (left/right arrows, date display). Table with one row per department.

Columns: Avdeling, Status (badge), Oppgaver (progress bar + fraction), Avvik (count from `useDeviations` filtered by session_id), Signering (button when pending_signoff).

Click row → expand to show `DriftTaskList` for that session (admin sees all tasks, not filtered by profile).

Uses `useDepartmentSessions(date)` for data.

- [ ] **Step 2: Create SessionSignoffDrawer — Sheet-based sign-off flow**

Uses `Sheet` from `@/components/ui/sheet`.

Content:

1. Compliance task checklist: lists `is_compliance_required` tasks with checkmark or warning icon
2. Open deviations list: lists deviations where `session_id` matches and `status != 'resolved'`
3. Sign-off type: "Ren signering" (disabled if warnings) or "Signering med unntak"
4. Notes textarea (mandatory for exceptions)
5. Submit button → calls `useSignoffSession`

Show toast on success via `sonner`.

- [ ] **Step 3: Wire up Drift page**

Replace placeholder in `apps/web/src/app/dashboard/hms/drift/page.tsx`:

```typescript
"use client";
import { useContext } from "react";
import { DashboardContext } from "@/components/dashboard/DashboardShell";
import { DriftSessionTable } from "../_components/DriftSessionTable";
import { DriftTaskList } from "../_components/DriftTaskList";

export default function DriftPage() {
  const { isAdminMode } = useContext(DashboardContext);
  return isAdminMode ? <DriftSessionTable /> : <DriftTaskList />;
}
```

Employee sees task list for their current session. Admin sees session table.

For employee: auto-detect active session from `useDepartmentSessions(today)` where `status = 'active'` and employee's department matches.

- [ ] **Step 4: Verify typecheck**

Run: `cd apps/web && npx tsc --noEmit 2>&1 | grep "hms/"`

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/app/dashboard/hms/
git commit -m "feat(hms): Drift admin table + session sign-off drawer

Admin: session table with date picker, progress bars, sign-off action.
Soft sign-off: warnings for incomplete tasks + open deviations.
Exception sign-off requires mandatory notes.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

## Task 6: Avvik Data Hooks

**Files:**

- Create: `apps/web/.../hms/_hooks/use-create-deviation.ts`
- Create: `apps/web/.../hms/_hooks/use-deviations.ts`
- Create: `apps/web/.../hms/_hooks/use-update-deviation.ts`

- [ ] **Step 1: Create use-create-deviation hook**

TanStack mutation. Validates payload with `DeviationPayloadSchema` from `@smartout/hms`. Direct supabase insert.

```typescript
// Import DeviationPayloadSchema from "@smartout/hms"
// mutationFn: validate payload, then supabase.from("deviation").insert({
//   ...validated payload (snake_case mapping)
// })
// onSuccess: emit({ event: "deviation reported", entity: "deviation", ... })
//   + toast.success("Avvik meldt")
//   + invalidate ["hms", "deviations"]
```

**Telemetry:** `"deviation reported"` is NOT yet in the registry. Add it to `packages/telemetry/src/registry.ts` following the existing pattern. Entity: `"deviation"` — add to the SmartoutEntity union if missing. Check first: `grep "deviation" packages/telemetry/src/registry.ts`.

- [ ] **Step 2: Create use-deviations hook**

Fetches deviations with optional filters: status, domain, session_id.

```typescript
// useQuery with workspace_id + filters
// supabase.from("deviation")
//   .select("*, department:department_id(name), reporter:reported_by(display_name), resolver:resolved_by(display_name)")
//   .eq("workspace_id", wsId)
//   .order("created_at", { ascending: false })
// Apply optional filters: .eq("status", status), .eq("domain", domain), .eq("session_id", sid)
```

Return mapped camelCase `DeviationRow[]`.

- [ ] **Step 3: Create use-update-deviation hook**

TanStack mutation for status changes and resolution.

Two operations:

1. Status change: `supabase.from("deviation").update({ status }).eq("deviation_id", id)`
2. Resolution: `supabase.from("deviation").update({ status: "resolved", resolution_notes, resolved_by, resolved_at }).eq("deviation_id", id)`

```typescript
// onSuccess: emit({ event: "deviation resolved" or "deviation updated", entity: "deviation", ... })
//   + invalidate ["hms", "deviations"]
```

Add `"deviation resolved"` and `"deviation updated"` to telemetry registry if missing.

- [ ] **Step 4: Verify typecheck**

Run: `cd apps/web && npx tsc --noEmit 2>&1 | grep "hms/"`

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/app/dashboard/hms/_hooks/ packages/telemetry/
git commit -m "feat(hms): Avvik data hooks — create, list, update deviations

useCreateDeviation validates with shared DeviationPayloadSchema.
All mutations emit telemetry. Deviation events added to registry.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

## Task 7: Avvik Employee Form

**Files:**

- Create: `apps/web/.../hms/_components/DeviationForm.tsx`

- [ ] **Step 1: Create DeviationForm component**

Guided form with ~5-6 fields. Accepts optional `prefill` prop for Drift task context.

```typescript
type DeviationFormProps = {
  prefill?: {
    sessionId?: string;
    departmentId?: string;
    sourceTaskId?: string;
    procedureId?: string;
    protocolId?: string;
    domain?: DeviationDomain;
  };
  onSuccess?: () => void;
};
```

Fields:

1. `title` — text Input (required)
2. `domain` — Select dropdown with `deviationDomainValues` from `@smartout/hms` (required, pre-filled from context)
3. `severity` — Select dropdown with `deviationSeverityValues` (required)
4. `description` — Textarea (optional)
5. `photo` — Button placeholder with camera icon (UI only in Phase 2, actual upload deferred)
6. `procedureId` — Searchable select of workspace procedures (optional, pre-filled from context)

Uses `useCreateDeviation` mutation on submit. Shows loading state, success toast, calls `onSuccess`.

Use shadcn/ui components: `Input`, `Select`, `Textarea`, `Button`, `Label` from `@/components/ui/`.

- [ ] **Step 2: Verify typecheck**

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/app/dashboard/hms/_components/DeviationForm.tsx
git commit -m "feat(hms): Avvik employee form — guided deviation reporting

5-6 fields, pre-fill from Drift task context. Validates with shared schema.
Photo placeholder ready for Storage integration.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

## Task 8: Avvik Admin Components

**Files:**

- Create: `apps/web/.../hms/_components/DeviationKanban.tsx`
- Create: `apps/web/.../hms/_components/DeviationListView.tsx`
- Create: `apps/web/.../hms/_components/DeviationDetailDrawer.tsx`
- Modify: `apps/web/.../hms/deviations/page.tsx`

- [ ] **Step 1: Create DeviationKanban component**

Four columns: Apen (open), Tildelt (acknowledged), Pagang (escalated as proxy for in_progress), Lukket (resolved).

Map `deviation_status` enum to columns: `open` → Apen, `acknowledged` → Tildelt, `escalated` → Pagang, `resolved` → Lukket.

Each card: severity badge (color-coded), title, department + domain tags, assignee initials, relative time.

Click card → opens `DeviationDetailDrawer`.

Domain filter bar at top: All, Safety, Customer, Procedure, System, Material.

- [ ] **Step 2: Create DeviationListView component**

Sortable table with status filter tabs at top (Alle, Apen, Tildelt, Pagang, Lukket).

Columns: severity badge, title, department, domain, assignee, age.

Click row → opens `DeviationDetailDrawer`.

- [ ] **Step 3: Create DeviationDetailDrawer component**

Uses `Sheet` from `@/components/ui/sheet`.

Content:

- Header: title, severity badge, status badge, created date
- Section: description, department, domain, subcategory
- Section: linked task info (if source_task_id), linked procedure (if procedure_id)
- Section: attachments display (if any)
- Resolution form (admin): notes textarea + resolve button
- Status change buttons: Tildel (opens profile picker), Start, Lukk
- Uses `useUpdateDeviation` for all mutations

- [ ] **Step 4: Wire up Deviations page**

Replace placeholder in `apps/web/src/app/dashboard/hms/deviations/page.tsx`:

```typescript
"use client";
import { useContext, useState } from "react";
import { DashboardContext } from "@/components/dashboard/DashboardShell";
import { DeviationKanban } from "../_components/DeviationKanban";
import { DeviationListView } from "../_components/DeviationListView";
import { DeviationForm } from "../_components/DeviationForm";

export default function DeviationsPage() {
  const { isAdminMode } = useContext(DashboardContext);
  const [viewMode, setViewMode] = useState<"kanban" | "list">("kanban");

  if (!isAdminMode) return <DeviationForm />;

  return (
    <div>
      {/* Toggle + domain filter */}
      {viewMode === "kanban" ? <DeviationKanban /> : <DeviationListView />}
    </div>
  );
}
```

- [ ] **Step 5: Verify typecheck**

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/app/dashboard/hms/
git commit -m "feat(hms): Avvik admin — kanban + list toggle + detail drawer

Kanban: 4 columns (open/acknowledged/escalated/resolved).
List: sortable table with status tabs.
Detail drawer with resolution form.
Employee sees guided creation form.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

## Task 9: Oversikt Integration + Final Wiring

**Files:**

- Modify: `apps/web/.../hms/_components/OversiktDashboard.tsx`
- Modify: `apps/web/.../hms/_components/OversiktEmployee.tsx`
- Modify: `apps/web/.../hms/_components/TaskCard.tsx` (add deviation form trigger)

- [ ] **Step 1: Wire real deviation count into OversiktDashboard**

Replace the hardcoded `value={0}` on "Apne avvik" KPI card. Use `useDeviations` with status filter to get count of non-resolved deviations.

```typescript
const { protocols: deviations } = useDeviations({ status: ["open", "acknowledged", "escalated"] });
// Then in KPI card: value={deviations.length}
```

Adjust the variant: `deviations.length > 0 ? "warning" : "default"`.

- [ ] **Step 2: Add DriftFocusCard to OversiktEmployee**

Below the readiness ring and next-protocol card, add:

```typescript
import { DriftFocusCard } from "./DriftFocusCard";

// After the nextProtocol section:
<DriftFocusCard />
```

The FocusCard handles its own empty state when no active session exists.

- [ ] **Step 3: Add deviation flag to TaskCard**

In `TaskCard`, the "Avvik" button should open the `DeviationForm` in a Sheet/Dialog, pre-filled with task context:

```typescript
prefill={{
  sessionId: task.departmentSessionId,
  sourceTaskId: task.id,
  procedureId: task.linkedProcedureId, // if available from session_hook
  departmentId: task.departmentId, // from parent session
}}
```

- [ ] **Step 4: Verify typecheck**

Run: `cd apps/web && npx tsc --noEmit 2>&1 | grep "hms/"`

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/app/dashboard/hms/
git commit -m "feat(hms): wire Oversikt with real data + deviation flag on tasks

Admin: real open deviation count in KPI card.
Employee: DriftFocusCard widget on home.
TaskCard: deviation flag opens pre-filled form.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

## Task 10: Final Verification + Cleanup

- [ ] **Step 1: Full typecheck**

Run: `npx turbo typecheck`
Expected: 0 new errors (pre-existing `help_request` error is acceptable).

- [ ] **Step 2: Lint**

Run: `pnpm lint`

- [ ] **Step 3: Verify seed data renders**

Start dev server: `pnpm --filter web dev`
Navigate to `/dashboard/hms/drift` — admin should see session table with seeded data.
Toggle to employee mode — should see task list with 5 tasks.
Navigate to `/dashboard/hms/deviations` — admin should see kanban with 3 seeded deviations.
Toggle to employee mode — should see deviation form.

- [ ] **Step 4: Update WORKLOG**

Update `docs/worklogs/WORKLOG-hms-phase-1.md` with Phase 2 tasks completed.

- [ ] **Step 5: Commit cleanup**

```bash
git add -A
git commit -m "chore(hms): Phase 2 cleanup — typecheck, lint, worklog

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

## Summary

| Task | What                                                                | Estimated complexity |
| ---- | ------------------------------------------------------------------- | -------------------- |
| 1    | Migration: 3 FKs + seed data                                        | Small                |
| 2    | Shared deviation contract in packages/hms                           | Small                |
| 3    | Drift data hooks (sessions, tasks, complete, sign-off)              | Medium               |
| 4    | Drift employee components (TaskCard, TaskList, Timeline, FocusCard) | Large                |
| 5    | Drift admin table + session sign-off drawer                         | Medium               |
| 6    | Avvik data hooks (create, list, update + telemetry registry)        | Medium               |
| 7    | Avvik employee form                                                 | Medium               |
| 8    | Avvik admin kanban + list + detail drawer                           | Large                |
| 9    | Oversikt integration + deviation flag wiring                        | Small                |
| 10   | Verification + cleanup                                              | Small                |

**Total new files:** ~21
**Total modified files:** ~7
**Migrations:** 1 (deviation linkage)
**Telemetry events added:** ~3 (deviation reported, deviation resolved, deviation updated)
