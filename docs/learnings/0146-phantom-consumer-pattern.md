---
title: "Phantom-Consumer Pattern (Symmetric Twin of L-0094)"
id: LEARNING_0146
status: canonical
layer: learning
created: 2026-04-27
updated: 2026-04-27
tags: [phantom-consumer, capability, engine_state, stage-engine, fjernkontroll, adr-0216, l-0094, journey-engine]
---

# Learning-0146: Phantom-Consumer Pattern (Symmetric Twin of L-0094)

## Context

Council Phase 8 (2026-04-27) identified 2 instances of capability tools writing to tables without a worker or consumer that reads those writes to advance system state:

- **Instance 1 (Steward C5 finding):** `journey.run_dev` writes `journey_run` rows. No cloud worker dequeues from `journey_run` to execute the Playwright run. The capability returns `{ok:true}` with a `run_id` referencing a row that nothing processes.
- **Instance 2 (Harness Candidate 1 finding):** `journey.run_guided` writes `engine_state` and `engine_state_step` rows. Stage-engine reads `engine_sessions`, not `engine_state`. The Fjernkontroll UI subscribes to terminal events (`journey.completed`, `journey.stuck`, `journey.run_failed`) that no capability tool or stage-engine step emits today.

Both cases are documented in `docs/audits/PHASE-2-CAPABILITY-AUDIT-2026-04-27.md`.

## Discovery

This is the symmetric twin of L-0094 "phantom emit contracts." The two failure modes form a pair:

**L-0094 — phantom-write (produce-side):** A capability or spec claims to have done work and emits a telemetry event to signal completion, but nothing was written. The event is the phantom — the telemetry signal exists without a corresponding artefact.

**L-0146 — phantom-consumer (consume-side):** A capability DID write the work faithfully to a DB table. But nothing reads that table to advance system state. The DB row is the phantom — the data exists without a corresponding consumer that acts on it.

Both shapes survive the same review gaps:
1. Reviewers see the `supabase.from(...).insert(...)` call — DB write looks wired.
2. Reviewers do NOT trace what reads the written row and what that reader produces.
3. TypeScript does not enforce that a written table has a registered consumer.
4. Tests assert the DB row exists post-call; they do not assert that the consumer advances state.

The phantom-consumer pattern is caught only by capability-consumer Layer 4 trace — the same four-layer trace that L-0094 requires on the emit side.

## Falsifiable Test Pattern

For every new capability tool that writes a DB row, the capability council review MUST answer:

1. **Name the consumer** — what code reads this table and advances state? (e.g., a background worker, stage-engine step, BFF route, Fjernkontroll subscription)
2. **Name the read-side test** — what test asserts that the consumer correctly advances state after the capability writes the row?

If neither question can be answered, the capability is half-built. The correct response is `{ok:false, error:'not_implemented'}` per ADR-0196 Invariant 11 — not `{ok:true}` with a silent phantom row.

## Two Shapes of the Same Anti-Pattern

| Pattern | Failure | Detection |
|---|---|---|
| L-0094 phantom-emit-contracts | Producer claims work done; nothing was written | ADR-0196 Invariant 11 grep gate + E2E artefact assertion |
| L-0146 phantom-consumer-pattern | Producer DID the work; nothing reads it | Capability-consumer Layer 4 trace; consumer-existence check in review |

## Recommendation

**ADR-0216 (proposed, this session)** is the architectural response for the `engine_state` vs `engine_sessions` ontology gap (Instance 2). Until that ADR is accepted, `journey.run_guided` is explicitly operating with a known phantom-consumer on its `engine_state` write path.

Extend ADR-0196 Invariant 11 OR add Invariant 14 capturing the consumer side:
> *Invariant 14 (proposed): Every capability tool whose `execute()` writes a DB row MUST name the consumer that reads the row in the capability's ADR or inline docstring. The named consumer must have a test that asserts state-advancement. Capability review template gains "name the consumer + cite the read-side test" as a mandatory field.*

Capability review template addition (all future capabilities):
```
Consumer: <table name> → <consumer code path> → <state it advances>
Read-side test: <test file:line that asserts consumer state-advancement>
```

## Concrete Next Steps

- **B1 backlog:** Decide engine_state vs engine_sessions ontology (ADR-0216 council vote).
- **B2 backlog:** Ship N-C worker for `journey_run` table OR rescope `journey.run_dev` to local-only (no DB write; Playwright process is the artefact).
- **Invariant 14:** Open an ADR extending ADR-0196 with the consumer-existence requirement after B1 closes.

## References

- L-0094 (phantom emit contracts recurring, 2026-04-21) — the write-side twin.
- ADR-0196 (Journey Engine Invariants 11/12/13) — Invariant 11 as currently defined (write-side only).
- ADR-0216 (engine_state vs engine_sessions ontology, 2026-04-27) — architectural response to Instance 2.
- `docs/audits/PHASE-2-CAPABILITY-AUDIT-2026-04-27.md` — source evidence for both instances.
- Council Phase 8 synthesis, 2026-04-27 — Steward C5 + Harness Candidate 1 conflict resolution.
- L-0144 (M5 retraction pattern, 2026-04-27) — the context in which both instances surfaced.

---

> After writing: register in `docs/learnings/0000-learning-log.md`.
