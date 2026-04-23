---
title: "Triple-Writer (and Quadruple-Writer) Pattern Recurs Across Campaigns"
id: LEARNING_0108
status: canonical
layer: learning
created: 2026-04-22
updated: 2026-04-22
tags: [architecture, write-paths, emit, telemetry, single-emitter, daily-operation, council]
---

# Learning-0108: Triple-Writer Pattern Recurs Across Campaigns

## Context

Council 2 of the 2026-04-22 daily-operation session traced the `department_session.status='pending_signoff'` transition and found **four independent writers**:

1. `supabase/functions/session-lifecycle/index.ts:94-113` — cron job that sweeps sessions past `pre_close.completed_at + grace_window` and flips status.
2. `supabase/migrations/20260428100400_session_pending_signoff_trigger.sql` — DB trigger that fires on `UPDATE` of any `session_hook` with `hook_key='pre_close'` and `status='complete'`, updating the parent `department_session.status`.
3. `supabase/migrations/20260507100100_seed_department_session_lifecycle.sql:112-144` — `engine_process` step 6 that emits a transition event when advanced by the Event Engine.
4. `apps/web/src/app/dashboard/_actions/signoff-session-action.ts:102-127` — Server Action that inline-writes status and inline-emits telemetry on the leader's explicit "ready for signoff" tap.

The four paths disagree on event name: trigger + process emit `department_session.pending_signoff`, the Server Action registry emits `session.pending_signoff`. Downstream consumers filtering on one name lose the events emitted by the other. `daily_reconciliation` readiness-% was already silently under-counting transitions from the leader-tap path.

This is the third documented occurrence of the same architectural bug:

- **2026-04-16 Web Perf council** — three concurrent write paths with authority divergence on mutations.
- **2026-04-18 Wave 2 gate-client council** — three concurrent write paths diverging in authority + telemetry (L-0054, L-0055).
- **2026-04-22 Council 2 (this one)** — four concurrent write paths diverging in event name + emit target set.

The pattern keeps resurfacing because each writer was added in a separate sprint, by a different author, and each was reasonable in isolation. The aggregate is the defect.

## Discovery

Any state transition whose *timing* isn't strictly tied to a single actor (e.g. "sessions close themselves at pre_close + grace, unless a leader closes them early, unless the Event Engine advances the process") will accrete writers over the lifetime of the feature. The first writer is the Server Action (human-initiated). The second is the DB trigger (reactive to sibling row changes). The third is the cron (safety net for orphans). The fourth is the process engine (state-machine advance). Each arrives as a "small fix." None consolidate.

Three specific failure modes observed:

1. **Event-name drift** — different writers emit different event names for the same logical transition. Consumers filter one and miss the others.
2. **Emit-target drift** — one writer hits PostHog + logger + activity_trail + engine_event, another hits only engine_event (because it's a DB trigger and was never wired through the emit registry).
3. **Authority drift** — one writer gates via `gate_action`, another doesn't (because it's a cron with no actor). `gate_evaluation` rows exist for some transitions, not for others, fracturing the audit trail.

The test for "is this a triple-writer situation?" is not "count writers"; it's "ask: if I change the event name or add a new emit destination, which files do I have to edit?" If the answer is >1, the pattern is present.

## Impact

- **ADR-0187 (proposed, this council):** Single-emitter invariant for `department_session.status` transitions. DB trigger becomes the sole emitter, fanned out through the emit-registry. Application-level emits (cron, Server Action, engine_process step) are removed; those paths only UPDATE the column and rely on the trigger to produce the event. One event name, one emit target set, one authority gate (see L-0110).
- **Design rule added:** When designing any new state transition, the author must explicitly answer "who else writes this state today?" Grep across `supabase/migrations/` (triggers), `supabase/functions/` (cron + edge writers), `apps/web/**/_actions/` (Server Actions), and `engine_process` seed migrations (process steps).
- **Council gate:** Two existing writers = consolidation is the correct immediate work. A third writer added on top is a defect, not a feature.
- **Pattern promotion:** 3rd occurrence across distinct campaigns — promoted from advisory to enforced. Next council touching a multi-writer transition must cite this learning and produce a consolidation plan before extending.

## References

- ADR-0187 (proposed — single-emitter invariant for `department_session.status`)
- Learning-0054 (Gate-Client Wave 2 — three concurrent write paths, prior occurrence)
- Learning-0055 (pilot-establishing trap — related pattern-inversion risk)
- `supabase/functions/session-lifecycle/index.ts:94-113`
- `supabase/migrations/20260428100400_session_pending_signoff_trigger.sql`
- `supabase/migrations/20260507100100_seed_department_session_lifecycle.sql:112-144`
- `apps/web/src/app/dashboard/_actions/signoff-session-action.ts:102-127`
- Council 2 verdict, 2026-04-22 daily-operation session

---

> Registered in `docs/learnings/0000-learning-log.md`.
