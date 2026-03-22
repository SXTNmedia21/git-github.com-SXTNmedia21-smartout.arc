---
title: "HMS Phase 2: Drift + Avvik — Design Spec"
status: draft
created: 2026-03-22
updated: 2026-03-22
module: hms
tags: [hms, drift, avvik, deviation, session, phase-2]
---

# HMS Phase 2: Drift + Avvik — Design Spec

## 1. System Role

Phase 2 completes the HMS operating fabric by adding the two remaining surfaces: Drift (D6 execution) and Avvik (exception path). Phase 1 built the routing shell, Oversikt (C1 calibration), Documents (K knowledge), Training (D2 readiness), and Procedure Detail (cross-branch control plane). Phase 2 makes HMS operational — employees execute tasks and report deviations, admins monitor sessions and manage exceptions.

### What exists already

| Layer                           | Status  | Location                                                                  |
| ------------------------------- | ------- | ------------------------------------------------------------------------- |
| `deviation` table               | Done    | `supabase/migrations/20260304200200_deviation_shift_approval.sql`         |
| `department_session` table      | Done    | 4 rows in DB (2 closed, 1 active, 1 upcoming)                             |
| `session_task` table            | Done    | Schema exists, 0 rows                                                     |
| `session_hook` table            | Done    | Schema exists, 0 rows                                                     |
| Mobile deviation form           | Partial | `apps/mobile/.../deviation.tsx` — step-by-step, local state only          |
| `useReportDeviation()`          | Done    | `apps/mobile/src/hooks/mutations/use-report-deviation.ts` — offline queue |
| Offline action map              | Done    | `apps/mobile/src/lib/sync/action-map.ts` — `report_deviation` handler     |
| Event Engine `create_deviation` | Done    | `supabase/functions/engine-dispatch/index.ts` line 650                    |
| Settlement auto-deviation       | Done    | `supabase/functions/validate-settlement/index.ts` line 139                |
| Push notification trigger       | Done    | `20260418120000_push_dispatch_triggers.sql` — notifies managers           |
| Reconciliation deviation UI     | Partial | Manager resolution in reconciliation flow                                 |

Phase 2 does NOT rebuild these. It builds the web surfaces that consume and extend them.

## 2. Migration

### 2.1 Add three-level linkage FKs to deviation

The spec requires deviations to link to source task, procedure, and protocol for full cross-branch traceability.

```sql
ALTER TABLE deviation ADD COLUMN source_task_id UUID REFERENCES session_task(id);
ALTER TABLE deviation ADD COLUMN procedure_id UUID REFERENCES procedure(procedure_id);
ALTER TABLE deviation ADD COLUMN protocol_id UUID REFERENCES protocol(protocol_id);

CREATE INDEX idx_deviation_source_task ON deviation(source_task_id) WHERE source_task_id IS NOT NULL;
CREATE INDEX idx_deviation_procedure ON deviation(procedure_id) WHERE procedure_id IS NOT NULL;

COMMENT ON COLUMN deviation.source_task_id IS 'D6: session_task where deviation was detected';
COMMENT ON COLUMN deviation.procedure_id IS 'K: which standard was violated';
COMMENT ON COLUMN deviation.protocol_id IS 'D3: which compliance domain it affects';
```

All three columns are nullable — standalone deviations (not from a task) and legacy data remain valid.

### 2.2 Seed data

Insert seed data for development:

- `session_hook` entries for the two departments (pre_open, scheduled, pre_close hooks)
- `session_task` entries for today's active session (5 tasks: 2 completed, 1 in-progress, 2 pending)
- `deviation` entries (3 deviations: 1 open critical, 1 assigned medium, 1 resolved)

Seed data goes in `supabase/seed/hms-phase-2.sql`, applied manually during development.

## 3. Package Boundary — Shared Deviation Contract

### Architecture rule

Shared business logic in `packages/`, not cross-imports between apps. Web and mobile each get their own write adapter calling the same contract.

```
packages/hms/src/deviations/
  schema.ts     → DeviationPayload Zod schema, domain/severity enums
  types.ts      → DeviationRow, DeviationCreate, DeviationUpdate types

apps/web/.../hms/_hooks/
  use-create-deviation.ts   → direct supabase.from("deviation").insert()

apps/mobile/.../hooks/mutations/
  use-report-deviation.ts   → offline queue (EXISTING, no changes)
```

### Payload schema (packages/hms)

