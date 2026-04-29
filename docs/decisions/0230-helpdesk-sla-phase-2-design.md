---
title: "Helpdesk SLA Phase 2 — Approach A (Pre-Canned Event + Engine Trigger Reuse)"
id: ADR_0230
status: accepted
layer: decision
created: 2026-04-28
updated: 2026-04-28
---

# ADR-0230: Helpdesk SLA Phase 2 — Approach A (Pre-Canned Event + Engine Trigger Reuse)

> **STATUS NOTE 2026-04-29:** Approach A as ratified here was invalidated by post-T2 council code-trace finding — the dispatcher's resume loop only matches `state.current_step`, not all process steps. Trigger spawn always starts at step 1. Steps 3+ on `helpdesk_query_lifecycle` are unreachable for the breach event. ADR-0231 + ADR-0232 (council 2026-04-29) supersede the consumer-path portion of this ADR. The blueprint extension migration `20260428120000` is being reverted; T3 trigger seed needs `process_id` change to point at the new `helpdesk_sla_breach_handler` process. The `update_context` dispatcher action_type (T4 deliverable) is preserved and extended in the replacement ADR.

## Context and Problem Statement

Phase 2 must wire the helpdesk SLA so an open ticket fires an escalation event after `engine_authority_config.observer_escalation_hours` (default 72h) without resolution. The Phase 1 plan assumed a `wait_for_event` step with `timeout_seconds`/`timeout_action` — but the dispatcher does not implement that contract. The plan also assumed `engine_delayed_trigger` had a `status` enum and a free-form `event_name` column — neither exists. The real schema uses `fired BOOLEAN` + `cancelled_at TIMESTAMPTZ`, and `fire-delayed-triggers` re-dispatches via the original `engine_trigger.event_type`. Phase 2 must build on what exists, not on what was assumed.

## Decision Drivers

- Council 2026-04-19 ratified "reuse `engine_delayed_trigger → fire-delayed-triggers`. Zero new time-infra."
- ADR-0161 single-spawn rule: tools emit, dispatcher spawns. SLA wiring must not introduce a second spawn site that bypasses dispatcher.
- ADR-0163: helpdesk channel restriction `allowed_channels=['chat']`. SLA notification must inherit, never leak to voice.
- Council 2026-04-28 (Phase 2 pre-design) verdict: APPROVE WITH CHANGES. Three changes blocking T2 — schema vocabulary fix, observer resolution, dispatcher contract clarity.
- ADR-0229 acknowledges the lack of a first-class escalation hierarchy; this ADR codifies the proxy resolution chain.

## Considered Options

1. **Approach B — extend the dispatcher with `delay_event` action_type + add `state_id` column to `engine_delayed_trigger`.** Cleaner long-term semantics. Requires dispatcher schema work + ADR for the new action_type + cascade for cancellation by state. Engine Architect's preferred path.
2. **Approach A — seed an `engine_trigger` for `helpdesk.query.sla_breached`. At ticket open, insert a pre-canned `engine_event` row + a corresponding `engine_delayed_trigger` row. The existing `fire-delayed-triggers` function picks it up unchanged.** Zero schema migration on the trigger table. Reuses the indirect-dispatch model already in production for journey-engine.
3. **Approach C — extend `wait_for_event` with `timeout_seconds`/`timeout_action` in the dispatcher.** Heaviest change; touches the engine's most-trafficked code path. Rejected by Steward — the placeholder field exists in seeds but no code reads it; building the read-side is out of scope for Phase 2.

## Decision Outcome

Chosen option: **Approach A.**

Phase 2 implementation:

