---
title: Timeline Templates — Scoped Authoring + Save/Apply
status: draft
updated: 2026-05-16
created: 2026-05-16
module: web-day-control
tags: [d6, timeline-template, schedule, web-day-control, capability]
---

# Timeline Templates — Design Spec

## Goal

Extend the existing `Dagslinjen` (TimelineTab) inside `WebDayControl` so a manager/admin can:

1. **Filter** the day timeline by scope: team · department · location · single-shift
2. **Author** items by clicking empty time slots — picker offers 6 item kinds
3. **Save** the current canvas (scope + items) as a named template
4. **Apply** a saved template to any target date — items materialize as real D6 rows with `source='template:<id>'` provenance

No new route. No mode-switch. Filter is view-state; template authoring is a side panel + dialog flow.

## Non-goals (v1)

- No recurrence engine (no cron auto-apply)
- No cross-scope merging (single scope per template)
- No Botsson chip suggestions, framework_rule pre-check, cost preview, prior-session medians — these are separate features deferred per the 2026-05-16 council
- No mobile authoring UI — web composes (ADR-0133). Mobile reads via existing read paths.
- No edit-after-save for v1; templates are immutable. Save-as-new + archive original = canonical re-edit path.

## Success criteria

- TimelineTab renders scope-filtered events for all 4 scope types
- SaveTemplateDialog persists row to `timeline_template` + emits `timeline_template.saved`
- ApplyTemplateDialog instantiates items as D6 rows in single Postgres transaction; partial failure rolls back
- Free-form chips prompt per-chip materialization (task | note | skip)
- `session_hook_executor` cron does NOT collide with canvas inserts (canvas writes hooks, cron materializes tasks)
- Typecheck + 14 required CI checks green
- E2E Playwright: filter → save → apply round-trip green
- Journey + HANDOFF docs written at close-feature

## Council reference

This design is the re-scoped output of the 2026-05-16 council (REJECT-as-framed verdict on a wider "pre-day planning wizard"). Council blockers that **evaporated** in this reframe:

- L-0252 / ADR-0316 cross-cascade-role violation — N/A (D6-rooted, filter is view-state)
- Framework_rule evaluator dependency — N/A (no rule check in v1)
- Pre-shift cost-preview dependency — N/A (no cost chip in v1)
- New `draft` status on `department_session` — N/A (apply to future date reuses `upcoming` via existing `openSessionAction`)
- Hybrid commit across 5 tables — N/A (single transaction with per-kind inserts, no `is_locked` column needed)

Council blockers that **carry forward** as constraints:

- Cron-canvas write boundary (canvas writes `session_hook`, NEVER pre-creates `session_task` from hooks — cron materializes)
- `session_task` items in template insert with `session_hook_id=NULL` to distinguish from cron-materialized (supervisor finding)
- Server-derived `workspace_id` + `profile_id` per ADR-0151 (BFF derives, never body)
- All mutating tools via `mutateWithGate` per ADR-0204/0287 (L-0175, L-0176)
- Each tool docstring claim must match body (Tool Compliance Self-Check)
- Mobile parity: query hooks live in `packages/data/`, not `apps/web/`

## Architecture

