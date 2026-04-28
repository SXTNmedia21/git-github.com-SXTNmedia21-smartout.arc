---
title: "Helpdesk SLA Consumer Path — Breach-Handler Process Pattern"
id: ADR_0231
status: accepted
layer: decision
created: 2026-04-29
updated: 2026-04-29
---

# ADR-0231: Helpdesk SLA Consumer Path — Separate Breach-Handler Process

## Context and Problem Statement

ADR-0230 ratified Approach A: extend `helpdesk_query_lifecycle` blueprint with steps 3+ that wait for `helpdesk.query.sla_breached` and patch `engine_state.context.sla_breached_at`. Implementation (T2 commit `89862577`, T3 commit `011c7546`, T4 commit `7ce3f46b`) revealed a load-bearing dispatcher property the council missed: `engine-dispatch/index.ts` line 413 finds `currentStep = steps.find(s => s.step_order === state.current_step)` and the resume loop only matches the **current step's** `wait_for_event.event` field. Sibling steps in the same process are invisible. Trigger-fired events always spawn `engine_state` with `current_step: 1` (line 348) — so a breach event with `process_id='helpdesk_query_lifecycle'` would spawn a ghost ticket starting at step 1, while the real ticket sits at step 2 waiting for `helpdesk.query.resolved` and ignores the breach.

Council 2026-04-29 (Steward + Supervisor + Code-Tracer + Harness Builder) reviewed three fix options. Vote: 3-1 for Option A reframed as **separate breach-handler process** + cross-state `update_context_targeted` action_type (see ADR-0232).

## Decision Drivers

- ADR-0091 (cascade truth invariant): all engine_state mutations must go through the dispatcher's gated path. Direct SQL UPDATE from `fire-delayed-triggers` violates this.
- ADR-0099 (unified authority gate / `gate_action`): SLA mutations must be in `GATED_MUTATION_TYPES`. fire-delayed-triggers Edge Function is not on the gated path.
- ADR-0161 (single-spawn rule): tools emit, dispatcher spawns. Adding a second mutation surface in fire-delayed-triggers compounds the gate problem with each future capability.
- ADR-0163 (chat-only `allowed_channels`): SLA notification path must inherit channel restriction. Inheritance only works if the notification fires from a dispatcher-managed blueprint step.
- Trust Gate (Council 2026-04-16): any new mutation surface must be audited for authority + telemetry. Edge Function direct writes fail this gate (Supervisor finding: `fire-delayed-triggers` has zero `emit()` calls, only `console.log`).
- Council intent (2026-04-19): "reuse `engine_delayed_trigger → fire-delayed-triggers`. Zero new time-infra." This intent ratifies the trigger PRIMITIVE; it does not constrain WHERE the consumer logic lives. The journey-engine (only existing consumer) routes through the dispatcher.

## Considered Options

1. **Option A — separate breach-handler process** (chosen). New transient process `helpdesk_sla_breach_handler` with two steps: `update_context_targeted` patches the original ticket's `engine_state.context.sla_breached_at`, then `send_notification` to the resolved observer. T3 trigger updated to point at this new process. Original ticket lifecycle unchanged.
2. **Option B — fire-delayed-triggers patches engine_state directly.** Edge Function bypasses dispatcher for SLA path. Direct SQL UPDATE on `engine_state.context` + direct INSERT into `notification_outbox`. Couples generic time-infra to helpdesk domain. Violates ADR-0091/0099/0161. fire-delayed-triggers cannot `emit()` from Deno today (no `@smartout/telemetry/server` Deno-compatible build). Rejected.
3. **Option C — UI client-computed badge.** Drop server-side tracking. UI computes `started_at + observer_escalation_hours < NOW()`. Rejected by Council 2026-04-28 Risk #5 (client clock drift, no audit trail, no observer notification).
4. **Option D — extend dispatcher resume loop with sibling-branch matching.** Code-Tracer + Supervisor flagged this as architecturally clean but with broad blast radius (changes semantics for every existing process). Out of Phase 2 scope.

## Decision Outcome

Chosen option: **Option A — separate breach-handler process.**

Phase 2 implementation (revised post-Council 2026-04-29):

