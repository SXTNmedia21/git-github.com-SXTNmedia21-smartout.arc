---
title: Day Timeline — Gaps & Debt
status: in_progress
updated: 2026-05-17
created: 2026-05-17
module: daytimeline
tags: [module, daytimeline, gaps, debt, audit]
---

# Day Timeline — Gaps & Debt

> Verified-working vs aspirational. Code citations for every gap. Read with [BLUEPRINT.md](./BLUEPRINT.md) which sequences the fixes.

## 1. Verification Method

For each claim below:
- **CODE** = grepped, line numbers cited.
- **JOURNEY** = roadmap journey describes the target.
- **GAP** = the delta between CODE and JOURNEY.

## 2. Working Code (Shipped)

| # | Capability | Evidence |
|---|---|---|
| W1 | Department-anchored session per day | `supabase/migrations/20260304200000_department_session.sql:22-52`, UNIQUE `uq_dept_session_date` |
| W2 | 15-min slot hit-zones on editable strip | `apps/web/src/components/day/DayTimelineStrip.tsx:517-546` (editable mode buttons) |
| W3 | Slot picker 3 lanes (Produksjon/Bemanning/Fri Tekst) | `apps/web/src/components/day/SlotPicker.tsx:64-116` (D6_ITEMS, D2_ITEMS, FREE_ITEMS) |
| W4 | Popover anchors at click coordinate | shipped 2026-05-17 — `DayTimelineStrip.tsx:527-529` emits rect, `TimelineTab.tsx` renders fixed-position anchor, `SlotPicker` uses `PopoverAnchor` |
| W5 | Scope filter (dept / team / location / shift) | `apps/web/src/components/day/ScopeFilterPopover.tsx:78-97` (Lokasjon tab fetches `location` table) |
| W6 | URL persistence of scope | `apps/web/src/app/dashboard/_hooks/use-day-timeline-scope.ts` |
| W7 | Phase-tint bands (prep/service/windDown) | `TimelineTab.tsx:86-93` uses `getPhaseBoundaries` from `@smartout/utils` |
| W8 | Session_task ad-hoc creation via dialog | `AddTaskDialog.tsx` + `addTaskAction` → `task.create_session` capability (per ADR-0298) |
| W9 | Deviation report + escalate gated via `gate_action` | pre-m5-mutation-closure sortie (commit `9ef0fbb60`) closed L-0066 |
| W10 | Mobile day route reads shifts + bookings + notes | `apps/mobile/app/(app)/(calendar)/day/[date].tsx` (read-only per ADR-0133) |
| W11 | Timeline templates save + apply | ADR-0335 — `timeline_template` table, 6 item kinds |
| W12 | Workforce snapshot bootstrap (D2+D6 facts at session start) | ADR-0297 — voice + chat both receive workforce slice |
| W13 | Telemetry registry for session_task / session_hook / deviation / day_info | `packages/telemetry/src/registry.ts` lines noted in DATA-MODEL |
| W14 | RLS on every D6 surface table | confirmed in `20260412100300_session_infrastructure.sql:84-104` |
| W15 | Server Actions for mutations (no direct browser writes) | M5 Sortie 1 closed ADR-0114 gaps for HMS hooks |

## 3. Known Gaps

### 3.1 SCHEMA — Location not mandatory on D6 children

**CODE:**
- `session_hook` table has `department_id` but NO `location_id` — `20260412100300_session_infrastructure.sql:15-25`
- `session_task` table has `department_session_id` but NO `location_id` — same file line 67-83
- `deviation`, `schedule_day_task`, `schedule_day_booking`, `schedule_day_info` — also no `location_id`

**JOURNEY:** J7-J12 all require mandatory `location_id` + `(department_id XOR team_id)` on `day_line` and on every child.

**GAP:** Schema delta in DATA-MODEL §5 not yet applied. No `day_line` table exists. Migration + backfill required. Council-class — no merge without ADR.

**Status:** Blocker for J7-J12. **Severity HIGH.**

### 3.2 UI — Hooks/oppgaver/notater not location-aware

**CODE:**
- `apps/web/src/components/day/tabs/TimelineTab.tsx:238-249` — explicit warning banner: "Lokasjonsfilter viser kun vakter — hooks/oppgaver/notater er ikke lokasjons-merket."

**JOURNEY:** J11 (employee-views-own-location) — RLS must filter all event types by location.

**GAP:** Warning banner exists *because* this is unimplemented. Filter is best-effort, returns only shift markers when location scope active.

**Status:** Blocker for J11. **Severity HIGH.**

### 3.3 UI — One open/close band per dept, regardless of location

