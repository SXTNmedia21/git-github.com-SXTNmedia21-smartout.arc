---
title: Day Timeline Module — Blueprint Index
status: in_progress
updated: 2026-05-17
created: 2026-05-17
module: daytimeline
tags: [module, daytimeline, dagslinjen, blueprint, source-of-truth, d6-production]
---

# Day Timeline Module — Blueprint & Source of Truth

> Authoritative blueprint for Smartout's Day Timeline (Dagslinjen) surface. If code contradicts this folder → CODE wins, update these docs.

## Status

- **Today (dept-anchored):** shipped. One `department_session` per dept per day. Slot picker anchored at click coordinate (shipped 2026-05-17). Templates per ADR-0335. Workforce snapshot bootstrap per ADR-0297.
- **Location-anchored (planned):** 6-phase blueprint below. Council gate on Phase A. Schema delta + capability + UI + mobile + voice + E2E across phases B-F.

## Reading order

| # | Doc | Purpose |
|---|---|---|
| 1 | [MODULE_DAYTIMELINE.md](./MODULE_DAYTIMELINE.md) | Main module doc — overview, cascade placement (D6), surface contract, authority, invariants |
| 2 | [DATA-MODEL.md](./DATA-MODEL.md) | All tables touched, FK map, telemetry events, RLS, planned `day_line` schema delta |
| 3 | [ARCHITECTURE.md](./ARCHITECTURE.md) | L1-L5 code map: web (TimelineTab + DayTimelineStrip + SlotPicker + hooks + actions) + mobile + capability layer + telemetry |
| 4 | [USER-FLOWS.md](./USER-FLOWS.md) | Index of 12 journeys (6 shipped + 6 draft) + cross-surface flows + authority decision points |
| 5 | [GAPS-AND-DEBT.md](./GAPS-AND-DEBT.md) | Verified-working vs aspirational. 14 gaps classified by severity. Adjacent debt tracker. |
| 6 | [BLUEPRINT.md](./BLUEPRINT.md) | 6-phase implementation plan. Falsifiable acceptance per phase. ~9 working days total. |
| 7 | [E2E-COVERAGE.md](./E2E-COVERAGE.md) | Web Playwright + mobile Maestro proposal + capability units + manual matrix |

## Cross-references

### ADRs
- **Accepted:** [ADR-0069](../../decisions/0069-session-execution-ownership.md), [ADR-0096](../../decisions/0096-schedule-shift-vs-department-session.md), [ADR-0156](../../decisions/0156-day-control-panel-canonical-admin-surface.md), [ADR-0187](../../decisions/0187-session-state-events-single-emit-source.md), [ADR-0273](../../decisions/0273-deviation-day-info-server-action-migration.md), [ADR-0297](../../decisions/0297-workforce-snapshot-session-bootstrap.md), [ADR-0298](../../decisions/0298-task-ontology-five-sources.md), [ADR-0334](../../decisions/0334-ephemeral-presence-supabase-broadcast.md), [ADR-0335](../../decisions/0335-timeline-templates-d6-authoring.md)
- **Adjacent:** ADR-0078 (channel restrictions), ADR-0099 (gate_action), ADR-0114 (Server Actions), ADR-0132 (mobile AI routing), ADR-0133 (mobile boundary), ADR-0134 (mobile telemetry contract), ADR-0151 (server-resolved IDs), ADR-0204 (gatedMutation), ADR-0287 (gate_action mandatory on mutation capability tools), ADR-0240/0173 (cross-namespace writes), ADR-0325 (page-tool authority/dedupe)
- **Proposed:** TBD — location-anchored `day_line` model. Phase A council 2026-05-17 timeline-location-awareness session.

### Journeys
**Shipped:**
- [JOURNEY-timeline-slot-popover-anchors-at-click](../../journeys/JOURNEY-timeline-slot-popover-anchors-at-click.md) (2026-05-17)
- [JOURNEY-dagslinjen-quickadd-manager-quickadd-at-slot](../../journeys/JOURNEY-dagslinjen-quickadd-manager-quickadd-at-slot.md)
- [JOURNEY-dagslinjen-quickadd-manager-filter-timeline](../../journeys/JOURNEY-dagslinjen-quickadd-manager-filter-timeline.md)
- [JOURNEY-dagslinjen-quickadd-manager-target-note-fanout](../../journeys/JOURNEY-dagslinjen-quickadd-manager-target-note-fanout.md) + employee-receives sibling
- [JOURNEY-dagslinjen-task-avvik-wire-manager-quickadd-task](../../journeys/JOURNEY-dagslinjen-task-avvik-wire-manager-quickadd-task.md) + avvik sibling
- [JOURNEY-timeline-templates](../../journeys/JOURNEY-timeline-templates.md) (ADR-0335)

