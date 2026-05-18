---
title: "Day Line Area-Anchored Runtime + Core-Structure Clarification"
id: ADR_0367
status: accepted
version: 1.1
layer: decision
created: 2026-05-18
updated: 2026-05-18
---

# ADR-0367: Day Line Area-Anchored Runtime + Core-Structure Clarification

> **v1.1 (2026-05-18, post-council)** — Council Phase 5 verdict APPROVE WITH CHANGES (all 5 reviewers). 9 must-fix items consolidated from 39+ concerns folded in below. Chair self-reversal classification: REFINED (Pattern B audit-symmetry promoted from "recommended" to "mandatory"; tool-naming convention corrected; `day_line_status` enum dropped; `engine_event.idempotency_key` clarified). Status promoted from `proposed` → `accepted` on this amendment.

## Context and Problem Statement

Smartout's D6 Production surface today is anchored on a single `department_session` per `(workspace, department, date)`. That model assumes a department lives at a single physical place. In reality, departments (Bar-personell, Kjøkken, Service) staff multiple physical areas (bar, restaurant, event-floor), and a single area is often staffed by multiple departments at once. The Dagslinje surface — the communication and execution portal between manager and employee — needs an explicit "where on which day" anchor that is finer than department and coarser than zone or asset. Without this anchor, hooks, tasks, notes, bookings, and notifications cannot be filtered or routed correctly per location, and the day-summary aggregate cannot reconcile what actually happened where.

At the same time, the term "location" in the codebase is overloaded. The existing `public.location` table is already a flat list of physical areas (with a `location_type` enum that classifies content category, not hierarchy), and the existing `public.zone` and `public.asset` tables sit underneath it. There is no `department_location` junction today, so the orthogonal "which departments staff which areas" question has no representation. This ADR is therefore a paired decision: (1) clarify Smartout Core Structure naming and orthogonality, and (2) introduce a three-layer D6 runtime that turns Dagslinje into a load-bearing execution surface without parallel-tracking `department_session`.

## Decision Drivers

- Restaurant operations have N areas × M departments per day; the current 1×1 session model collapses this and forces lossy filtering.
- Dagslinje must serve as the canonical pre-day / active-day / post-day communication portal between manager and employee.
- `department_session` already owns payroll-relevant aggregate state (C1 reconciliation, signoff, lock) — must not be duplicated.
- Existing tables (`location`, `zone`, `asset`, `timeline_template`, `schedule_shift`, `expo_push_token`, `engine_event` idempotency, `shift-lifecycle` clock-in capability) carry the foundation; the work is to wire them, not rebuild.
- Mobile must remain read-only per ADR-0133; web owns authoring.
- Voice authoring on day-line entities stays chat-only per ADR-0078.
- ADR-0151 (server-resolved IDs), ADR-0204 (gatedMutation), ADR-0287 (gate_action mandatory) all apply unchanged.

## Considered Options

1. **Option A — Location-mandatory on `department_session`.** Add `location_id` directly to `department_session`. One session per `(workspace, department, location, date)`. Breaks payroll-FK and forces N-fold reconciliation rows per dept-day. Rejected: cross-cutting blast radius.

2. **Option B — `location_id` on every D6 child.** Add `location_id` to `session_hook`, `session_task`, `deviation`, etc. Leaves `department_session` unchanged. Acceptable for filter-only goals; insufficient for own-open-and-close band per area, own routine attachments, per-area notifications, and per-area summary. Rejected: no first-class object to hang policy and audit on.

3. **Option C — Tri-layer D6 model with `day_line` as area-anchored child of `department_session`, plus `shift_session` as per-employee runtime.** Adds two tables, no rewrites of existing ones beyond nullable FK additions on the children. Reuses existing `location`, `zone`, `asset`, `timeline_template`, `schedule_shift`, `expo_push_token`, `engine_event`. Department-only hooks (open/close routines that are not per-area) survive as `session_hook` rows with `day_line_id = NULL`.

## Decision Outcome