```
WebDayControl (ADR-0156 D6 admin shell — unchanged)
  └─ TimelineTab (extended in-place)
       ├─ TimelineTopBar (NEW row)
       │    ├─ <ScopeFilterPill/>           extended scope types
       │    └─ <SavedTimelinesDropdown/>    NEW
       ├─ <DayTimelineStrip/>               existing — scope-filtered
       ├─ <SlotPicker/>                     NEW — replaces SlotQuickAddPopover
       │    items: shift · hook · task · note · deviation · free-form
       ├─ <EventDetailPanel/>               existing
       └─ <DayEventList/>                   existing (scope-filtered)

Dialogs (overlays, mount inside TimelineTab):
  <SaveTemplateDialog/>
  <ApplyTemplateDialog/>

Data hooks (packages/data/src/timeline-template/):
  useTimelineTemplates(workspaceId, scope) — list by scope
  useSaveTemplate()                        — save mutation
  useApplyTemplate()                       — apply mutation
  useArchiveTemplate()                     — archive mutation
  useDayTimelineEvents(dateISO, scope)     — EXTEND existing hook with scope param

BFF routes (apps/web/src/app/api/timeline-template/):
  POST   route.ts                — save (calls capability.save_template)
  GET    route.ts                — list by scope
  POST   apply/route.ts          — apply (calls capability.apply_template)
  PATCH  [id]/route.ts           — archive (calls capability.archive_template)

Capability (packages/ai/src/capabilities/timeline-template/):
  tools.ts:
    save_template     — INSERT timeline_template via mutateWithGate
    list_templates    — read-only, workspace-scoped SELECT
    apply_template    — transactional per-item INSERT via mutateWithGate
    archive_template  — UPDATE is_archived=true via mutateWithGate

Persistence:
  NEW table timeline_template (see Schema below)
  NEW migration: seed engine_authority_config rows (level='confirm')
  EXISTING tables reused on apply:
    schedule_shift, session_hook, session_task, session_note, deviation, department_session
```

## Cascade dimensions touched

- **D6 Production:** `session_hook`, `session_task`, `session_note`, `deviation`, `department_session` (consumed via existing `openSessionAction` for future-date materialization)
- **D2 Resource:** `schedule_shift` (read-only filter + write on apply)
- **D1 Envelope:** `team`, `department`, `location` (read-only filter sources)
- **NEW companion (workspace-scoped, no cascade-role):** `timeline_template`

No cross-cascade-role projection. Filter is presentation-layer; template is workspace-scoped storage of D6 authoring intent.

## Schema

### Table `timeline_template`

```sql
-- supabase/migrations/<ULID>_timeline_template.sql

CREATE TABLE timeline_template (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id    UUID NOT NULL REFERENCES workspace(workspace_id) ON DELETE CASCADE,
  name            TEXT NOT NULL CHECK (length(name) BETWEEN 1 AND 80),
  scope_type      TEXT NOT NULL CHECK (scope_type IN ('team','department','location','shift')),
  scope_id        UUID NOT NULL,
  items_json      JSONB NOT NULL,
  notes           TEXT,
  created_by      UUID NOT NULL REFERENCES profile(profile_id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  is_archived     BOOLEAN NOT NULL DEFAULT false
);

CREATE INDEX idx_timeline_template_workspace_scope
  ON timeline_template (workspace_id, scope_type, scope_id)
  WHERE NOT is_archived;

CREATE INDEX idx_timeline_template_workspace_active
  ON timeline_template (workspace_id)
  WHERE NOT is_archived;

CREATE UNIQUE INDEX uniq_timeline_template_name_per_scope
  ON timeline_template (workspace_id, scope_type, scope_id, lower(name))
  WHERE NOT is_archived;

CREATE TRIGGER set_timeline_template_updated_at
  BEFORE UPDATE ON timeline_template
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

ALTER TABLE timeline_template ENABLE ROW LEVEL SECURITY;

-- jwt SELECT — any workspace member
CREATE POLICY jwt_select_timeline_template ON timeline_template
  FOR SELECT TO authenticated
  USING (workspace_id IN (SELECT get_workspace_ids_for_user()));

-- jwt INSERT — manager/admin/owner only; created_by must equal auth.uid()
CREATE POLICY jwt_insert_timeline_template ON timeline_template
  FOR INSERT TO authenticated
  WITH CHECK (
    workspace_id IN (SELECT get_workspace_ids_for_user())
    AND is_admin_in_workspace(workspace_id)
    AND created_by = auth.uid()
  );

-- jwt UPDATE — creator OR workspace admin/owner
CREATE POLICY jwt_update_timeline_template ON timeline_template
  FOR UPDATE TO authenticated
  USING (
    workspace_id IN (SELECT get_workspace_ids_for_user())
    AND (created_by = auth.uid() OR is_admin_in_workspace(workspace_id))
  )
  WITH CHECK (workspace_id IN (SELECT get_workspace_ids_for_user()));

-- No DELETE policy; soft-delete via UPDATE is_archived only.
-- service_role bypass is implicit.
```

