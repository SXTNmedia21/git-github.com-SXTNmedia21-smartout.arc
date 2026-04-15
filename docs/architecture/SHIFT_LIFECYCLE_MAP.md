---
title: "Shift Lifecycle Map — Current State vs Target"
status: in_progress
updated: 2026-04-15
created: 2026-04-15
module: schedule
tags: [architecture, shift, lifecycle, cascade, five-layer, council-2026-04-15]
---

# Shift Lifecycle Map

> Phase 2 deliverable from Council 2026-04-15 (ADR-0095..0100).
> **Purpose:** map every transition, table, engine_process, telemetry event, and handler in the shift lifecycle to its meaning layer (per ADR-0095). This document is the contract for all subsequent consolidation work.
> **Rule:** if code disagrees with this map, the code wins — update this file.

## Five-Layer Model (per ADR-0095)

| Layer | Tables (current) | Tables (target) | Status enums |
|-------|-----------------|------------------|--------------|
| **Reality (D6 source)** | `timesheet.time_entry`, punch events, `session_task` completions | same (immutable per ADR-0097) | `time_entry_status`: clocked_in → completed → ~~edited~~ (deprecated) |
| **Interpretation (D6 derived)** | _missing — gap_ | `shift_hour_interpretation` (NEW migration) | (none — derived rows, version-tagged) |
| **Derivation (C3)** | `shift_cost_snapshot` (referenced, not migrated) | same + `employee_payroll_profile` | (none — pure outputs) |
| **Decision (C1)** | `shift_approval`, `daily_reconciliation` | same + override artifacts (per ADR-0097) | `shift_approval_status`, `reconciliation_status` |
| **Execution (D6 commitment)** | `schedule_shift`, `department_session` | same (1:N relation per ADR-0096) | `shift_status`, `department_session_status` |

## Current-State Transition Map

### Stage 1 — Create (Execution layer)

| Element | Path | Layer | Status |
|---|---|---|---|
| UI: booking dialog | `apps/web/src/app/dashboard/schedule/_components/booking-dialog.tsx` | Execution | OK |
| UI: template fill | `apps/web/src/app/dashboard/schedule/_components/edit-template-dialog.tsx` | Execution | OK |
| Mutation hook | `packages/schedule/src/use-grid-mutations.ts` (`useFillFromTemplate`) | Execution | OK; emits `template applied` |
| Service | `services/shift-mcp/src/tools/{create,update,delete,get,list}-shift.ts` | Execution | OK; thin per ADR-0036 |
| Telemetry | `packages/telemetry/src/registry.ts` (event `template applied`, `shift updated`) | Execution | OK |
| Day-category derivation | `use-grid-mutations.ts:340-359` | Execution | **DEFECT — derives client-side, should be server-side (D3 concern)** |

### Stage 2 — Publish (Execution → cross-layer event)

| Element | Path | Layer | Status |
|---|---|---|---|
| Mutation hook | `packages/schedule/src/use-grid-mutations.ts` (`usePublishWeek`) | Execution | OK |
| Pre-publish validation | `apps/web/src/app/dashboard/schedule/_hooks/use-publish-validation.ts` | Execution | OK |
| DB trigger (push) | `supabase/migrations/20260418120000_push_dispatch_triggers.sql` | Notification (parallel to EE) | **TARGET: migrate to engine `send_notification` step** |
| EE trigger seed | `supabase/migrations/20260427100000_seed_shifts_published_trigger.sql` | Coordination | OK; routes both `shift published` (singular) and `shifts.published` (plural) |
| Process: `department_session_lifecycle` | referenced in trigger seed; **migration not found** | Coordination | **GAP — verify and seed if missing** |
| Telemetry event | `shift published` (registry line ~460), `shifts.published` (plural, trigger-side) | Execution | **DEFECT — dual routing, unwind to single canonical name** |

### Stage 3 — Punch in / out (Reality layer)

| Element | Path | Layer | Status |
|---|---|---|---|
| Mobile UI | `apps/mobile/app/(app)/(home)/punch-clock.tsx` | Reality | OK |
| Mobile mutation | `apps/mobile/src/hooks/mutations/use-punch.ts:96,138` | Reality | OK; emits `shift punched_in`/`shift punched_out` |
| Web UI | (no dedicated punch UI; web reads punch state) | — | OK |
| Reality table | `timesheet.time_entry` (migration `20260324090000_timesheet_schema.sql`) | Reality | OK; **per ADR-0097 must be append-only after Interpretation consumes** |
| Session container | `department_session` (migration `20260304200000_department_session.sql`) | Execution | OK |
| Session task tracking | `session_task` | Reality (work-within-shift) | OK |
| Geofence validation | (none) | Reality | **GAP — `punch_in_location` captured, never validated against `department_operating_hours`** |
| Late/no-show triggers | telemetry mentions `late_detected`, `no_show_escalated` | Reality | **GAP — events declared, no handlers found** |

### Stage 4 — Approve (Decision layer)

