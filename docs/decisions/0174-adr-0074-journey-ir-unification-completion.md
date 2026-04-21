---
title: "ADR-0074 Protocol Verification Engine unification completion — JourneyIR as single source"
id: ADR_0174
status: proposed
layer: decision
created: 2026-04-21
updated: 2026-04-21
---

# ADR-0174: ADR-0074 Protocol Verification Engine unification completion — JourneyIR as single source

## Context and Problem Statement

ADR-0074 (Protocol Verification Engine) established that Mission, Docs, and Audit generators in `apps/e2e/generators/` share a protocol primitive. The Journey Runner Suite v1.6.0 proposes a different primitive — JourneyIR — and never reconciled whether the existing generators (`mission-generator.ts`, `docs-generator.ts`, `audit-generator.ts`) are retargeted to JourneyIR or whether a second parallel system emerges. Two parallel systems = graveyard (L-0044 parity framing).

## Decision Drivers

- ADR-0074 generators are already building dual-source-of-truth pressure — any new primitive that does not subsume them creates a third source.
- JourneyIR is strictly more expressive than the protocol structure (inference-pattern registry, step annotations for authority/telemetry).
- Migration cost is bounded — the three generators share a single input shape; swap the input loader.

## Considered Options

1. **Retarget ADR-0074 generators to consume JourneyIR** — single primitive, three emit modes (Mission, Docs, Audit).
2. **Keep ADR-0074 generators on protocol; JourneyIR runs in parallel** — two systems.
3. **Deprecate ADR-0074 generators; JourneyIR re-implements from scratch** — lose tested generator code.

## Decision Outcome

Chosen option: **"Retarget ADR-0074 generators to consume JourneyIR"**, because keeping a single source eliminates the "which one do I write?" decision for future authors, and the generators' emit logic is reusable verbatim once the input shape is unified.

Unification steps:
1. JourneyIR becomes the single input to `mission-generator.ts`, `docs-generator.ts`, `audit-generator.ts`.
2. Protocol-shaped inputs are accepted via a thin adapter `protocolToJourneyIR()` during migration window; adapter deleted after all protocols converted.
3. `apps/e2e/generators/` imports `@smartout/journey-ir` types.
4. ADR-0074 status remains `accepted` but gets an amendment addendum referencing this ADR as the completion event.

## Rules & Consequences

- **Good, because** one primitive to learn, one set of tests to maintain, one changelog.
- **Good, because** future generators (changelog, release-notes, audit-diff) get JourneyIR input for free.
- **Bad, because** migration window requires adapter code — small added surface temporarily.
- **Agent Impact:** New mission/doc/audit generators must target JourneyIR. Do NOT re-introduce the protocol shape in new code. ADR-0074 must be read together with this ADR during any generator work.

---

> After writing: register in `docs/decisions/0000-decision-log.md` and update the ADR table in `CLAUDE.md`.