### Polymorphic `scope_id` validation

`scope_id` has no foreign key (polymorphic by `scope_type`). T2 capability tools MUST validate at insert + apply time:

```ts
async function validateScope(
  supabase: Client,
  workspaceId: string,
  scopeType: ScopeType,
  scopeId: string
): Promise<void> {
  const table = {
    team: "team",
    department: "department",
    location: "location",
    shift: "schedule_shift",
  }[scopeType];
  const idCol = { team: "team_id", department: "department_id",
                  location: "location_id", shift: "schedule_shift_id" }[scopeType];
  const { data, error } = await supabase
    .from(table)
    .select(idCol)
    .eq(idCol, scopeId)
    .eq("workspace_id", workspaceId)
    .single();
  if (error || !data) throw new Error(`Invalid scope_${scopeType}:${scopeId}`);
}
```

A nightly heartbeat (separate sortie, not v1) will scan and mark templates `is_archived=true` whose scope entity disappeared.

### `items_json` shape

```ts
// packages/types/src/timeline-template.ts

import { z } from "zod";

export const TimelineTemplateItemKind = z.enum([
  "schedule_shift",
  "session_hook",
  "session_task",
  "session_note",
  "deviation",
  "free_form",
]);

const ItemBase = z.object({
  kind: TimelineTemplateItemKind,
  time_hhmm: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  duration_min: z.number().int().positive().nullable(),
});

const SchedShiftPayload = z.object({
  role: z.string().min(1).max(40),
  position_id: z.string().uuid().nullable(),
  team_id: z.string().uuid().nullable(),
  location_id: z.string().uuid().nullable(),
  zone: z.string().max(40).nullable(),
  notes: z.string().max(280).nullable(),
});

const HookPayload = z.object({
  hook_type: z.enum(["pre_open","open","scheduled","pre_close","close"]),
  trigger_offset_min: z.number().int(),
  linked_procedure_id: z.string().uuid().nullable(),
  linked_routine_id: z.string().uuid().nullable(),
});

const TaskPayload = z.object({
  title: z.string().min(1).max(120),
  description: z.string().max(500).nullable(),
  is_compliance_required: z.boolean().default(false),
});

const NotePayload = z.object({
  content: z.string().min(1).max(500),
});

const DeviationPayload = z.object({
  title: z.string().min(1).max(120),
  category: z.string().max(40),
  description: z.string().max(500).nullable(),
});

const FreeFormPayload = z.object({
  label: z.string().min(1).max(80),
});

export const TimelineTemplateItem = z.discriminatedUnion("kind", [
  ItemBase.extend({ kind: z.literal("schedule_shift"), payload: SchedShiftPayload }),
  ItemBase.extend({ kind: z.literal("session_hook"),   payload: HookPayload }),
  ItemBase.extend({ kind: z.literal("session_task"),   payload: TaskPayload }),
  ItemBase.extend({ kind: z.literal("session_note"),   payload: NotePayload }),
  ItemBase.extend({ kind: z.literal("deviation"),      payload: DeviationPayload }),
  ItemBase.extend({ kind: z.literal("free_form"),      payload: FreeFormPayload }),
]);

export const TimelineTemplateItems = z.array(TimelineTemplateItem).min(1).max(200);

export type TimelineTemplateItemT = z.infer<typeof TimelineTemplateItem>;
```

### Filter matrix (scope → which kinds match)