**Draft (location-awareness roadmap):**
- [JOURNEY-timeline-location-awareness-manager-create-day-line](../../journeys/JOURNEY-timeline-location-awareness-manager-create-day-line.md)
- [JOURNEY-timeline-location-awareness-manager-edit-opening-closing](../../journeys/JOURNEY-timeline-location-awareness-manager-edit-opening-closing.md)
- [JOURNEY-timeline-location-awareness-manager-add-single-task](../../journeys/JOURNEY-timeline-location-awareness-manager-add-single-task.md)
- [JOURNEY-timeline-location-awareness-manager-attach-routine](../../journeys/JOURNEY-timeline-location-awareness-manager-attach-routine.md)
- [JOURNEY-timeline-location-awareness-employee-views-own-location](../../journeys/JOURNEY-timeline-location-awareness-employee-views-own-location.md)
- [JOURNEY-timeline-location-awareness-admin-multi-location-overview](../../journeys/JOURNEY-timeline-location-awareness-admin-multi-location-overview.md)

### Code locations
- **Web TimelineTab:** `apps/web/src/components/day/tabs/TimelineTab.tsx`
- **Web strip:** `apps/web/src/components/day/DayTimelineStrip.tsx`
- **Web slot picker:** `apps/web/src/components/day/SlotPicker.tsx`
- **Web shell:** `apps/web/src/components/day/WebDayControl.tsx` (ADR-0156)
- **Web hooks:** `apps/web/src/app/dashboard/_hooks/use-day-timeline-events.ts`, `use-day-timeline-scope.ts`, `use-session-hooks-with-tasks.ts`
- **Web actions:** `apps/web/src/app/dashboard/_actions/{add-task,add-booking,create-day-info,create-targeted-note,report-deviation,update-deviation,toggle-session-task,complete-session-task}-action.ts`
- **Mobile day route:** `apps/mobile/app/(app)/(calendar)/day/[date].tsx`
- **Mobile hooks:** `apps/mobile/src/hooks/queries/use-calendar-items.ts`, `use-day-info.ts`
- **Capabilities:** `packages/ai/src/capabilities/{task,operations,operations-intelligence}/`
- **Telemetry registry:** `packages/telemetry/src/registry.ts`
- **Schema:** `supabase/migrations/20260304200000_department_session.sql`, `20260412100300_session_infrastructure.sql`, `20260421100350_cascade_a1_alter_existing.sql`, `20260301600003_schedule_persistence_tables.sql`
- **Voice tools:** `services/voice-agent/src/tools-task.ts`
- **E2E:** `apps/e2e/dagslinjen-quickadd/`, `apps/e2e/timeline-templates/`

### Sibling modules
- [MODULE_COMMUNICATION](../MODULE_COMMUNICATION.md) — Komm session channels auto-created per department_session.
- [MODULE_YEAR_WHEEL_PRD](../MODULE_YEAR_WHEEL_PRD.md) — D4 planning_event feeds demand into the day.
- [payroll/MODULE_PAYROLL](../payroll/MODULE_PAYROLL.md) — C3 ledger snapshots D6 production rows after C1 reconciliation.
- [task-manager/](../task-manager/) — Task Ontology per ADR-0298 (five sources, one read RPC, one capability).

## Authoring rules

- All Day Timeline mutations gate via `gatedMutation` (ADR-0204). No direct browser writes.
- All mutations emit telemetry via `emit()` from `@smartout/telemetry`. Register in BOTH `SmartoutEvent` union AND `EVENT_ROUTING` map (recurrence trap).
- All ID derivation server-side per ADR-0151 — body-supplied `workspace_id` / `profile_id` rejected.
- Mobile remains read-only per ADR-0133. No new authoring on mobile.
- New capability tools require seed migration before merge (L-0066 default-allow CVE class).
- Cross-namespace writes (e.g. routine writes session_task) MUST delegate to the owning capability's tool (ADR-0240).
- Location-anchored work is council-class — no merge without accepted ADR.
- Voice channel restrictions per ADR-0078 — V1 authoring stays chat-only.

## Glossary

- **Dagslinjen** — Norwegian for "the day-line". The horizontal time-axis surface inside WebDayControl.
- **department_session** — current line-owner table; one row per (workspace, department, business_date).
- **day_line** — planned new line-owner table; one row per (workspace, business_date, location, dept|team).
- **session_hook** — routine parent. Anchors N session_task children with offsets.
- **session_task** — single task (hook_id NULL) or routine child (hook_id set).
- **Slot picker** — popover at click coordinate. 3 lanes: PRODUKSJON (D6) / BEMANNING (D2) / FRI TEKST.
- **Phase boundaries** — prep / service / windDown bands tinted on the strip background.
- **Routine** — predefined session_hook + child tasks. Attached at runtime to a day_line, or saved as `timeline_template` for reuse.
- **Scope filter** — URL `?scope=type:id` param. Filters strip to dept / team / location / shift subset.
- **C1 reconciliation** — end-of-day calibration. Locks `department_session.status='closed'`. Strip becomes read-only.
- **Workforce snapshot** — D2+D6 facts shipped at session start to voice + chat (ADR-0297). Eliminates query_smartout roundtrips for day-context questions.
- **L-0066** — default-allow CVE class. Unseeded capability = gate no-op. Every new capability needs a seed migration.