Chosen option: **Option C — Tri-layer D6 model with `day_line` + `shift_session` as new D6 tables, anchored on existing `location` (treated semantically as "area").** Selected because it composes onto the existing foundation, leaves payroll and C1 reconciliation untouched, and allows `department_session` to retain its role as the day-aggregate accounting layer while `day_line` becomes the program/execution layer and `shift_session` becomes the per-employee witness layer.

**Scope expansions explicitly accepted in this ADR** (called out per Council Phase 5 supervisor C8):

- `session_task.scheduled_at TIMESTAMPTZ` column added. Push pipeline (Rule 4) requires time-anchored items; the cleanest place is on the row that already exists. Alternative (separate `day_line_item_schedule` side-table) creates a join with no analytical benefit. The ALTER is in scope.
- `session_hook` UNIQUE constraint on `(workspace_id, department_id, hook_type)` added (Rule 1b). Schema enforcement of a template-invariant that was previously asserted only in prose.
- `engine_event.idempotency_key` reused (no new column). The composite `<task_id>:<shift_session_id>` string fits the existing TEXT + UNIQUE index column. No migration to `engine_event`.

The Core Structure axis is clarified as follows:

| Concept | Table | Role | Status |
|---|---|---|---|
| Workspace | `workspace` | Tenant boundary | exists |
| Property | (not modelled in V1) | Multi-site chain — future | deferred |
| Area | `location` (treated as area in V1) | Operational physical space — bar, restaurant, event-floor | exists (rename semantic only) |
| Zone | `zone` | Sub-area shift-assignment unit (bar 1, dish station) | exists, not surfaced in V1 |
| Asset | `asset` | Equipment (POS, fridge, oven) | exists, not surfaced in V1 |
| Department | `department` | Functional grouping of people (HVEM) | exists |
| Department↔Area | `department_location` (NEW) | M:N junction — which departments staff which areas | adds in this ADR |

`location` retains its name in schema; documentation refers to it as "area" in product context. The existing `location_type` enum (`main`, `outdoor`, `kitchen`, `event`, `storage`, `other`) is reinterpreted as area-category metadata, not hierarchy. Adding a property layer is deferred until a workspace exists with 2+ physical sites under one tenant.

### D6 tri-layer

```
department_session  [AGGREGATE — exists]
  └── day_line      [PROGRAM — NEW, area-anchored child]
        └── session_hook / session_task / schedule_day_booking / deviation
              (existing tables, gain day_line_id FK; NULL = department-level)

department_session
  └── shift_session [RUNTIME — NEW, per (employee, schedule_shift)]
        └── shift_session_day_line (M:N: shift can cover multiple areas)
```

`day_line` anchors on `location` (area) plus the parent `department_session`. `shift_session` anchors on `schedule_shift` and resolves the relevant `day_line` rows by joining on `(business_date, department_id, location_id)`. Push notifications are routed via `shift_session.push_topic` and gated by `engine_event` idempotency.

## Rules & Consequences

### Rule 1 — `day_line` is a child of `department_session`

Every `day_line` row carries `department_session_id NOT NULL` and `location_id NOT NULL`. `(department_session_id, location_id)` is UNIQUE. A department session may have zero day-lines (if the department operates without per-area distinction that day) or many (event-floor on event-day where Bar-dept and Kitchen-dept both run). Cascading lifecycle: when the department session closes via C1 reconciliation, all its day-lines lock simultaneously.

**No stored `day_line_status` enum** (revised post-council per ADR-0156 precedent — closes L-0064 phase-enum drift risk). Status is DERIVED at read time from `(parent department_session.status, daily_reconciliation.locked, day_line.cancelled_at)` via a helper. Storing status as its own column creates a dual-source-of-truth that drifts under concurrent writes. The helper lives in `apps/web/src/lib/cascade/derive-day-line-status.ts` (Phase B) and mirrors the existing `derivePhase()` pattern.

### Rule 1b — `session_hook` UNIQUE constraint (Phase A merge gate)

