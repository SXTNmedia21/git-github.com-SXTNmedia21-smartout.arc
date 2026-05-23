---
title: "Procedure Engine Phase 1: routine scope + provenance triple + cron per-step expansion"
id: ADR_0391
status: accepted
layer: decision
created: 2026-05-22
updated: 2026-05-22
module: procedure-engine
---

# ADR-0391: Procedure Engine Phase 1 — routine scope, provenance triple, cron per-step expansion

## Context and Problem Statement

The procedure-engine (renamed from task-manager) makes the procedure the atomic truth, with
routine → session_task as the operational lens. Phase 1 needs routines that can be scoped to a
location + teams, materialized into per-step tasks by cron, and traced back to their origin.
Three load-bearing schema/runtime decisions were made together because they form one pipe.

## Decision Drivers

- "Én sannhet, flere visninger" — routine (template) and session_task (instance) must stay linked without duplication.
- Debuggability — a task with no provenance is undebuggable once it leaves its producing context.
- ADR-0367 single-area day_line model — tasks must anchor to a resolved day_line, never guess.
- Existing G6 bug — the cron `linked_routine_id` branch created 1 stub task instead of expanding procedure steps.
- Mobile parity — the data layer must support the Min dag chain (shift_session → day_line → session_task).

## Considered Options

1. **Scope routine via new columns + junction; stamp provenance on session_task; expand steps in cron** (chosen)
2. Scope routine only via existing `assigned_to_type/ref` (no location) — rejected: can't bind a routine to a physical location, breaks the timeline view.
3. Defer provenance to a later phase — rejected: retrofitting origin onto existing rows is the exact "brutal debugging later" trap; columns are nullable + cheap now.

## Decision Outcome

Chosen option: **Option 1**, implemented across 3 schema/runtime changes:

1. **Routine scope** — `routine.location_id`, `routine.workspace_id` (trigger-backfilled from protocol via `set_routine_workspace_id`), `routine.executor_type` enum (`human|ai|system|hybrid`, default `human`), plus `routine_team` junction (0..N teams; zero rows = location-wide / pickup). Full RLS (jwt read/manage, api_key read, service_role).
2. **Provenance triple** — `session_task.origin` (`task_origin`: session|adhoc|routine|procedure|projection|manual), `session_task.generated_by` (`task_generated_by`: cron|manager|agent|system), `session_task.source_reference` (FK-less uuid interpreted with origin). Nullable now; stamped by every producer.
3. **Cron per-step expansion** — session-hook-executor's `linked_routine_id` branch resolves `procedure_id`, reads `procedure_step` ordered, and inserts one `session_task` per step (not 1 stub), each carrying `day_line_id` (`fn_resolve_single_day_line`) + the provenance triple. The `linked_procedure_id` branch was also given provenance for consistency.

## Rules & Consequences

- **Good, because** routine binds to a real location + team set; every task is traceable to its producer; the G6 stub bug is closed; mobile Min dag has a clean chain.
- **Good, because** provenance columns are nullable + reuse — no backfill pain, no breaking change.
- **Bad, because** `source_reference` is FK-less (interpreted via `origin`) — a dangling reference won't be caught by the DB; consumers must tolerate stale refs.
- **Bad, because** routine.workspace_id is denormalized from protocol via trigger — a protocol re-parent would need a re-backfill (not expected in Phase 1).
- **Agent Impact:** Any new task producer MUST stamp the provenance triple. The cron expansion is the canonical pattern — mirror its `origin/generated_by/source_reference` shape. `fn_resolve_single_day_line` returns NULL for 0 or >1 active day_lines (ADR-0367) — never substitute a guess.
- **Reserved (Phase 2+):** The 4→2 task-table consolidation (council ship-C2-now / defer-D6) is NOT in this ADR — it gets its own ADR when D6 consolidation lands. Manual table, Sesjonsplanlegger canvas, prep-next-shift projection, M:N procedure↔protocol, version-history are deferred.

Refs: ADR-0298 (Task Ontology), ADR-0367 (day_line area-anchored runtime), ADR-0151 (server-derived identity), ADR-0134 (mobile telemetry contract), L-0177 (fail-fast on row-not-found). Spec: `docs/superpowers/specs/2026-05-22-procedure-engine-design.md`. Plan: `docs/superpowers/plans/2026-05-22-procedure-engine-phase-1.md`.

---

> Registered in `docs/decisions/0000-decision-log.md`.