| Scope | schedule_shift | session_hook | session_task | session_note | deviation |
|---|---|---|---|---|---|
| team | `team_id = $1` | via session.department_id ∩ team.department_id | via session.department_id ∩ team.department_id | via session.department_id ∩ team.department_id | via session.department_id |
| department | `department_id = $1` (added Cascade D1) | `session.department_id = $1` | `session.department_id = $1` | `session.department_id = $1` | `session.department_id = $1` |
| location | `location_id = $1` (Cascade D1 column on schedule_shift) | **not filterable — UI warns "location filter shows shifts only"** | not filterable | not filterable | not filterable |
| shift | `schedule_shift_id = $1` | items inside shift's `[start_time, end_time]` AND `session.department_id` matches shift | same | same | same |

UI for `location` scope must show explicit notice: "Lokasjonsfilter viser kun vakter — hooks/oppgaver/notater er ikke lokasjons-merket."

## Data flow

### Save flow

1. User on TimelineTab, scope filter active, items visible
2. Click "Lagre tidslinje" on `SavedTimelinesDropdown`
3. `SaveTemplateDialog` opens
   - Auto-detected: `scope_type` + `scope_id` from current `ScopeFilterPill` state
   - Input: `name` (text), `notes` (optional)
   - Preview: rendered current items list
4. POST `/api/timeline-template`
   - Body: `{ name, scope_type, scope_id, items_json, notes }`
   - Server derives `workspace_id` + `created_by` from session (ADR-0151)
5. BFF:
   - Validates body via `TimelineTemplateSaveSchema`
   - Calls `timeline_template.save_template` capability
6. Capability tool `save_template`:
   - `mutateWithGate({ p_action: "timeline_template.save", ... })`
   - Validates scope via `validateScope()`
   - INSERT row
   - `emit("timeline_template.saved", { template_id, scope_type, item_count })`
7. Returns `{ template_id }`
8. Dialog closes, dropdown refetches, toast "Lagret"

### Apply flow

1. User picks template from `SavedTimelinesDropdown` → "Bruk på [valgte dato]" button
2. `ApplyTemplateDialog` opens
   - Shows: target date (TimelineTab `dateISO`), item count, scope display
   - For each `free_form` item: per-item picker "Materialiser som [Oppgave|Notat|Hopp over]"
3. User confirms
4. POST `/api/timeline-template/apply`
   - Body: `{ template_id, target_date, freeform_mapping: { [item_index]: "task"|"note"|"skip" } }`
   - Server validates: `target_date >= today (Oslo TZ)` via `startOfOsloDay`
5. BFF calls `timeline_template.apply_template` capability
6. Capability tool `apply_template`:
   - `mutateWithGate({ p_action: "timeline_template.apply", ... })`
   - Resolves target `department_session`:
     - If `scope_type` involves department (team/department/shift) — find or create `department_session(status='upcoming')` for `(department_id, target_date)` via reused `openSessionAction` server path
     - If `scope_type='location'` and template has only `schedule_shift` items — no session needed
   - Wrap all per-item INSERTs in single `BEGIN/COMMIT`:
     - `schedule_shift`: INSERT row with date=target_date, time fields from payload
     - `session_hook`: INSERT row — cron `session_hook_executor` materializes `session_task` at fire time (no canvas pre-create)
     - `session_task`: INSERT row with `session_hook_id=NULL` to distinguish from cron-materialized (supervisor finding)
     - `session_note`: INSERT row
     - `deviation`: INSERT row
     - `free_form`:
       - mapping `task` → INSERT `session_task(title=label, session_hook_id=NULL)`
       - mapping `note` → INSERT `session_note(content=label)`
       - mapping `skip` → no write
   - On any error: rollback transaction, return failure summary
   - On success: `emit("timeline_template.applied", { template_id, target_date, materialized_count_by_kind, freeform_skipped })`
7. Per-row `emit()` for each materialized item via reused existing event ids (no new ids needed; `metadata.source: "template_apply"` carries provenance discrimination):
   - `schedule_shift` → `shift created`
   - `session_hook` → `session_hook created`
   - `session_task` → `session_task.created` (with `metadata.source="template_apply"`)
   - `session_note` → `comm.scheduled_note.created`
   - `deviation` → `deviation reported`
   Row-level template_id linkage is via `schedule_shift.source = 'template:<id>'` column + `metadata.template_id` available as Phase-2 enhancement if cross-row queries become hard.