**CODE:**
- `TimelineTab.tsx:265-267` — strip uses `session.plannedOpen / plannedClose` (single per dept).
- `DayTimelineStrip.tsx` axis built from these two values.

**JOURNEY:** J8 (manager-edit-opening-closing) — each `(location, dept|team)` line has its own open/close.

**GAP:** No per-location band today. Multi-location dept = single band, multi-location employee strip = collision.

**Status:** Blocker for J8. **Severity HIGH.**

### 3.4 CAPABILITY — `routine.attach_to_line` does not exist

**CODE:**
- `packages/ai/src/capabilities/` — no `routine/` folder. No `attach_to_line` tool.
- Today, "routine" is materialized via `timeline_template` apply (J6) — but that is a per-day flatten, not a runtime hook attachment.

**JOURNEY:** J10 (manager-attach-routine) — pick template → insert session_hook parent + N session_task children in one transaction.

**GAP:** Capability missing. New folder + index + tools + gate seed required. SlotPicker has no "Rutine" lane entry today (only "Hook" generic).

**Status:** Blocker for J10. **Severity MEDIUM.** (J9 works without it via single-task path.)

### 3.5 CAPABILITY — `timeline.create_day_line` + `timeline.edit_opening_closing` do not exist

**CODE:** No `timeline/` capability folder. Server Action `createDayLineAction` not present in `apps/web/src/app/dashboard/_actions/`.

**JOURNEY:** J7, J8.

**GAP:** Capability missing. ADR + seed migration + tool body required.

**Status:** Blocker for J7 + J8. **Severity HIGH.**

### 3.6 ADD-TASK-DIALOG — single tab only, no routine branch

**CODE:**
- `AddTaskDialog.tsx:60-78` — single-form dialog. No tab switcher. "Hook" picker is just a dropdown to attach to existing hooks.

**JOURNEY:** J9 — dialog gains "Enkeltoppgave | Rutine" tabs. Routine tab opens `AttachRoutineDialog`.

**GAP:** UI refactor + new dialog component required.

**Status:** Blocker for J10 entry path. **Severity LOW** (dialog separation alone — can ship with two parallel dialogs from SlotPicker instead of one tabbed dialog).

### 3.7 RLS — `day_line` policy does not exist

**JOURNEY:** J11 needs `day_line_employee_read` RLS that filters by viewer's shifts at the line's `(location_id, dept|team_id)`.

**GAP:** Table doesn't exist yet → policy doesn't exist. Defensive client-side filter recommended per J11 verification list (per ADR-0287 defense-in-depth).

**Status:** Blocks J11. **Severity HIGH.**

### 3.8 MOBILE — Multi-line stack not designed

**CODE:** `apps/mobile/app/(app)/(calendar)/day/[date].tsx` — single timeline 08:00-24:00 with absolute-positioned items. No stack support.

**JOURNEY:** J11 — employee at 2 locations sees 2 stacked strips.

**GAP:** UI redesign. FlashList virtualization recommended. Mobile parity work required (ADR-0133 — mobile remains read-only, no authoring).

**Status:** Blocks J11 multi-location subset. **Severity MEDIUM** — single-location employees unaffected.

### 3.9 TELEMETRY — Events for day_line + routine missing

**CODE:** Registry has no `"day_line *"` or `"routine *"` events.

**JOURNEY:** J7-J10 emit `day_line created`, `day_line opening_changed`, `day_line closing_changed`, `routine attached`.

**GAP:** Registry additions. Pattern reminder: add to BOTH `SmartoutEvent` union AND `EVENT_ROUTING` map (registry-recurrence trap).

**Status:** Required before tools ship. **Severity MEDIUM.**

### 3.10 CASCADE — Day-line dimension classification unresolved

**CODE:** No ADR exists for `day_line` cascade placement. Cascade A1 (`20260421100350`) added `location_id` to `schedule_shift` but did NOT touch `session_*` tables.

**JOURNEY:** J7-J10 all need `day_line` placed canonically.

**GAP:** Council-class decision. Three options in review (A: location_id on department_session; B: location_id on session children; C: new day_line table). Default proposal in this module = C.

**Status:** Blocks the entire location-awareness phase. **Severity CRITICAL — council gate.**

### 3.11 BACKFILL — Existing department_session rows have no location

**CODE:** `department_session` has no `location_id` column. Departments may have N locations in `department_operating_hours` history.

**JOURNEY:** J7 + migration.

**GAP:** Backfill strategy required. Default-proposed: pick first location alphabetically, allow admin override before migration flip.