```typescript
import { z } from "zod";

export const deviationDomainValues = ["haccp", "safety", "hr", "operational", "system"] as const;

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

## 4. Drift — D6 Execution Surface

### 4.1 Employee: Three context-driven layouts

The same task data renders in three different layouts depending on employee context.

| Context                  | Component        | Layout                                                       | When shown                                                    |
| ------------------------ | ---------------- | ------------------------------------------------------------ | ------------------------------------------------------------- |
| Inside active shift      | `DriftTimeline`  | Vertical timeline, "now" marker, tasks pinned to time        | `/dashboard/hms/drift` when viewing a specific active session |
| Day overview / pre-shift | `DriftTaskList`  | Scrollable list, color-coded left borders, inline completion | `/dashboard/hms/drift` default view (session overview)        |
| Dashboard home widget    | `DriftFocusCard` | Single card, current task, progress dots                     | Oversikt employee view — "next task" widget                   |

#### Task interaction contract

- Content shown: `description` only (NOT `training_content` — that belongs to Opplaering)
- Tap task to expand: compact description, evidence input fields, complete button, deviation flag
- Evidence input types: number input (temperature), photo button, checkbox, text note
- Complete: sets `session_task.status = 'completed'`, `completed_by`, `completed_at`, evidence jsonb
- Deviation flag: one-click opens deviation form pre-filled with task context

#### Color coding (left border / timeline dot)

| Color              | Meaning                       |
| ------------------ | ----------------------------- |
| Red (`#e94560`)    | Overdue — past due time       |
| Yellow (`#f39c12`) | Upcoming — within next hour   |
| Blue (`#3498db`)   | Later — more than 1 hour away |
| Green (`#27ae60`)  | Completed                     |

#### Data source

```
session_task
  WHERE department_session_id = <current session>
  AND (assigned_to = <current profile> OR assigned_to IS NULL)
  ORDER BY created_at ASC
```

Tasks without `assigned_to` are available to any employee in the department.

### 4.2 Admin: Session table

Table layout with date picker at top. One row per department for the selected date.

| Column    | Data                                                   |
| --------- | ------------------------------------------------------ |
| Avdeling  | Department name                                        |
| Status    | Badge: upcoming / active / pending_signoff / closed    |
| Oppgaver  | Progress bar + fraction (completed/total)              |
| Avvik     | Count of open deviations for this session              |
| Signering | Sign-off button (visible when pending_signoff) or dash |

Click row → drill-down into that session's task list (same `DriftTaskList` component but showing all tasks, not filtered to one employee).

Date picker: left/right arrows for day navigation. Default: today.

### 4.3 Session sign-off

Soft sign-off with warnings. Triggered when admin clicks "Signer" on a pending_signoff session.

**Sign-off drawer/modal shows:**

1. **Compliance task status** — list of `is_compliance_required` tasks with completion status
   - All completed → green checkmark
   - Incomplete → yellow warning with task names
2. **Open deviations** — list of unresolved deviations linked to this session
   - None → green checkmark
   - Open deviations → red warning with titles
3. **Sign-off type selection:**
   - "Ren signering" (clean) — available only when all green
   - "Signering med unntak" (with exceptions) — always available, requires notes
4. **Notes field** — mandatory for exception sign-off, optional for clean
5. **Submit** → updates `department_session.status = 'closed'`, `closed_at`, `closed_by`, `signoff_notes`

No hard blocking in Phase 2. Framework rule evaluation gates come in Phase 3.

## 5. Avvik — Exception Path Surface

### 5.1 Employee: Guided creation form

~5-6 fields, pre-filled when entering from Drift task context.

| Field              | Type                            | Required | Auto-fill from Drift                |
| ------------------ | ------------------------------- | -------- | ----------------------------------- |
| Tittel             | Text input                      | Yes      | —                                   |
| Kategori           | Dropdown (deviation_domain)     | Yes      | From task's linked procedure domain |
| Alvorlighet        | Dropdown (deviation_severity)   | Yes      | —                                   |
| Beskrivelse        | Textarea                        | No       | —                                   |
| Bilde              | Photo upload (Supabase Storage) | No       | —                                   |
| Relatert prosedyre | Searchable select               | No       | From task's procedure_id            |

**Two entry paths:**