8. Returns `{ materialized: {...}, errors: [] }`
9. Dialog closes, TimelineTab refetches via TanStack invalidate

### Archive flow

1. Dropdown context menu → "Arkiver"
2. PATCH `/api/timeline-template/[id]` body `{ is_archived: true }`
3. Capability `archive_template`:
   - `mutateWithGate({ p_action: "timeline_template.archive", ... })`
   - UPDATE row
   - `emit("timeline_template.archived", { template_id })`
4. Dropdown refetches

No hard delete in v1. "Vis arkiverte" toggle (separate sortie) can list archived for undo within 30d.

## Capability + telemetry

### Capability registration

```ts
// packages/ai/src/capabilities/timeline-template/index.ts

export const timelineTemplateCapability: CapabilityDefinition = {
  name: "timeline_template",
  description: "Save and apply scope-filtered TimelineTab templates",
  surfaces: ["chat"],            // ADR-0078 chat-only
  emitPrefix: "timeline_template",
  tools: [saveTemplate, listTemplates, applyTemplate, archiveTemplate],
};
```

### Per-tool compliance table

| Tool | gate_action (p_action) | gatedMutation | emit() | Verdict |
|---|---|---|---|---|
| `save_template` | `timeline_template.save` | `mutateWithGate` INSERT | `timeline_template.saved` | PASS |
| `list_templates` | — (read-only) | direct SELECT (workspace-scoped) | `timeline_template.listed` (debug-only) | PASS |
| `apply_template` | `timeline_template.apply` | `mutateWithGate` wrapping txn | `timeline_template.applied` + per-row existing event ids | PASS |
| `archive_template` | `timeline_template.archive` | `mutateWithGate` UPDATE | `timeline_template.archived` | PASS |

### Authority seed

```sql
-- supabase/migrations/<ULID+1>_seed_timeline_template_authority.sql
INSERT INTO engine_authority_config (workspace_id, capability, level, updated_by)
SELECT workspace_id, 'timeline_template', 'confirm', NULL FROM workspace
ON CONFLICT (workspace_id, capability) DO NOTHING;
```

Per ADR-0189: authority-seed-parity CI script (`scripts/authority-seed-parity.ts`) must list `timeline_template` after this lands.

### Telemetry registry additions

```ts
// packages/telemetry/src/registry.ts — 5 new events
"timeline_template.saved":         { destinations: ["posthog","logger","activity_trail","engine_event"] },
"timeline_template.applied":       { destinations: ["posthog","logger","activity_trail","engine_event"] },
"timeline_template.archived":      { destinations: ["posthog","logger","activity_trail","engine_event"] },
"timeline_template.apply_failed":  { destinations: ["posthog","logger","activity_trail"] },
"timeline_template.listed":        { destinations: ["logger"] },  // debug-only
```

Existing event ids reused on apply (verified present in registry; no new ids):

- `schedule_shift` → `shift created`
- `session_hook` → `session_hook created`
- `session_task` → `session_task.created` (provenance via `metadata.source="template_apply"`)
- `session_note` → `comm.scheduled_note.created`
- `deviation` → `deviation reported`

Rationale: each adapted event already routes to activity_trail + engine_event where appropriate; inserting 5 new event ids for cosmetic parity was registry bloat. Provenance discrimination is captured via `metadata.source` field and (where present) the `source` column on the row itself (`schedule_shift.source = 'template:<id>'`). T6 audit verified this design 2026-05-16.

## Error handling + edge cases

