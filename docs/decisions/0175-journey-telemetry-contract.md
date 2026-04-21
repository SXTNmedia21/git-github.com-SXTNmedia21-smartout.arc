---
title: "Journey telemetry contract — five registered emit events"
id: ADR_0175
status: proposed
layer: decision
created: 2026-04-21
updated: 2026-04-21
---

# ADR-0175: Journey telemetry contract — five registered emit events

## Context and Problem Statement

Spec v1.6.0 referenced `journey.completed`, `journey.stuck`, `journey.step_reached` as canonical events. Zero matches in `packages/telemetry/src/registry.ts`. Per ADR-0134 (Mobile Telemetry Contract) and L-0059 (phantom emit contracts), any mutation surface that names an event without registering it has a phantom contract — the event is silently dropped by `emit()` and the mutation looks like it succeeded.

## Decision Drivers

- ADR-0134 mandates every mutation resolves `workspace_id` + `actor_id` non-null and routes through registered emit.
- L-0083 (2026-04-20) already flagged `helpdesk.query.reassigned` as a phantom contract; journey spec was writing the same failure mode.
- Mission/Docs/Audit generators need to read journey run state — if events aren't recorded, analytics + monitoring are blind.

## Considered Options

1. **Register five events** covering the full journey lifecycle (run start, step reached, completed, stuck, run failed).
2. **Register three** (`completed`, `stuck`, `step_reached`) only — match spec.
3. **Defer registration** until implementation lands — accept phantom window.

## Decision Outcome

Chosen option: **"Register five events"**, because three events do not cover the run lifecycle — callers need `run_started` for cohort analysis (how many dev runs never finish?) and `run_failed` distinct from `stuck` (failure is terminal, stuck is recoverable).

Canonical registry additions (`packages/telemetry/src/registry.ts`):

| Event name | Trigger | Required payload |
|---|---|---|
| `journey.run_started` | Runner first step executes | `journey_version_id`, `run_id`, `mode` (`dev` \| `guided`), `workspace_id`, `actor_id` |
| `journey.step_reached` | Step enter, emitted once per unique step per run | `run_id`, `step_id`, `step_index`, `workspace_id`, `actor_id` |
| `journey.completed` | Runner reaches terminal step successfully | `run_id`, `duration_ms`, `workspace_id`, `actor_id` |
| `journey.stuck` | `journey-stuck-detector` classifies a live run as stuck | `run_id`, `stuck_at_step_id`, `threshold_ms`, `workspace_id`, `actor_id` |
| `journey.run_failed` | Runner throws or assertion fails | `run_id`, `failed_at_step_id`, `error_kind`, `workspace_id`, `actor_id` |

Destinations (all four): PostHog · Logger · `activity_trail` · `engine_event`.

## Rules & Consequences

- **Good, because** no phantom contract — every named event is resolvable at compile time.
- **Good, because** analytics can build funnels (started → completed) without inferring from absence.
- **Bad, because** five events is more surface to maintain; versioned payload schema required.
- **Agent Impact:** No new emit site may reference `journey.*` events not in this table. Amend this ADR before adding a sixth. Every consumer (PostHog dashboards, monitoring rules) must be re-verified after this lands.

---

> After writing: register in `docs/decisions/0000-decision-log.md` and update the ADR table in `CLAUDE.md`.