1. **From Drift task** — "Avvik" button on task card. Pre-fills: `session_id`, `department_id`, `source_task_id`, `procedure_id`, `protocol_id` (from task's procedure chain), category.
2. **Standalone** — "Meld avvik" button on Avvik tab. Manual entry, no pre-fill except `workspace_id`.

**Write path:** `useCreateDeviation()` → validates with `DeviationPayloadSchema` from `@smartout/hms` → `supabase.from("deviation").insert()`. No offline queue on web.

**After submit:** Toast confirmation, deviation appears in Avvik admin kanban, push notification fires to managers (existing trigger).

### 5.2 Admin: Kanban + List toggle

**Kanban view (default):**

Four columns: Apen → Tildelt → Pagang → Lukket

Each card shows:

- Severity badge (color-coded)
- Title
- Department + domain tags
- Assignee avatar (if assigned)
- Age (relative time)

Click card → detail drawer.

**List view (toggle):**

Sortable table with status filter tabs at top. Columns: severity, title, department, domain, assignee, age. Same click → detail drawer.

**Domain filter bar** above both views: All, IK-mat, HMS, Drift.

**Detail drawer:**

- Full deviation info (all fields)
- Resolution form: notes textarea, resolved_by (auto-current user), resolve button
- Status change buttons: Assign (dropdown of profiles), Start (in progress), Resolve
- Linked task info (if `source_task_id` present)
- Linked procedure info (if `procedure_id` present)
- Photo attachments display

### 5.3 Deviation status transitions

```
open → assigned (admin assigns to profile)
open → in_progress (assignee starts work)
assigned → in_progress (assignee starts work)
in_progress → resolved (assignee or admin resolves with notes)
open → resolved (admin resolves directly)
```

Resolution requires `resolution_notes` (mandatory) and sets `resolved_by`, `resolved_at`.

## 6. Oversikt Integration

Phase 2 wires real data into existing Oversikt components:

- **Admin:** "Apne avvik" KPI card shows real count from `deviation` where `status != 'resolved'`
- **Employee:** `DriftFocusCard` widget below readiness ring showing next pending task (if active session exists)

## 7. Route Structure

No new routes needed — Drift and Avvik placeholders already exist from Phase 1.

| Route                       | Current     | Phase 2                                            |
| --------------------------- | ----------- | -------------------------------------------------- |
| `/dashboard/hms/drift`      | Placeholder | DriftTaskList (employee) / SessionTable (admin)    |
| `/dashboard/hms/deviations` | Placeholder | DeviationForm (employee) / DeviationKanban (admin) |

## 8. File Structure

### New files

| File                                                           | Responsibility                     |
| -------------------------------------------------------------- | ---------------------------------- |
| `supabase/migrations/YYYYMMDDHHMMSS_hms_deviation_linkage.sql` | Add 3 FKs to deviation             |
| `supabase/seed/hms-phase-2.sql`                                | Seed data for development          |
| `packages/hms/src/deviations/schema.ts`                        | Zod schema + domain/severity types |
| `packages/hms/src/deviations/types.ts`                         | Shared TypeScript types            |
| `apps/web/.../hms/_components/DriftTimeline.tsx`               | Employee timeline view             |
| `apps/web/.../hms/_components/DriftTaskList.tsx`               | Employee scrollable list           |
| `apps/web/.../hms/_components/DriftFocusCard.tsx`              | Employee home widget               |
| `apps/web/.../hms/_components/DriftSessionTable.tsx`           | Admin session table                |
| `apps/web/.../hms/_components/SessionSignoffDrawer.tsx`        | Sign-off flow                      |
| `apps/web/.../hms/_components/DeviationForm.tsx`               | Employee guided form               |
| `apps/web/.../hms/_components/DeviationKanban.tsx`             | Admin kanban view                  |
| `apps/web/.../hms/_components/DeviationList.tsx`               | Admin list view                    |
| `apps/web/.../hms/_components/DeviationDetailDrawer.tsx`       | Detail + resolution                |
| `apps/web/.../hms/_hooks/use-create-deviation.ts`              | Web direct insert                  |
| `apps/web/.../hms/_hooks/use-session-tasks.ts`                 | Fetch tasks for session            |
| `apps/web/.../hms/_hooks/use-department-sessions.ts`           | Fetch sessions for date            |
| `apps/web/.../hms/_hooks/use-deviations.ts`                    | Fetch deviations with filters      |
| `apps/web/.../hms/_hooks/use-update-deviation.ts`              | Status change + resolution         |
| `apps/web/.../hms/_hooks/use-complete-task.ts`                 | Mark task completed with evidence  |
| `apps/web/.../hms/_hooks/use-signoff-session.ts`               | Sign-off mutation                  |

### Modified files

| File                                                 | Change                                    |
| ---------------------------------------------------- | ----------------------------------------- |
| `apps/web/.../hms/drift/page.tsx`                    | Replace placeholder with real views       |
| `apps/web/.../hms/deviations/page.tsx`               | Replace placeholder with real views       |
| `apps/web/.../hms/page.tsx`                          | Wire DriftFocusCard into OversiktEmployee |
| `apps/web/.../hms/_components/OversiktDashboard.tsx` | Real deviation count                      |
| `apps/web/.../hms/_components/OversiktEmployee.tsx`  | Add DriftFocusCard widget                 |
| `packages/hms/src/index.ts`                          | Export deviation schema + types           |
| `packages/hms/package.json`                          | Add zod dependency                        |
| `packages/supabase/src/database.types.ts`            | Regenerate after migration                |

## 9. Out of Scope

| Feature                                            | Phase                                                              |
| -------------------------------------------------- | ------------------------------------------------------------------ |
| AI-assisted deviation form                         | Phase 4 (C2 Job 4)                                                 |
| Automatic rule-triggered deviations                | Phase 3 (D3 rule engine)                                           |
| Hard sign-off gates from framework_rule            | Phase 3                                                            |
| Drag-and-drop kanban                               | Future (click to change status is sufficient)                      |
| Recurring reminder/escalation for stale deviations | Phase 3                                                            |
| Photo upload to Supabase Storage                   | Phase 2 UI ready, actual upload deferred if Storage not configured |
| Deviation statistics/trends                        | Phase 3 (C1 calibration)                                           |