`session_hook` is template-shaped per `(workspace_id, department_id, hook_type)` per the lifecycle-fire semantics this ADR depends on. Today the schema does NOT enforce this invariant — two rows for the same triple are legal. Phase A migration MUST add:

```sql
ALTER TABLE public.session_hook
  ADD CONSTRAINT uq_session_hook_template
  UNIQUE (workspace_id, department_id, hook_type);
```

Migration order: AFTER any de-duplication backfill that collapses existing duplicates. If duplicates exist in any workspace, fail-fast with `RAISE NOTICE` per row before applying constraint.

### Rule 2 — `session_hook` stays a template (NOT extended with `day_line_id`)

**Amended 2026-05-18 after code-trace verification.** Earlier draft proposed adding `day_line_id` to `session_hook`. Code inspection of `supabase/migrations/20260412100300_session_infrastructure.sql:15-27` shows `session_hook` is a **template per `(workspace_id, department_id, hook_type)`** — it fires daily via lifecycle triggers and does NOT carry `department_session_id`. Binding a template row to a single `day_line` would freeze the template against one specific day, breaking its lifecycle-fire semantics.

Revised rule: `session_hook` does NOT receive `day_line_id`. The template fires as today; the **session_tasks created by the fire** (which already carry `department_session_id` per existing schema and gain `day_line_id` per ADR-0367) inherit area-anchoring at materialization time. The engine that fires hooks decides which day_lines to seed children onto based on the session's `department_id` joined to `department_location` (V1: all areas the dept staffs).

`session_hook` may gain an optional `location_id` (nullable FK) in a future ADR if "this hook fires only for sessions at a specific area" becomes a need. Not in V1.

### Rule 3 — `shift_session` is the employee-runtime layer

One `shift_session` per `schedule_shift` (UNIQUE on `schedule_shift_id`). Created at shift insert (status `scheduled`); transitions to `clocked_in` via `shift-lifecycle.clock_in` capability extension; ends `clocked_out` via `clock_out`. `shift_session_day_line` (M:N) populates at create time from matching `(business_date, department_id, location_id)`. Mobile day view reads `shift_session` and joins to `day_line` items.

### Rule 4 — Push routes through engine-dispatch gate (Option A — engine-side fan-out)

Engine-dispatch cron (existing infrastructure, 1-minute tick) selects `session_task` rows where `scheduled_at` is now-window AND `day_line_id IS NOT NULL`, joins active `shift_session_day_line` rows where `shift_session.status='clocked_in'`, fans out to `expo_push_token` per `employee_id`, and writes `engine_event` with `event_type='day_line_item.notified'` and `idempotency_key='<session_task.id>:<shift_session_id>'` (composite TEXT — matches existing `engine_event.idempotency_key TEXT` column with UNIQUE index per `supabase/migrations/20260304100000_engine_process_tables.sql:122`). No double-send guaranteed by the existing unique index.

Verified 2026-05-18 (Council Phase 5): `engine_event` schema is `(id, event_type, payload, workspace_id, idempotency_key, fired_at)`. No `entity_id` column. Spec uses `idempotency_key` column directly — no migration needed for the idempotency anchor.

**Option B (device-level topic subscribe API) DEFERRED.** Adding device-side subscribe/unsubscribe requires new ADR. V1 ships Option A: engine-side gate on `shift_session.status='clocked_in'` is the only filter.

### Rule 5 — Templates anchor at area (location)

Existing `timeline_template` with `scope_type='location'` and `scope_id=<location_id>` is the day_line template. A daily cron or first-shift-insert trigger instantiates a `day_line` from the matching template for each `(date, area)` in use. Templates remain pre-day artifacts; day_line rows are per-day frozen instances. Manager edits to a template do not back-propagate to past day-lines.

### Rule 6 — `department_location` M:N

New table `department_location (department_id, location_id)`. A department may staff multiple areas; an area may host multiple departments. UI scope filters and capability gates check membership: a manager of dept-X may only author day-lines for areas in `department_location` for dept-X. Owners and admins are unrestricted per workspace.