- **Migration `20260428120000_helpdesk_sla_blueprint.sql`** extends the `helpdesk_query_lifecycle` blueprint with steps 3 and 4: `wait_for_event` matching `event = 'helpdesk.query.sla_breached'`, then `update_context` setting `engine_state.context.sla_breached_at = NOW()`. Uses singular `event` key (the dispatcher only honors `event`, not `event_type_any_of`, in the resume loop).
- **Migration `20260428130000_helpdesk_sla_trigger_seed.sql`** seeds one workspace-scoped `engine_trigger` row per workspace with `event_type='helpdesk.query.sla_breached'`, `process_id='helpdesk_query_lifecycle'`, `is_active=true`, `delay_seconds=0`.
- **`packages/ai/src/capabilities/helpdesk_query/tools.ts` `openTicket`** — after the dispatcher spawns the `engine_state`, the tool reads `engine_authority_config.observer_escalation_hours` for the workspace, inserts a pre-canned `engine_event` (event_type=`helpdesk.query.sla_breached`, payload carries `engine_state_id` + `desk_channel_id` + `entity_type='channel'`), and inserts an `engine_delayed_trigger` row with `fire_at = NOW() + observer_escalation_hours * INTERVAL '1 hour'`. **Snapshot semantics:** the resolved hours are baked into `fire_at` at spawn — admin changes to `observer_escalation_hours` do not affect in-flight tickets.
- **`supabase/functions/engine-dispatch/index.ts`** — adds new action_type `update_context` that patches `engine_state.context` for the current state (different from `update_entity` which targets `state.entity_id`). Added to `GATED_MUTATION_TYPES`.
- **`packages/ai/src/capabilities/helpdesk_query/tools.ts` `resolveTicket`** — on resolve, looks up the breach `engine_event` for the ticket and marks the linked `engine_delayed_trigger.cancelled_at = NOW()`. Cancellation must precede the resolve emit so a concurrent `fire-delayed-triggers` poll sees `cancelled_at IS NOT NULL` and skips.
- **Observer resolution at fire time** (per ADR-0229): the lifecycle's step-3 reaction emits `send_notification` with `recipient_id` resolved by helper `resolve_observer(workspace_id, rep_profile_id, min_role)`:
  1. Fetch rep's primary team → `team.leader_profile_id` (skip if leader === rep)
  2. Fall back to all `profile` rows where `role >= min_role` in workspace (broadcast)
  3. If neither resolves, emit `helpdesk.sla.no_observer_resolved` telemetry event and skip notification.
- **Telemetry registration** in `packages/telemetry/src/registry.ts`:
  - `helpdesk.query.sla_breached` (engine event + activity_trail)
  - `helpdesk.sla.no_observer_resolved` (logger + activity_trail; high-signal warn)
- **UI:** `useMinKo` already selects `context`. `MinKoSection` per-row check: render `Pill tone="muted" data-testid="overdue-badge"` (text "Forfalt") when any underlying state has `context.sla_breached_at` set. `TicketHeader` same Pill with `title` attribute carrying the breach timestamp. Spec §1.4 enforced — no `text-destructive` / `text-amber` / `text-red`. No client-side computed-overdue (server is source of truth via `sla_breached_at`).

## Rules & Consequences

- **Good, because** zero schema migration on `engine_delayed_trigger`, zero new dispatcher action_type beyond `update_context` (small, scoped), and the existing `fire-delayed-triggers` function works unchanged.
- **Good, because** snapshot semantics make in-flight tickets immune to admin reconfiguration mid-lifecycle. Audit-friendly + replayable.
- **Good, because** the chat-only restriction is enforced at three layers: blueprint `allowed_channels=['chat']` (ADR-0163), `send_notification` handler hardcoded `["push", "in_app"]` (no voice in payload), and acceptance E2E asserts no voice in `notification_outbox` after breach.
- **Bad, because** `fire-delayed-triggers` is not crash-safe — it marks `fired=true` BEFORE dispatching to engine-dispatch in a non-transactional roundtrip. Crash between mark and dispatch loses the event. Documented as known debt in handoff; lifecycle reaction's `context.sla_breached_at IS NOT NULL` guard is the canonical idempotency layer.
- **Bad, because** the proxy observer resolution (per ADR-0229) is non-obvious to admins. The `helpdesk.sla.no_observer_resolved` telemetry event is the operational safety net.
- **Bad, because** Approach A scatters Phase 2 logic across two migrations + tools.ts + dispatcher + UI. A `delay_event` action_type (Approach B) would localize it. Phase 3 should reconsider if a second capability needs the same pattern.
- **Agent Impact:** future capabilities that need authority-resolved timeouts should follow Approach A's pattern (pre-canned event + engine_trigger seed + tool-side delayed_trigger insert) UNTIL a second consumer justifies generalizing to `delay_event` action_type. Premature abstraction is worse than scattered concretion.
- **Agent Impact:** the `update_context` action_type is helpdesk-specific in spirit but workspace-wide in scope. Reuse for other lifecycle blueprints that need to patch `engine_state.context` from a step. Do NOT use it for cross-state writes — it always targets the current state.
- **Agent Impact:** observer resolution lives in `resolve_observer()` helper. Do NOT inline the rule chain in capability tools — single source of truth for the proxy logic, single point of replacement when ADR-0229 Phase 3 work lands.

---

> After writing: register in `docs/decisions/0000-decision-log.md` and update the ADR table in `CLAUDE.md`.