**Status:** Required step in BLUEPRINT phase migration. **Severity MEDIUM** (mechanical, but irreversible without rollback plan).

### 3.12 TIMELINE TEMPLATES — No `day_line` scope

**CODE:** `timeline_template.scope_type` enum = `team | department | location | shift` (ADR-0335).

**JOURNEY:** J10 — template resolved at apply-time onto a day_line.

**GAP:** No schema change needed — templates remain pre-day artifacts. Apply path needs day_line_id resolution at apply-time. Verify in J10 implementation.

**Status:** **LOW** (apply path glue, no migration).

### 3.13 E2E COVERAGE — Location-anchored flows untested

**CODE:** `apps/e2e/dagslinjen-quickadd/` covers J2 + J3 (dept-anchored quickadd). No coverage of J7-J12.

**JOURNEY:** All 6 location-awareness journeys need E2E.

**GAP:** New test files per journey. See [E2E-COVERAGE.md](./E2E-COVERAGE.md).

**Status:** Acceptance gate for each phase. **Severity MEDIUM.**

### 3.14 BOTSSON VOICE — No `day_line` tools

**CODE:** `services/voice-agent/src/tools-task.ts` mirrors `task.{list_mine,complete}`. No day_line or routine tools.

**JOURNEY:** Voice authoring is out of scope V1 per ADR-0078 (chat-only on create paths). Voice reads day_line indirectly via workforce snapshot bootstrap (ADR-0297) once `day_line` materializes.

**GAP:** Workforce snapshot slice must include `day_line` rows after migration — otherwise Botsson voice loses day context.

**Status:** Required for snapshot integrity. **Severity MEDIUM.**

---

## 4. Adjacent Debt (not blocking but worth tracking)

| # | Item | Where |
|---|---|---|
| D1 | TimelineTab `useDayTimelineEvents` invalidates broadly — single queryKey for all mutations | `apps/web/src/app/dashboard/_hooks/use-day-timeline-events.ts` |
| D2 | `SlotQuickAddPopover.tsx` legacy component retained for E2E green — should be removed after timeline-templates E2E stabilizes (per file header comment) | `apps/web/src/components/day/SlotQuickAddPopover.tsx` |
| D3 | `AddTaskDialog.useSessionHooksWithTasks` fetches by `department_session_id` — needs `day_line_id` after migration | hook file |
| D4 | Booking `location` column is free-text TEXT, not FK to `location` table — schedule_day_booking.location | `20260301600003_schedule_persistence_tables.sql:353` |
| D5 | Mobile telemetry events for day view use SPACE-separator (`"calendar view_changed"`); registry mix with dot-separator on older events. ADR proposal pending for canonical separator. | `packages/telemetry/src/registry.ts` |
| D6 | No virtualization on web `DayEventList` — fine ≤200 events, will degrade with multi-line stack | `apps/web/src/components/day/DayEventList.tsx` |
| D7 | `schedule_day_info` is dept-anchored, not location-anchored — multi-location dept has one handover note for all sites | `20260302152749_add_dashboard_evolution_tables.sql:157` |
| D8 | Voice tool surface mirror is hand-maintained — no codegen from capability registry. Drift risk. | `services/voice-agent/src/tools-task.ts` |
| D9 | `oversikt-tools-bridge` tools (page-tool registry) hardcoded — no day_line awareness | `apps/web/src/components/day/_tools/` |

---

## 5. Severity Summary

| Severity | Count | Gaps |
|---|---|---|
| CRITICAL | 1 | G3.10 (cascade classification) |
| HIGH | 5 | G3.1, G3.2, G3.3, G3.5, G3.7 |
| MEDIUM | 5 | G3.4, G3.8, G3.9, G3.11, G3.13, G3.14 |
| LOW | 2 | G3.6, G3.12 |

The CRITICAL gap is a council gate — nothing else moves until it's resolved.

---

## 6. Closing Order (preview)

The BLUEPRINT sequences these as 6 phases. Preview:

1. **Phase A — Council + ADR.** Resolves G3.10.
2. **Phase B — Schema migration + backfill.** Closes G3.1, G3.11.
3. **Phase C — Capability + Server Action layer.** Closes G3.4, G3.5, G3.9.
4. **Phase D — UI rewire (TimelineTab + dialogs).** Closes G3.2, G3.3, G3.6, G3.12.
5. **Phase E — Mobile + RLS.** Closes G3.7, G3.8.
6. **Phase F — Voice + telemetry + E2E.** Closes G3.13, G3.14.

See [BLUEPRINT.md](./BLUEPRINT.md) for falsifiable acceptance per phase.
