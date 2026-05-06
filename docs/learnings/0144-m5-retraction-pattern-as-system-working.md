---
title: "M5 Retraction Pattern as System-Working-As-Designed"
id: LEARNING_0144
status: canonical
layer: learning
created: 2026-04-27
updated: 2026-04-27
tags: [retraction, trust-gate, council, process, phantom-contract, journey-engine, m5]
---

# Learning-0144: M5 Retraction Pattern as System-Working-As-Designed

## Context

Campaign `journey-engine` M5 experienced three retractions in five days (2026-04-22 to 2026-04-27):

- **R1 — Status vocab regression:** `journey_version_status` column reference to a non-existent column caught by Phase 2 audit; fixed in commits `36e1d8cc` (S8 fix) and `259a8014` (S9 spec column fix).
- **R2 — Mission resolution gap:** `publish_mission` body missing the `JourneyIR v2.1 → engine_missions` mapping; caught by Trust Gate Layer 2 column-trace; fixed via commits `2b88f1a5` + `c8e6e398` + `55bb28fb` (T5 build).
- **R3 — Stuck-detector dual-write paper contract:** `journey.stuck` event emitted by capability body with no dual-write path to `engine_delayed_trigger`; caught by Council Phase 5 fact-check; deferred per ADR-0215 (Option C, Phase 3 follow-up).

## Discovery

Every retraction was caught by the next-layer verification gate BEFORE production. None reached users. None produced false telemetry in `activity_trail`.

The catch mechanism for each:
- R1: Phase 2 capability audit grep + column-trace.
- R2: Trust Gate supervisor Layer 2 column-trace (ADR-0196 Invariant 11 gate).
- R3: Council Phase 5 synthesis cross-referencing ADR-0175 registered events against actual `execute()` bodies.

These are exactly the scenarios ADR-0196 Invariants 11 and 12, L-0094, L-0118, and L-0125 were authored to catch. Each retraction sharpened the gate that caught it: R1 improved the Phase 2 audit checklist; R2 confirmed that artefact-assertion E2E tests (not return-shape tests) are non-negotiable; R3 produced ADR-0215 and L-0130.

ADR-0215 explicitly cites the L-0094 4× recurrence pattern as the reason to DEFER the fix (Option C) rather than rush a Phase 3 implementation — because rushing under sprint pressure is the exact condition that produced R1, R2, and R3. The deliberate deferral is the gate working.

## What Would Be a Real Failure

A retraction found by users in production, with telemetry-emitted false signals reaching `activity_trail`, or with `engine_state` rows written that no consumer ever reads (phantom-consumer, L-0130). None of these three retractions crossed that line.

## Anti-Pattern to Avoid

Reading "M5 retracted 3× in 5 days" as process failure → frantic rush-fix that ships another phantom under sprint pressure. That reading inverts the signal. The retractions were SLOW + DELIBERATE catches, not emergency patches. Rushing to close them would replay L-0094's pattern for a 5th and 6th time.

## Process Implication

Future campaigns should EMBRACE post-implementation council review as the canonical verification system, not as a sign that upstream review was broken. The council-as-gate pattern (Phase 2 audit → Trust Gate → Council Phase 5 synthesis) is the three-layer defense, not a symptom of insufficient pre-implementation review.

Concretely: a campaign with zero council retractions and no post-implementation audit is MORE likely to have shipped phantoms than one with three clean retractions caught pre-production.

## References

- ADR-0196 (Journey Engine Invariants 11/12/13) — the gate that caught R2.
- ADR-0215 (stuck-detector strategy, 2026-04-27) — the formal deferral for R3; cites L-0094 4× recurrence.
- L-0094 (phantom emit contracts recurring) — the write-side phantom class pattern.
- L-0118 (every capability tool requires E2E trust-gate test) — artefact assertion requirement.
- L-0125 (test spirit vs letter) — return-shape tests are not artefact assertions.
- L-0130 (phantom-consumer pattern, 2026-04-27) — read-side phantom class; produced by R3's analysis.
- Council Phase 8 synthesis, 2026-04-27 — paragraph on M5 retraction pattern as system-working.

---

> After writing: register in `docs/learnings/0000-learning-log.md`.
