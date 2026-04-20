---
title: "engine_state as Coordination Spor, Not Truth Owner"
id: ADR_0098
status: accepted
layer: decision
created: 2026-04-15
updated: 2026-04-15
module: event-engine
tags: [adr, event-engine, engine-state, cascade, scale]
---

# ADR-0098: engine_state as Coordination Spor, Not Truth Owner

**Status:** Accepted
**Date:** 2026-04-15

## Context and Problem Statement

Council surfaced a subtle disagreement: Supervisor framed Event Engine as "the canonical lifecycle coordinator" (suggesting EE owns lifecycle state). Steward and Coordinator clarified: `engine_state` is an *orchestration track*, while domain tables own truth at each layer (per ADR-0095). Without an explicit ADR, future developers will treat `engine_state.context` as a source of truth and produce a sixth parallel state representation. Coordinator also raised a scale risk: one long-lived `engine_state` per shift would yield 3000–7000 active rows for a mid-size hospitality workspace.

## Decision Drivers

- Truth integrity: a question like "what are this shift's actual hours?" must be answered by `shift_hour_interpretation` (Interpretation layer), not by reading `engine_state.context`.
- Scale: `engine_state` table must remain queryable with sub-second response under realistic load.
- ADR-0056: cascade produces, Event Engine consumes — EE never becomes the producer.

## Decision Outcome

**`engine_state` is coordination only.** Rules:

1. **Coordination-only payload:** `engine_state.context` may store wait-event keys, step-progress markers, and dispatch metadata. It must not store domain facts (hours, costs, statuses) that have an authoritative table.
2. **Lifespan matches coordination need.** `engine_state` rows exist only while active coordination is in progress:
   - Long-running per-aggregate processes (e.g. `daily_close` per department-day) — acceptable; ~hundreds of rows steady-state.
   - Per-shift lifecycle transitions (`shift_lifecycle_v1`) are short-lived (minutes to hours, completing per transition); not one row per shift for the shift's whole life.
   - A shift in steady state ("published, awaiting punch-in") holds NO `engine_state` row. Status lives in `schedule_shift.status`. EE is invoked only when an event arrives.
3. **TTL and archive.** Completed `engine_state` rows are moved to `engine_state_archive` after 30 days via scheduled job. The archive is queryable for audit; the live table stays small.
4. **Re-derivation contract:** if all `engine_state` rows were lost tomorrow, every shift's *layer truth* would still be answerable from domain tables. Only in-flight coordination would need to be re-triggered.

## Rules & Consequences

- **Good, because** scale stays bounded (~500 active rows projected), truth stays in domain tables, recovery from EE incidents is local.
- **Bad, because** developers tempted to "just stash this in `engine_state.context` for now" need discipline; PR review must catch domain-fact leakage into context.
- **Agent Impact:** when reading shift status, the agent queries domain tables (or `v_shift_lifecycle` view, when available). It never reads `engine_state.context` to answer domain questions.

## Related ADRs

- ADR-0056 — cascade/EE boundary.
- ADR-0042 — engine memory + authority config.
- ADR-0095 — Five-Layer Architecture (defines truth ownership per layer).