| Element | Path | Layer | Status |
|---|---|---|---|
| Decision table | `shift_approval` (migration `20260304200200_deviation_shift_approval.sql`) | Decision | OK |
| Approval UI | (path TBD; likely in `apps/web/src/app/dashboard/schedule/_components/day-control/`) | Decision | OK |
| Authority gate | `engine_authority_config.min_role` consumed by `agent-router.ts` only (commit `d4f069eb`) | Decision (gate) | **DEFECT — `engine-dispatch/index.ts` does NOT enforce gate; ADR-0099 closes this** |
| Edit justification | `shift_approval.edit_justification` | Decision (override) | OK; per ADR-0097 this is the override path, not `time_entry` UPDATE |
| Telemetry | `shift hours_confirmed` (registry ~1254) | Decision | **DEFECT — declared, but emit() not present in admin handler paths (Supervisor finding)** |

### Stage 5 — Communication (cross-cutting)

| Element | Path | Layer | Status |
|---|---|---|---|
| Notification outbox | `packages/notifications/src/outbox.ts` | Cross-cutting | OK |
| Push dispatch | `supabase/functions/push-dispatch/index.ts` (called by pg_net trigger) | Cross-cutting | OK; parallel to EE `send_notification` |
| Event Engine notify | `engine-dispatch/index.ts` action `send_notification` (line ~640, ~1492) | Cross-cutting | OK |
| Voice/PII guard | `engine_process.allowed_channels` exists; consumed only as payload field, not as filter | Decision (gate) | **DEFECT — ADR-0077/0078 violation; ADR-0099 closes this** |
| Reminder cron | `supabase/migrations/20260504100003_shift_reminder_crons.sql` | Cross-cutting | **VERIFY — implementation not traced** |

### Stage 6 — Reconciliation (Decision layer, department-aggregate)

| Element | Path | Layer | Status |
|---|---|---|---|
| Reconciliation table | `daily_reconciliation` (migration `20260304200100_daily_reconciliation.sql`) | Decision (aggregate) | OK |
| Settlement images | `settlement_image` | Reality (operational) | OK |
| Settlement validation | `settlement_validation` (links to `deviation`) | Decision | OK |
| Process: `daily_close` | migration `20260304300000_seed_daily_close_process.sql` (8-step engine_process) | Coordination | OK; per ADR-0100 consumes `shift.settled` events |
| Cost snapshot | `shift_cost_snapshot` (referenced in CLAUDE.md) | Derivation | **GAP — table not migrated** |
| Payroll profile | `employee_payroll_profile` (referenced in CLAUDE.md) | Derivation | **GAP — table not migrated** |
| Payroll export | (Stripe/accounting integration) | Derivation | **GAP — no handler found** |
| Lock policy | `20260326200000_reconciliation_lock_rls.sql` | Decision | OK |

## Five Status Enums — Per-Layer Mapping

| Enum | Layer | Owns | Other layers may | Notes |
|------|-------|------|------------------|-------|
| `shift_status` | Execution | publish/fill/cancel lifecycle | — | created → assigned → published → active → completed → unpublished |
| `department_session_status` | Execution (aggregate) | session window lifecycle | — | upcoming → active → pending_signoff → closed \| missed |
| `session_task_status` | Reality (work-within-shift) | task progression | — | pending → available → in_progress → completed \| skipped \| overdue \| escalated |
| `shift_approval_status` | Decision | manager ratification | — | pending → approved \| edited \| disputed |
| `reconciliation_status` | Decision (aggregate) | department-day close | — | open → submitted → awaiting_approval → approved \| locked \| unreconciled |

**Rule:** no UI surface or aggregator may collapse these into one. They are five lenses on the same domain object, each owning one transition layer (per ADR-0095). UI may *map* them to four phenomenological phases for presentation (Planlegges/Pågår/Oppgjør/Avsluttet — per Frontend Designer review).

## Coordination Processes (Event Engine)

| Process | Migration | Aggregate scope | Trigger | Consumes events from |
|---------|-----------|-----------------|---------|----------------------|
| `daily_close` | `20260304300000_seed_daily_close_process.sql` | department-day | `department_session.pending_signoff`, `shift.last_checkout` (5min delay) | `shift.settled` (per ADR-0100) |
| `department_session_lifecycle` | referenced in `20260427100000_seed_shifts_published_trigger.sql`; **seed migration not located** | department-session | `shifts.published` event | — |
| `shift_lifecycle_v1` | **NEW (target Phase 4)** | per-shift transitions | publish, punch_out events | — |

## Defects Targeted by Council Plan

Numbering matches the Phase plan in COUNCIL-LOG.md entry 2026-04-15:

- **Phase 1 (security, ship independently):** authority-gate not enforced in `engine-dispatch` (ADR-0099).
- **Phase 3 (Derivation):** missing `shift_hour_interpretation`, `shift_cost_snapshot`, `employee_payroll_profile` migrations.
- **Phase 4 (coordination):** `department_session_lifecycle` seed verification, `shift_lifecycle_v1` seed, event-name dual routing unwound, pg_net push migrated to EE `send_notification`.
- **Phase 5 (capability + read view):** `shift_lifecycle` capability, `governance.check_readiness` capability, `v_shift_lifecycle` view, engine_state archive job (per ADR-0098).
- **Phase 6 (UI):** 4-phase mapping in `packages/ui/wizard-like/`, cockpit-driven entry, Botsson as deviation mediator.

## Out of Scope

- Workspace-level changes (these are workspace-internal lifecycle maps; cross-workspace concerns live elsewhere).
- Mobile rebuild (per Frontend Designer R7, mobile UI lands in Phase 6 alongside web).
- Stripe/accounting integration (separate ADR after Phase 3 derivation lands).
- I1 bootstrap completion (separate workstream; tracked elsewhere).
