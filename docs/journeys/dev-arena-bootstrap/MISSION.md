---
title: "Dev Arena Bootstrap (Phase 0 dummy mission)"
mission_id: dev-arena-bootstrap
phase: 0
persona: harness-builder
created: 2026-04-29
updated: 2026-04-29
---

# Dev Arena Bootstrap

Smoke-test mission for the heartbeat-dispatcher → mission-pool pipeline.
Worker runs three dummy stages and emits the canonical 4-event journey
trace. No external side effects, no LLM calls, no capability invocations.

## Stages

1. **Acknowledge dispatch** — proves notify reached worker.
2. **Mid-step probe** — proves multi-step traversal increments correctly.
3. **Terminal** — proves status flip to `complete` + `journey completed`
   emit.

## Success criteria

- engine_state.status transitions: scheduled → pending → active → complete.
- engine_event sequence: run_started, step_reached, step_reached, completed.
- dispatch_lock_id is non-null after pickup.

## Acceptance

`apps/e2e/tests/harness-candidate-0-crown.spec.ts` green 3× consecutive.
