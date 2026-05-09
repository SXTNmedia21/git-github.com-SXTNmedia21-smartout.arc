---
title: "Session state-change events have exactly one emit source"
id: ADR-0187
status: accepted
layer: decision
created: 2026-04-22
updated: 2026-04-23
---

# ADR-0187: Session state-change events have exactly one emit source

## Context and Problem Statement

Council 2 (2026-04-22, follow-up to Council 1 ADR-NEXT-01/02 review) discovered that `department_session.status='pending_signoff'` has **four parallel writers with three divergent emission paths**:

1. **DB trigger** `trg_session_pending_signoff` (`supabase/migrations/20260428100400_session_pending_signoff_trigger.sql:8-36`) — AFTER UPDATE on status, emits `engine_event` with event_type `department_session.pending_signoff`.
2. **engine_process step 6** of `department_session_lifecycle` (`supabase/migrations/20260507100100_seed_department_session_lifecycle.sql:112-144`) — `emit_event` action emits `department_session.pending_signoff`.
3. **Server Action inline emit** (`apps/web/src/app/dashboard/_actions/signoff-session-action.ts:102-127`) — direct admin UPDATE + `emit({ event: "session pending_signoff" })` routing via `packages/telemetry/src/registry.ts:5196` to 4 destinations (PostHog / Logger / activity_trail / engine_event).
4. **Cron fallback** (`supabase/functions/session-lifecycle/index.ts:94-113`) — every 15 min auto-transitions, inserts `engine_event` directly.

Consumers subscribing to `department_session.pending_signoff` see triggers 1+2 but miss 3. Consumers subscribing to `session.pending_signoff` see only 3. Same real-world event, two event names, divergent destinations, saved only by accidental `idempotency_key` collisions.

This is the **second instance of the triple-writer pattern** flagged in the 2026-04-18 gate-client Wave 2 council ("three concurrent write paths can silently diverge in authority + telemetry"). Same failure mode, different dimension.

## Decision Drivers

- **Consumer contract** — a consumer subscribing to the event name must see *every* real-world occurrence, not a subset filtered by which writer happened to fire.
- **Single source of truth** — state-change events mirror column mutations; the DB is the only surface that sees all mutation paths (Server Action, engine_process, cron, admin override).
- **Idempotency guarantee** — trigger-level `idempotency_key` eliminates double-fire races that application-layer emit cannot observe.
- **Registry fan-out integrity** — PostHog / Logger / activity_trail consumers must not silently miss events because the writer chose the "wrong" path.
- **Pattern generalization** — any column on `department_session` whose change has business-event meaning has the same four-writer risk (`closed`, `missed`, future states).
- **Avoid Wave 2–style drift** — ADR-0114/0137 closed the mutation-authority divergence; this ADR closes the mutation-telemetry divergence on the same pattern.

## Considered Options

1. **Status quo (4 writers, 2 event names)** — keep all four emission paths. Rejected — silent consumer divergence in production.
2. **DB trigger is the sole emitter for state-change events** — application code writes the column; trigger emits; emit-registry subscribes to the `engine_event` row and fans out to PostHog / Logger / activity_trail.
3. **Delete the trigger, Server Action is canonical** — rejected: cron fallback needs an emission path, and `shift_lifecycle_v1` engine_process needs to trigger session transitions without circular Server Action calls.
4. **Extend `shift_lifecycle_v1` engine_process to own session transitions** — rejected: violates ADR-0096 dimensional boundary (shift-level process writing session-level aggregate).

## Decision Outcome

Chosen option: **Option 2 — DB trigger is the sole emitter for `department_session.status` transitions.** Other writers MAY change `status` but MUST NOT emit.

Specifically:

- **`trg_session_pending_signoff`** remains the canonical emitter for `active → pending_signoff`. It emits `engine_event`; emit-registry (either via pg_notify listener or cron reader) subscribes to the row and routes to PostHog / Logger / activity_trail.
- **`department_session_lifecycle` step 6** is DELETED (duplicate emission).
- **`signoff-session-action.ts`** removes its inline `emit({ event: "session pending_signoff" })` call. The UPDATE alone is sufficient — trigger fires.
- **`session-lifecycle` cron** removes its inline `engine_event` insert (lines 94-113). The UPDATE alone is sufficient.