### Rule 7 — All mutations gate via `gate_action`

Three new capabilities introduced under capability namespace `day-line` (folder: `packages/ai/src/capabilities/day-line/`). **Tool names are BARE per verified codebase convention** (`task/tools.ts:110,279,361,530`, `schedule/tools.ts`, `shift-lifecycle/tools.ts`). Dot-prefix lives in event payload + capability registry key, NOT in tool `name:` field.

- tool `create` (capability `day-line`) — manager+, chat-only — capability event prefix `day_line.created`
- tool `add_item` (capability `day-line`) — manager+, chat-only (delegates to owning capability per `item_type` — see per-type dispatch table in spec §5.2)
- tool `instantiate_template` (capability `day-line`) — manager+, chat-only

Two adjacent capabilities (separate folders):
- `routine` namespace, tool `attach_to_line` — manager+, chat-only. Cross-namespace per ADR-0240: MUST delegate to `task.create_session` for each `session_task` child write — no direct `session_task.insert()` from `routine/tools.ts`.
- `org` namespace, tool `update_dept_areas` — admin+, chat-only. Writes `department_location` directly (own namespace).

Existing `task.create_session`, `task.complete`, `hms.report_deviation` extend to accept `day_line_id` as an optional, server-resolved param. **Pattern B (cascade audit-symmetry, ADR-0356) MANDATORY:** when `day_line_id` is set by a delegating capability, emit MUST include `actor_capability` + `delegated_via` fields per the pattern at `packages/telemetry/src/registry.ts:10273` (ADR-0356 cascade precedent). Pattern A (lenient forgeable `day_line_id` from any caller without audit fields) FORBIDDEN — reopens L-0177 silent-fallback class. ADR-0151 / ADR-0204 / ADR-0287 enforced unchanged.

### Rule 8 — Source-of-truth split

| Surface | Owner | Reads | Writes |
|---|---|---|---|
| `department_session` | C1 reconciliation + payroll | all | dept-session capabilities only |
| `day_line` | Day-Timeline manager UI | dept-aware reads | `timeline.*` capabilities |
| `shift_session` | shift-lifecycle | self + manager+ | `shift-lifecycle.*` |
| `day_line_item` derived | Dagslinje surface | shift_session-scoped | `task.*` + `timeline.*` |

Each surface owns its write-path; no cross-namespace direct DML (ADR-0173 / ADR-0240).

### Rule 9 — Mobile reads only

`shift_session` is the mobile read-side hook. Mobile day view fetches `shift_session` for the viewer + joins `day_line_item` per linked `day_line`. No mobile authoring on day_line / shift_session / items, per ADR-0133.

### Rule 10 — Push and telemetry events

New registry entries (BOTH `SmartoutEvent` union AND `EVENT_ROUTING` map per ADR-0358 / L-0193 recurrence trap). **All event names use dot-namespacing** (modern convention — all post-2026-04 capabilities use it: task.*, cascade.*, channel.*, botsson.*):

- `day_line.created`
- `day_line.opening_changed`
- `day_line.closing_changed`
- `day_line_item.added`
- `day_line_item.notified`
- `shift_session.bound` (auto-link to day_lines on shift insert — emitted by `shift_lifecycle.clock_in` capability tool first-touch, NOT by SQL trigger which cannot call `emit()`)
- `shift_session.clocked_in`
- `shift_session.clocked_out`
- `routine.attached`

All route to PostHog + Logger + `activity_trail` + `engine_event`.

`shift_session.bound` emit-site: the trigger function `ensure_shift_session()` cannot call `emit()` from PL/pgSQL. The emit fires from the `shift_lifecycle.clock_in` capability tool body when it first touches a `shift_session` row that was previously auto-inserted by the trigger. Same row, two events: `shift_session.bound` (auto-insert) + `shift_session.clocked_in` (lifecycle transition). Idempotency via `engine_event.idempotency_key='shift_session.bound:<shift_session_id>'`.

### Consequences