- **Revert migration `20260429HHMMSS_revert_helpdesk_sla_blueprint.sql`** removes the steps 3+ added by `20260428120000_helpdesk_sla_blueprint.sql`. The `helpdesk_query_lifecycle` blueprint returns to its 2-step form (open → wait-for-resolved). Telemetry registrations from `89862577` are preserved (events still emitted, just from a different process).
- **New migration `20260429HHMMSS_helpdesk_sla_breach_handler_blueprint.sql`** creates a new `engine_process` row `helpdesk_sla_breach_handler` (per-workspace seed, inherits `allowed_channels=['chat']` per ADR-0163) with two steps:
  1. `update_context_targeted` (new action_type per ADR-0232) — patches `engine_state.context.sla_breached_at = NOW()` on the state identified by `action_payload.target_state_id`, which the dispatcher reads from the breach event payload (`payload.engine_state_id`).
  2. `send_notification` — `recipient_id` resolved at fire time via `resolve_observer()` helper (per ADR-0229 proxy chain), `allowed_channels=['push','in_app']` (no voice — ADR-0163), payload references the target ticket's channel.
- **T3 trigger seed update**: `20260428130000_helpdesk_sla_trigger_seed.sql` rewritten (or amended via successor migration) to point `process_id` at `helpdesk_sla_breach_handler` instead of `helpdesk_query_lifecycle`.
- **Dispatcher addition** (per ADR-0232): `update_context_targeted` action_type added as sibling to existing `update_context`. Workspace integrity guard enforces `source_state.workspace_id === target_state.workspace_id`. Both registered in `GATED_MUTATION_TYPES`.
- **Tool changes (T5/T6)**: `openTicket` reads `observer_escalation_hours`, inserts a pre-canned `engine_event` (payload includes `engine_state_id` of the original ticket + `desk_channel_id` + `responsible_profile_id`), inserts `engine_delayed_trigger` keyed to that event with `fire_at = NOW() + observer_escalation_hours * INTERVAL '1 hour'`. `resolveTicket` cancels the linked trigger via `cancelled_at = NOW()` BEFORE emitting the resolve event.
- **Observer resolution** (per ADR-0229): unchanged. The proxy chain runs at breach-handler step 2 fire time, reads `responsible_profile_id` from the target ticket's `engine_state.context`, walks `team.leader_profile_id` → broadcast.

## Rules & Consequences

- **Good, because** the original ticket lifecycle is untouched. Resolve flow remains pure 2-step, no parallel-branch complexity.
- **Good, because** the breach-handler is invisible to the 9+ existing UI consumers that filter `process_id='helpdesk_query_lifecycle'` (verified by Harness Builder code-trace). Truth-of-record for "this ticket has been SLA-breached" lives in the original ticket's `context.sla_breached_at` — written by the breach-handler's targeted update, read by `useMinKo` + `TicketHeader`.
- **Good, because** the pattern is reusable. Future capabilities needing authority-resolved timeouts (contract sign-off escalation, training-overdue, shift-no-show) follow the same shape: pre-canned event at spawn → engine_trigger seeded → fire-delayed-triggers re-dispatches → transient `*_breach_handler` process patches origin state + notifies.
- **Good, because** Trust Gate passes. Both `update_context_targeted` action and the breach-handler process are gated through dispatcher's existing `gate_action` machinery. No new mutation surface bypasses the gate.
- **Bad, because** breach-handler `engine_state` rows accumulate linearly with breach count. At expected volumes (≤12K/year/workspace) this is negligible, but Phase 3 should add a TTL sweep job for completed breach-handler states.
- **Bad, because** the consumer-path fix invalidates ADR-0230's "Approach A" framing partially. ADR-0230 stays as the source-of-truth for: (a) telemetry event names, (b) `update_context` (current-state) action_type, (c) snapshot semantics on `observer_escalation_hours`, (d) observer proxy chain reference. Steps 3+ on lifecycle are explicitly rescinded; ADR-0230 marked `superseded-in-part`.
- **Agent Impact:** future blueprints that need to patch a **different** state's context must use `update_context_targeted` (per ADR-0232), never `update_context` with a payload-conditional flag. The split exists because cross-state writes need workspace-integrity guards that current-state writes do not.
- **Agent Impact:** when emitting a breach-style event from a tool, ALWAYS forward the origin `engine_state_id` in the event payload. The breach-handler process reads this to route the targeted update. Without it, the handler has no reference to the state it's supposed to patch.
- **Agent Impact:** `fire-delayed-triggers` Edge Function is a generic primitive — DO NOT add per-capability branches. If a capability needs different consumer logic, route through a new transient handler process via the trigger seed pattern.

---

> After writing: register in `docs/decisions/0000-decision-log.md` and update the ADR table in `CLAUDE.md`.