| Case | Behavior |
|---|---|
| `target_date` in past | BFF rejects 400; ApplyTemplateDialog disabled when `dateISO <= today` |
| Scope entity deleted between save and apply | `validateScope()` throws; BFF returns 409; dialog suggests archive template |
| Apply finds existing `session_task` with same title at same time | Insert proceeds; duplicate is acceptable (no UNIQUE constraint); operator can clean post-apply. Future enhancement: dedup on apply via heuristic match |
| Cron `session_hook_executor` runs between apply commit and dialog refetch | Safe — cron only materializes from `session_hook` rows; canvas-inserted `session_task` rows are not visible to cron's idempotency key |
| Free-form mapping `skip` for ALL items | Apply proceeds; no writes for free-form items; emit `applied` with `materialized_count=0` for free-form |
| Apply partially fails mid-transaction | Postgres rolls back; BFF returns `{ materialized: {}, errors: [...] }`; UI shows error toast with retry option |
| Template name collision | UNIQUE index rejects; BFF returns 409 "Navn finnes allerede"; dialog highlights name input |
| User loses workspace admin role between save and apply | `mutateWithGate` rejects on apply via `is_admin_in_workspace` check |
| Location scope template tries to apply non-shift items | Schema prevents — Save validates: if `scope_type='location'`, items_json may only contain `kind='schedule_shift'`. Hard rejection at BFF Zod step |

## Mobile parity

Per ADR-0133 mobile boundary: **authoring is web-only.** Mobile does NOT get save/apply UI. Mobile reads materialized rows via existing read paths (e.g. `(me)` tab sees their shifts/tasks for the date).

Data hooks in `packages/data/` (NOT `apps/web/`) per CLAUDE.md mobile-parity rule:

```
packages/data/src/timeline-template/
  use-timeline-templates.ts
  use-save-template.ts
  use-apply-template.ts
  use-archive-template.ts
```

## Out of scope / deferred

- Recurrence engine (auto-apply on cron)
- Template editing (save-as-new + archive original is canonical re-edit for v1)
- Template versioning / history
- Cross-scope merging
- Bulk apply (apply same template to N dates in one click)
- Template marketplace / share-across-workspace
- "Vis arkiverte" toggle + undo flow
- Botsson chip suggestions on the canvas
- Framework_rule pre-check on apply
- Cost preview chip

Each = separate sortie if needed.

## Phasing

| Phase | Scope | Tracks |
|---|---|---|
| **Phase 1 (this sortie)** | All 6 item kinds, save+apply+archive, 4 scope types, free-form per-chip materialization | T0–T8 |
| Phase 2 | "Vis arkiverte" + undo, bulk apply, template duplication | future |
| Phase 3 | Recurrence (cron auto-apply on weekday match) | requires recurrence engine ADR first |

## ADRs required

- **ADR-0334** (this sortie) — Timeline Templates: D6 authoring + filter+save+apply pattern
- Reserve next slot after grep of `git log --all`. T0 confirms 0333 is highest; reserve 0334 in initial commit.

## Risks register

| Risk | Severity | Owner |
|---|---|---|
| Polymorphic `scope_id` orphans on entity delete | MEDIUM | T1 app-side validate; future heartbeat to mark archived |
| Cron collision via duplicate `session_task` from apply | LOW | T2 inserts session_task with `session_hook_id=NULL` to discriminate |
| Authority-seed-parity CI failure | LOW | T2 follows ADR-0189 pattern verbatim |
| RLS helper `is_admin_in_workspace` signature mismatch | LOW | T1 greps existing usage |
| Apply transaction timeout on >100 items | LOW | Spec caps `items_json` array at 200; transaction wraps inserts |
| Free-form per-chip UX cumbersome at >10 chips | LOW-MED | T5 implements "set all to task" shortcut |
| Mobile reads stale data immediately after apply | LOW | TanStack invalidate on apply success |

## Open questions resolved at spec time

- ✅ 6 item kinds (down from 8 initial proposal): no `booking` (no table), no `shift_start` (= `schedule_shift`), `daily_note` → `session_note`
- ✅ Location filter narrows to shifts only — UI must warn
- ✅ No new `is_locked` column needed
- ✅ No new `draft` status on `department_session` — reuse `upcoming`
- ✅ Hooks: canvas inserts row; cron materializes tasks downstream
- ✅ Free-form per-chip materialization at apply time
- ✅ Soft-delete via `is_archived`, no hard DELETE policy
