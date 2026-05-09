---
title: "channel_event vs engine_event boundary"
id: ADR-0160
status: accepted
layer: decision
created: 2026-04-19
updated: 2026-04-20
---

# ADR-0160: `channel_event` vs `engine_event` boundary

## Context and Problem Statement

Two immutable event tables coexist with overlapping shapes: `engine_event` (Event Engine bus, dispatcher-consumed) and `channel_event` (Komm lifecycle log, flagged dead since 2026-04-13 council — ADR-0087). Both have `workspace_id`, `payload JSONB`, `correlation_id`, `created_at`. Without an explicit boundary rule, developers pick whichever feels closer — leading to duplicate writes, missed consumers, or silent divergence. The helpdesk feature (ADR-0161) becomes the first real consumer of `channel_event` and forces this decision.

## Decision Drivers

- ADR-0087 names `channel_event` as C2-output destination but never defines its relationship to `engine_event`.
- `channel_event` has zero consumers (verified 2026-04-13 council); 90-day deadline expires 2026-07-13.
- Helpdesk state transitions (open → assigned → resolved) belong somewhere, not both places.
- Event Engine dispatcher reads `engine_event`, not `channel_event` — routing divergence risk.
- Future cascade-consumer features will copy whatever pattern helpdesk sets.

## Considered Options

1. **channel_event is the projection of engine_event into Komm-UI-space** — Every state transition writes `engine_event` (authoritative), and a trigger or subscription projects relevant ones into `channel_event` for Komm-rendering.
2. **channel_event is authoritative for Komm-scoped lifecycle; engine_event is cascade-scoped only** — Strict domain split. Komm UI reads `channel_event`; cascade dispatcher reads `engine_event`. Some events (e.g., desk_query.opened) dual-write.
3. **Drop `channel_event`, route everything through `engine_event`** — Close the dead-infra deadline by removal. Komm queries `engine_event` with a channel-scoped filter.

## Decision Outcome

Chosen option: **Option 1 — `channel_event` is the projection of `engine_event`.**

Rationale:
- `engine_event` remains the single source of truth for every state-bearing mutation (no dual-write race).
- `channel_event` becomes a materialized view / trigger-populated projection optimized for Komm's per-channel timeline reads.
- Preserves ADR-0087 intent ("Communications as cascade consumer") — Komm reads a projection, never queries cascade directly.
- Closes the dead-infra deadline with a real consumer, not by deletion.
- Matches existing pattern: `call_log` is an immutable projection of `channel_call_session` (ADR-0058 lineage).

## Rules & Consequences

- **Good, because:** single source of truth (`engine_event`); Komm-rendering performance isolated from cascade-query load; future cascade-consumer features follow the same projection pattern.
- **Good, because:** dead-infra deadline from 2026-04-13 council is closed with a real wiring, not a delete.
- **Bad, because:** eventual consistency window between `engine_event` INSERT and `channel_event` projection (accepted — Komm UI already tolerates realtime delay).
- **Bad, because:** two tables to keep in sync via trigger; trigger failures must alarm.
- **Agent Impact:**
  - Mutations emit to `engine_event` via `emit()` (unchanged).
  - Komm read paths query `channel_event`, never `engine_event` directly.
  - Projection trigger must be written in the helpdesk migration (ADR-0161) and becomes the template for future cascade-consumer features.
  - Any feature querying both tables = review red flag (suggests missing projection rule).

## Open Questions

- Does the projection include ALL `engine_event` rows with `workspace_id` + optional `channel_id`, or only a whitelist of event types? Recommend: whitelist, enumerated in projection-trigger migration.
- Should `channel_event` have `engine_event_id` FK for traceability? Recommend: yes.

---

> Write the projection trigger as part of ADR-0161 migration. Register this ADR in `0000-decision-log.md`.
