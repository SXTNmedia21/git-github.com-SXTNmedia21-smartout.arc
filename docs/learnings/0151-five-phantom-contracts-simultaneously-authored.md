---
title: "Five Phantom Contracts Simultaneously Authored"
id: LEARNING_0151
status: canonical
layer: learning
created: 2026-04-28
updated: 2026-04-28
tags: [phantom-contract, doc-consolidation, council, journey-engine, adr-0196]
---

# Learning-0151: Five Phantom Contracts Simultaneously Authored

## Context

2026-04-28 journey-engine doc consolidation (commits `d66dc0c1` + `0c8a5765`) shipped after the 2026-04-27 campaign closure council. Two days, two commits, doc-only on the surface. Council 2026-04-28 reviewed the consolidation with all 4 reviewers (Steward, Supervisor, Agent-Coordinator, Harness Builder) finding **5 ADR-class contracts authored simultaneously without ADR registration**:

1. `journey.rescued` telemetry event (zero writers, zero readers, not in registry)
2. `MISSION.md` schema with 7 fields not in `engine_missions` columns
3. `ROADMAP.md` schema with no code consumer
4. FLOW.md schema with examples violating ADR-0175 frozen-5
5. 13-file folder materializer + approve-op DB write claim violating ADR-0176

Trust-gate score: **0 of 7 contracts pass**. Worst across 4 trust-gate precedents (Year Wheel 2026-04-13, Web Perf 2026-04-16, Post-Audit Mobile 2026-04-17, Session Recorder 2026-04-22).

## Discovery

Doc consolidation work has a recurring failure mode: when an author moves files into a unified package, the impulse to "lock down the contract" produces NEW contracts that fill perceived ontological gaps. Each new contract is plausible in isolation. Reviewed in aggregate, they form a phantom-contract surface area larger than the campaign's own implementation could honor.

Pattern signature:
- Doc PR adds N new schemas across multiple files
- Each schema reads as "obviously needed" given the package's stated purpose
- Code-trace of EACH contract → zero writer OR zero reader OR both
- Author flags some-but-not-all as "open items" in §"Open questions"
- Zero ADRs registered

This is identical in shape to L-0094 (phantom emit, original) but at higher scale: instead of 1 capability emitting without artefact, it's 5 schemas without consumers.

## Impact

**Detection rule (promotion candidate):** any docs-only PR that introduces ≥ 2 new schemas, fields, or events MUST run a code-trace gate before merge. Each schema must answer: "what writes this?" and "what reads this?" If either answer is "future", the contract gets an `INTENT, NOT IMPLEMENTED` banner — not a §9 footnote.

**Process change:** Council `Phase 2.5` fact-check now includes "schema-trace": for every YAML schema introduced in a doc PR, grep for at least one writer + one reader in code. If both fail, schema must carry intent banner.

**Trust-gate precedent #5:** the four prior trust-gate precedents (Year Wheel, Web Perf, Post-Audit, Session Recorder) all involved code mutations. This one involves docs only — proving phantom-contract risk lives in spec authoring, not just code authoring. Trust-gate now applies to spec PRs whenever new schema/event/capability surface area is introduced.

**Author guidance:** docs consolidation must distinguish between (a) renaming/moving existing contracts (zero new surface area) and (b) introducing new contracts (must verify pipeline). Mixing both in one commit is the trap — review can't separate which schemas are new.

## References

- Council 2026-04-28 (`docs/council/COUNCIL-LOG.md`)
- ADR-0222 (Journey-Protocol Op Pipeline)
- ADR-0223 (Journey Rescue Path Reconciliation)
- ADR-0224 (engine_missions vs MISSION.md)
- ADR-0225 (FLOW.md as Intent Doc)
- ADR-0196 Invariant 11 (no phantom capabilities)
- L-0094 (phantom emit, original — 5th occurrence promoted to ADR-0197)
- L-0146 (phantom-consumer pattern)
- 4 prior trust-gate precedents: 2026-04-13 / 2026-04-16 / 2026-04-17 / 2026-04-22

---