- **Good, because** existing `location`, `zone`, `asset`, `timeline_template`, `schedule_shift`, `expo_push_token`, `engine_event`, `shift-lifecycle` capability, and `department_session` lifecycle all carry their weight. The work compresses to two new tables, two junctions, and `day_line_id` FK additions.
- **Good, because** `department_session` aggregate untouched — payroll, C1 reconciliation, signoff continue as before.
- **Good, because** zone and asset surface land later without schema rework (they already exist; just bind them when V2 needs).
- **Good, because** push and mobile already have the runtime substrate.
- **Bad, because** UI now renders a stack of day_line strips per session — TimelineTab needs refactor and Nordic Split token audit per ADR-0366.
- **Bad, because** capability boundary on `routine.attach_to_line` is cross-namespace (writes session_task children) and needs explicit delegation per ADR-0240.
- **Bad, because** backfill of existing `department_session` rows requires a heuristic for which location to seed (default: department's first location alphabetically + admin override window before flip).
- **Agent Impact:**
  - `botsson-harness-builder` adds `timeline/` capability folder, mounts on stage-engine, registers on dagslinje page tool-bridge.
  - `system-agent-coordinator` updates intent classifier to include `day_line.create` / `day_line.add_item` enums.
  - `frontend-designer` refactors `TimelineTab` to multi-strip stack; adds `DayLineStripHeader`, `OpenCloseEditPopover`, `AttachRoutineDialog`.
  - Mobile (campaign/mobile) wires `shift_session` read + `shift-lifecycle.clock_in` extension + push topic subscribe.
  - `payroll-engine-developer` — no change. day_line does not enter the calc-engine path; `department_session` remains the C1 anchor.
  - `secrets-protocol` — no new credentials.

## Cross-References

- ADR-0078 — channel restrictions (chat-only authoring on V1)
- ADR-0099 — gate_action
- ADR-0114 — Server Actions
- ADR-0133 — mobile boundary (read-only)
- ADR-0151 — server-resolved IDs
- ADR-0156 — Day Control Panel canonical admin surface
- ADR-0173 — frozen capability boundaries
- ADR-0204 — gatedMutation
- ADR-0240 — cross-namespace delegation
- ADR-0287 — gate_action mandatory on mutation capability tools
- ADR-0297 — workforce snapshot bootstrap (extend slice to include day_line summary)
- ADR-0298 — task ontology (day_line_item joins the read RPC)
- ADR-0334 — ephemeral presence (precedent for shift_session subscribe topology)
- ADR-0335 — timeline templates (D5 source for day_line instantiation)
- ADR-0366 — Nordic Split OKLCH literal ban (applies to new UI surfaces)

## Open Items Tracked in Spec

- Backfill heuristic for existing `department_session` rows. **Council Phase 5 decision (steward C8):** use most-shifted `schedule_shift.location_id` per (date, dept) — NOT alphabetical. Alphabetical only as deterministic tiebreak when shifts tied. Fall back to first `location` row in workspace when no shifts exist on the date.
- Department↔location seeding strategy on new workspaces (I1 bootstrap extension)
- Zone surface (V2) — when shift assignment becomes zone-grained
- Asset surface (Phase 2) — when assets are attached to day_line_items
- `schedule_day_booking.location` is currently free-text TEXT (not FK) — backfill of `day_line_id` cannot auto-resolve via location; default to NULL with manager re-pin in admin UI
- BFF route decision: manager day-line authoring routes via `/api/botsson/chat` (manager dashboard Botsson surface), NOT `/api/emma/chat` (worker mobile). Stage-engine selects tools by capability key regardless of route — both work. Canonical for manager surface is botsson per ADR-0337 domain chat ownership.
- `useShiftSession` hook placement: `packages/data/` per ADR-0133 Mobile Parity rule. Web BotssonShell + mobile both consume.

## Cross-ADR Amendments Triggered by This ADR

- **ADR-0156 amend** — Day Control Panel canonical admin surface assumed "one strip per dept-day". Multi-strip stack per `day_line` now canonical. Amendment to ADR-0156 ships in same sortie as Phase C UI rewire.
- **ADR-0297 amend** — Workforce snapshot extends with `day_lines[]` + `my_shift_session{}` slice. Type definition + renderer at `services/stage-engine/src/core/agent-router.ts:174` + voice-agent `agent.updateChatCtx()` mirror (per L-0233 two-LLM-context trap). Both paths updated in lockstep. Amendment ships in Phase B.

## Council Phase 5 Verdict (2026-05-18)

**Verdict:** APPROVE WITH CHANGES (unanimous across all 5 reviewers: system-steward, supervisor, system-agent-coordinator, botsson-harness-builder, frontend code-reviewer).

**Chair self-reversal (L-0147 protocol, 10th precedent):** Phase 3 chair classified as REFINED, not REVERSED. Pattern B audit-symmetry promoted from "recommended" to "mandatory". Tool-naming convention corrected (bare names). `day_line_status` enum dropped (derive from parent per ADR-0156). `engine_event.idempotency_key` (not invented `entity_id`) used for push idempotency.

**9 must-fix items folded into this v1.1 amendment:**

1. ✅ Drop `day_line_status` enum — Rule 1 amended; derive helper Phase B
2. ✅ Bare tool names — Rule 7 amended; `day-line/` capability folder per `task/tools.ts` precedent
3. ✅ `session_hook` UNIQUE constraint — Rule 1b added; Phase A migration
4. ✅ `engine_event.idempotency_key` (existing column, no migration) — Rule 4 amended
5. ✅ `department_location` RLS + API-key path — spec §4.4 amended
6. ✅ Per-type dispatch table for `add_item` — spec §5.2 amended
7. ✅ ADR-0112 intent-enum same-commit gate — spec Phase B amended
8. ✅ `session_task.scheduled_at` carve-out — Decision Outcome amended (explicit scope expansion)
9. ✅ Pattern B audit-symmetry MANDATORY — Rule 7 amended

**Council learnings to log (Phase 8):** L-NEW-1 through L-NEW-6 — see `docs/learnings/`.

## Pre-Migration Code-Trace Findings (2026-05-18)

After post-draft review against the live schema (`supabase/migrations/`), six mechanical drift items and one conceptual item required spec amendment before Phase A can ship. All resolved in spec `docs/superpowers/specs/2026-05-18-dagslinje-area-anchored-design.md` v1.1:

| # | Item | Resolution |
|---|---|---|
| 1 | `schedule_shift` PK is `schedule_shift_id`, not `id` | Spec §4.2 + §5.4 FK refs corrected |
| 2 | `schedule_shift.employee_id` (not `profile_id`) holds the assignee | Trigger reads `NEW.employee_id` |
| 3 | `NEW.schedule_shift_id` (not `NEW.id`) | Trigger corrected |
| 4 | `schedule_shift.position_id`, `department_id`, `location_id` all nullable post-Cascade-A1 | Trigger guards with COALESCE + skip when location_id NULL (ad-hoc shifts) |
| 5 | `schedule_day_booking.location` is TEXT free-text (not FK) | Backfill leaves `day_line_id=NULL`; admin re-pins via UI |
| 6 (conceptual) | `session_hook` has no `department_session_id`; it is a template per `(workspace_id, department_id, hook_type)`, NOT per-session-instance | Rule 2 amended above; `day_line_id` NOT added to `session_hook` |
| 7 (helper) | `is_admin_or_manager_in_workspace()` does not exist; only `is_admin_in_workspace(uid, wid)` with `(uid, wid)` signature | Phase A adds new helper migration; existing function calls keep `(uid, wid)` order |
| 8 (naming) | `packages/ai/src/capabilities/timeline-template/` already exists | Capability folder renamed from `timeline/` → `day-line/` to avoid collision |

---

> Registered in `docs/decisions/0000-decision-log.md` 2026-05-18. Module documentation: `docs/modules/core-structure/`, `docs/modules/daytimeline/`. Spec: `docs/superpowers/specs/2026-05-18-dagslinje-area-anchored-design.md`.
