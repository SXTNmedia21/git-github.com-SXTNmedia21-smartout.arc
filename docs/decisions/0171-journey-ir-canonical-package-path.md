---
title: "JourneyIR canonical package path — packages/journey-ir"
id: ADR-0171
status: accepted
layer: decision
created: 2026-04-21
updated: 2026-04-22
---

# ADR-0171: JourneyIR canonical package path — `packages/journey-ir`

## Context and Problem Statement

Spec `2026-04-21-journey-runner-suite-mental-model.md` v1.6.0 referenced both `packages/journey-ir` and `packages/ai/src/journey` as the home for the JourneyIR schema, inference-pattern registry, and generator consumption. Internal contradiction blocks Trust Gate — consumers (Playwright runner, Mission/Docs/Audit generators, Runtime agent-guided flow, mobile read-path) cannot import from a path that is simultaneously two paths.

## Decision Drivers

- Three consumer surfaces need the IR: Dev test-run (apps/web BFF), Mission/Docs/Audit generators (apps/e2e or packages/*), Runtime guided flow (agent capability).
- `packages/ai/src/journey` conflates IR schema with capability implementation — violates L-0061 (orphan capability code becomes invisible) by hiding shared schema under a capability-oriented path.
- `packages/journey-ir` mirrors `packages/telemetry`, `packages/billing`, `packages/ui` as a sibling-neutral shared package — consumable from both web and mobile without reaching into `packages/ai`.

## Considered Options

1. **`packages/journey-ir`** — dedicated shared package; schemas + inference-pattern registry + IR transforms exported from a single root.
2. **`packages/ai/src/journey`** — keep IR adjacent to capabilities.
3. **`apps/web/src/lib/journey`** — app-local; export nothing.

## Decision Outcome

Chosen option: **`packages/journey-ir`**, because IR is consumed by non-ai surfaces (e2e generators, Playwright runner, mobile read-path). Hosting it under `packages/ai` would force cross-package imports from apps/e2e just to read a schema, and would violate ADR-0133's "web composes, mobile executes" boundary once mobile needs to render a guided-journey card.

Capability implementation for Journey (tools, authority wiring, emit) still lives at `packages/ai/src/capabilities/journey/` and imports types from `@smartout/journey-ir`.

## Rules & Consequences

- **Good, because** IR is a first-class shared primitive — discoverable, testable in isolation, importable from any surface.
- **Good, because** inference-pattern registry can be linted and version-bumped independently of capability code.
- **Bad, because** adds one more workspace package (minor tooling cost).
- **Agent Impact:** Any spec or plan that references JourneyIR must import from `@smartout/journey-ir`. No inlined schemas in consumer packages. `packages/ai/src/journey` is forbidden — remediate if encountered.

---

> After writing: register in `docs/decisions/0000-decision-log.md` and update the ADR table in `CLAUDE.md`.
