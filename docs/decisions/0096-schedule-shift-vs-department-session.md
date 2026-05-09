---
title: "schedule_shift vs department_session — Formal Relation"
id: ADR-0096
status: accepted
layer: decision
created: 2026-04-15
updated: 2026-04-15
module: schedule
tags: [adr, schedule, session, d6, execution-layer]
---

# ADR-0096: schedule_shift vs department_session — Formal Relation

**Status:** Accepted
**Date:** 2026-04-15

## Context and Problem Statement

Both `schedule_shift` and `department_session` exist in D6 Execution layer. Neither references the other via foreign key. Code paths sometimes treat one as the parent of the other inconsistently. Without a formal relation, the Five-Layer architecture (ADR-0095) cannot specify which one publishes lifecycle events vs. which one aggregates them.

## Decision Drivers

- Five-Layer architecture requires unambiguous ownership of lifecycle events per layer.
- `daily_close` engine_process listens for department-day completion; it must aggregate from a defined set.
- Mobile/web UI must know whether to render per-shift cards or per-session containers.

## Decision Outcome

**1 session : N shifts.** Formalized as follows:

- **`department_session`** is the operational window aggregate — one per (`workspace_id`, `department_id`, `session_date`). Owns: open/close, settlement, daily_reconciliation linkage.
- **`schedule_shift`** is the individual resource commitment within a session — N per session. Owns: publish, fill, punch lifecycle, approval.
- The relation is **derived** at query time via (`workspace_id`, `department_id`, `shift_date`), not enforced via FK. Sessions are computed from the planning pipeline; shifts are assigned independently.
- A shift without a matching session is a planning error and surfaces as a deviation at session-open time.

## Rules & Consequences

- **Good, because** clean separation: session-level events (open, close, reconciliation) vs shift-level events (publish, punch, approve) no longer collide.
- **Bad, because** the derived relation requires consistent indexing on (`workspace_id`, `department_id`, date columns) — already in place.
- **Agent Impact:** when emitting events, route session-aggregate concerns to `department_session_lifecycle` engine_process; route per-shift concerns to `shift_lifecycle_v1`. Never emit a "session closed" event from shift-level code.

## Related ADRs

- ADR-0095 — Five-Layer Architecture (this ADR formalizes Execution layer internal structure).
- ADR-0100 — `daily_close` consumes settled shifts within a session.
