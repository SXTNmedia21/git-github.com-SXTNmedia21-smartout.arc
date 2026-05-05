---
title: "Staff Event as Dedicated Table"
id: ADR-0285
status: accepted
layer: decision
created: 2026-04-29
updated: 2026-04-29
---

# ADR-0285: Staff Event as Dedicated Table

## Context and Problem Statement

Admins and managers need to summon employees to staff events — utviklingssamtale (appraisal), personalmøte (staff meeting), personalfest (staff party), and annet (other). The system already has `engine_state` as the canonical "ticket-style" record per L-0066 (Alt D, Kanaler som Help Desk council). The question is whether staff events should reuse that infrastructure or get their own table.

## Decision Drivers

- `engine_state` carries stage-engine lifecycle semantics (SLA timers, `fire-delayed-triggers`, process missions, step handlers, authority gates) that a staff event does not need.
- Staff events are calendar-class: a fixed start/end window with an attendee list, not a stateful workflow.
- Reusing `engine_state` would require a "fake" mission blueprint and leave a lifecycle field permanently empty — the classic phantom-contract anti-pattern (ADR-0197).
- The feature must be buildable without involving stage-engine infra, campaign/helpdesk ownership, or ADR-0232 broker patterns.

## Considered Options

1. **`engine_state` with `process_id = 'staff_event'`** — reuse the ticket runtime; create a minimal mission blueprint.
2. **Reuse `notification` table** — treat a staff event as a scheduled notification burst.
3. **Calendar event in a komm channel with iCal attachment** — create a channel thread with attachment semantics.
4. **Dedicated `staff_event` + `staff_event_attendee` tables** — new purpose-built schema with no runtime coupling.

## Decision Outcome

Chosen option: **Option 4 — dedicated `staff_event` table**, because staff events are calendar records, not workflow records. Options 1-3 each pull in infrastructure designed for different semantics.

- Option 1 rejected: `engine_state` is for tickets that flow through stage-engine missions. No mission flow exists or is needed for staff events. Forcing a mission blueprint would produce a phantom contract (ADR-0197 Mode 2).
- Option 2 rejected: `notification` rows are transient delivery records, not durable entities. Staff events need to be queryable, listable, and associated with attendee responses over time.
- Option 3 rejected: no iCal infrastructure exists in the codebase. The feature requires the event to be durable and queryable by workspace, date, and attendee — a komm thread does not support this cleanly.

## Rules & Consequences

- **Good, because** the table is simple, schema-correct, and buildable without touching stage-engine, helpdesk campaign, or any capability infra.
- **Good, because** RLS follows the standard workspace-member-read / admin-manager-write pattern already established for D6 tables.
- **Bad, because** a new table requires RLS, telemetry registration, and server actions — no free reuse of existing pipelines.
- **Agent Impact:** Server actions for `createStaffEvent` / `listStaffEvents` derive `created_by` server-side from session profile (ADR-0151, never trust client-supplied created_by). C4 authority gate is not wired in Phase 1 — add if governance requirements emerge in Phase 2.

---

> Registered in `docs/decisions/0000-decision-log.md`.