**Event-name canonicalization.** The emit-registry entry is `"session pending_signoff"` (space-delimited, existing registry pattern at `registry.ts:5196`, aligned with ADR-0164 domain-first convention). The DB trigger's `engine_event.event_type` column uses `department_session.pending_signoff` (dot-delimited — matches existing trigger convention). Both names reference the same trigger-driven emission; emit-registry subscribes to the `engine_event` row and fans out under the space-delimited name.

**Generalization.** Any column on `department_session` whose change has business-event meaning MUST have an AFTER UPDATE trigger that is the SOLE emitter. Application code writes the column; the trigger emits. This applies to future states (`closed`, `missed`) without re-litigation.

## Rules & Consequences

- **Good, because** a consumer subscribing to `session pending_signoff` sees every real-world transition regardless of which writer caused it (Server Action, cron, engine_process, future admin override).
- **Good, because** registry fan-out routing is guaranteed — PostHog / Logger / activity_trail never silently miss events.
- **Good, because** idempotency is guaranteed at trigger level via `idempotency_key = 'session_signoff_' || session_id`, not accidental collision between writers.
- **Good, because** the pattern generalizes to `closed`, `missed`, and future `status` values without new ADRs per state.
- **Good, because** it closes the second known instance of the triple-writer drift pattern (companion to ADR-0114 / ADR-0137 on the authority axis).
- **Bad, because** requires new infrastructure: emit-registry must subscribe to `engine_event` row insertions (pg_notify listener or cron reader). This is the cost of pulling the canonical emit point into the DB.
- **Bad, because** developers must NOT `emit()` state-change events directly from Server Actions — violates the invariant. Enforceable only via lint rule or code review; no runtime guard today.
- **Neutral:** does NOT affect non-state-change events (form submissions, user-initiated actions, UI telemetry). Those continue to `emit()` from Server Action / mutation hooks normally. The rule is scoped to "column change with business-event meaning," not "every emit in the app."
- **Agent Impact:**
  - **Migration:** drop `emit_event` from `department_session_lifecycle` step 6; remove inline emit from `signoff-session-action.ts`; remove inline `engine_event` insert from `session-lifecycle` cron.
  - **New subscriber:** emit-registry listens to `engine_event` inserts (pg_notify channel `engine_event_new` or equivalent) and fans out to PostHog / Logger / activity_trail under the space-delimited name.
  - **ADR-0134 amendment:** adds §3.7 "Projection triggers and state-change triggers do not double-emit; application-layer emit is reserved for non-state events."
  - **Lint rule:** `packages/telemetry` lint prohibits `emit({ event: "session ..." })` call sites matching state-change event names; limits those to the subscriber only.
  - **Smartout-database-guide skill:** adds "state-change events have exactly one emit source — the DB trigger" as a DB-authoring rule.
  - **Review checklist:** any new `status`-like enum column on `department_session` (or similar D6 state-aggregate table) requires a companion AFTER UPDATE trigger before the column ships.

## References

- **Amends** ADR-0134 (Mobile Telemetry Contract) — adds §3.7 on trigger-vs-application emit boundaries.
- **Precedent:** ADR-0114 / ADR-0137 / ADR-0138 (gate-client Wave 2 council 2026-04-18) — same triple-writer pattern on the authority axis.
- **Precedent:** 2026-04-16 Trust Gate memory — "three concurrent write paths can silently diverge in authority + telemetry."
- **Related:** ADR-0099 (Unified Authority Gate) — if trigger emission should also gate authority, that stays ADR-0099's domain, not this ADR's.
- **Related:** ADR-0096 (`schedule_shift` vs `department_session` 1:N) — reason Option 4 was rejected.
- **Related:** ADR-0164 (season-namespace unification) — same domain-first naming convention applied here.
- **Supersedes:** none.
- **Files touched by implementation PR:**
  - `supabase/migrations/20260428100400_session_pending_signoff_trigger.sql` (kept, canonical)
  - `supabase/migrations/20260507100100_seed_department_session_lifecycle.sql` (step 6 emit_event deleted)
  - `apps/web/src/app/dashboard/_actions/signoff-session-action.ts:102-127` (inline emit removed)
  - `supabase/functions/session-lifecycle/index.ts:94-113` (inline engine_event insert removed)
  - `packages/telemetry/src/registry.ts:5196` (entry kept; source switched to trigger-subscriber)

---

> After writing: register in `docs/decisions/0000-decision-log.md`.
