---
title: "Helpdesk ontology — ticket as engine_state"
id: ADR_0161
status: accepted
layer: decision
created: 2026-04-19
updated: 2026-04-20
---

# ADR-0161: Helpdesk ontology — ticket as `engine_state`, channel as conversation projection

## Context and Problem Statement

The 2026-04-19 council on "Kanaler som Help Desk" rejected the proposal to model help desk tickets as rows in the `channel` table (via new `comm_channel_type` values `'desk'`/`'desk_query'` + seven conditional columns). All five reviewers reached the same conclusion from different angles: a channel is a persistent communication room; a ticket is a stateful workflow with lifecycle, SLA, priority, assignment, and resolution. Forcing ticket shape onto the channel row violates cascade invariant #2 (one role per datum) and pollutes the `channel` table schema with NULL-for-all-other-types columns.

## Decision Drivers

- Product need: ConnectTeam-style help desk (categorized desks, representatives, SLA, clear responsibility, clear access control, video calls).
- Infrastructure constraint: `engine_delayed_trigger` + `fire-delayed-triggers` edge function already implement delayed-event dispatch (verified 2026-04-19 code-trace). SLA escalation is this pattern, not a new one.
- ADR-0087: Komm is a thin display layer, intelligence flows from Event Engine.
- ADR-0063: Komm is canonical; Chat is frozen. Conversation-about-anything goes through `channel_message`.
- Dead-infra deadline (ADR-0087, 90 days from 2026-04-13): `channel_ai_policy` + `channel_event` need real consumers or removal.
- L-0070 (this council): sibling-table pattern does not answer ontology questions; it hides them.

## Considered Options

1. **Alt A — Desk as channel_type** (original proposal): `channel_type='desk'` + `channel_type='desk_query'` + 7 conditional columns + `channel_access_rule` table.
2. **Alt B — Separate `help_desk.*` schema**: parallel domain with its own video/attachments/retention stack.
3. **Alt C — Dedicated `help_request` table + linked channel thread**: ticket fields on `help_request`, conversation in `channel`, lifecycle in `engine_process`.
4. **Alt D — Ticket IS an `engine_state`**: `engine_process(type='helpdesk_query')`, lifecycle in `engine_state`, channel thread is the conversation projection.
5. **Alt C+D hybrid — `help_request` queryable mirror + `engine_state` authoritative lifecycle**: denormalized columns on `help_request` with FK to `engine_state` for queries like "my open urgent tickets."

## Decision Outcome

Chosen option: **Alt D as primary, with Alt C+D hybrid permitted if query performance requires it.**

Rationale:
- Infrastructure already exists (`engine_delayed_trigger` handles SLA for free).
- Wires dead-infra (`channel_event` via ADR-0160, `channel_ai_policy` via ADR-0162) as first real consumers.
- Preserves ontology: channel stays a room, ticket stays a workflow.
- Auditable by construction (`engine_state_step` tracks every transition).
- Escalation reuses the exact pattern used for contract, dunning, shift-swap — no new time-based infrastructure.

Rejected:
- **Alt A:** ontology stretch; all five reviewers converged on the grunnproblem.
- **Alt B:** duplicates video/attachments/retention/realtime; violates ADR-0063.
- **Alt C alone:** adds a new queryable table but keeps lifecycle fragmented across `help_request.status` and whatever cron polls it — loses the Event Engine audit trail.
- **Alt C+D hybrid:** acceptable fallback if `engine_state.context JSONB` becomes a query bottleneck for desk dashboards ("all open urgent desks assigned to me").

## Rules & Consequences

### Data model

- Desk = `channel` row with new `channel_type='desk'` and `responsible_profile_id FK` (nullable on other channel types, CHECK NOT NULL for desks).
- Ticket = `engine_state` row with `process_id` referencing a seeded `engine_process(name='helpdesk_query_lifecycle')`.
- Ticket conversation = new `channel` row with `channel_type='custom'` or new dedicated `channel_type='query_thread'` (to be decided in migration), linked via `engine_state.context.channel_id`.
- Priority, category, assignee, SLA deadline = columns on `engine_state` or `engine_state.context JSONB` (migration decides based on query patterns).
- Hybrid fallback: if dashboards require, add `help_request` table with denormalized columns (priority, status, category) + FK to `engine_state.id`.

### Process blueprint

```
engine_process(name='helpdesk_query_lifecycle', allowed_channels=['chat']):
  step 1: wait_for_event(event='helpdesk.query.opened')
  step 2: assign_task(to=desk.responsible_profile_id)
  step 3: send_notification(to=requester + assignee)
  step 4: wait_for_event OR timeout (SLA)
          ├─ on 'helpdesk.query.resolved' → step 6
          └─ on timeout → step 5
  step 5: ops_escalate + send_notification(priority=critical) + update_entity(priority='urgent')
  step 6: update_entity(status='resolved') + insert channel_message(type='summary')
```

### What is explicitly rejected

- `channel.sla_deadline_at` column (belongs in `engine_state`).
- `channel.priority` column (belongs in `engine_state`).
- `channel.query_status` column (belongs in `engine_state`).
- `channel_access_rule` table (L-0029 fifth-parallel-permission-mechanism).
- `channel_member.role='owner'` enum value (L-0069 collides with `profile.role='owner'`).
- Adding `channel_type='desk_query'` (tickets are not rooms).
- Phase 4 (broadcast, analytics) from original proposal — separate product.

### Agent Impact

- Helpdesk reads: query `engine_state WHERE process_id = helpdesk_query_lifecycle_id` (not `channel`).
- Helpdesk writes: `emit()` → `engine_event` → dispatcher updates `engine_state` + projects to `channel_event` per ADR-0160.
- Helpdesk conversation: plain `channel_message` inserts on the linked channel row.
- SLA timers: set `engine_trigger.delay_seconds` on process step; reuse `fire-delayed-triggers`.
- Mobile surface (ADR-0133): read + reply + resolve only; NO desk authoring, NO access-rule configuration, NO reassignment (self-claim permitted).

## Blocked until

- ADR-0160 (channel_event boundary) accepted.
- ADR-0162 (helpdesk_query capability) accepted.
- ADR-0163 (PII channel restriction amendment) accepted.
- Dead-infra wiring: `channel_ai_policy` read-path implemented in `packages/ai/src/capabilities/communication/policy.ts`.

---

> Council source: 2026-04-19 COUNCIL-LOG. Register in `0000-decision-log.md`.
