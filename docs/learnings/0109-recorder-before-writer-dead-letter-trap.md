---
id: L-0105
title: "Recorder-before-writer is a dead-letter trap"
status: accepted
date: 2026-04-22
module: MODULE_BOTSSON
tags: [learning, observability, recorder, phase-sequencing, trust-gate]
---

# L-0105 — Recorder-before-writer is a dead-letter trap

## Context
2026-04-22 council reviewed Session Recorder plan. Initial instinct: "bygg recorderen først, så kan vi debugge resten." System Steward forkastet dette med Agent Trust Gate FAIL.

## Learning

**Observability uten downstream konsumenter er teater.**

Hvis vi bygger Session Recorder *før* Phase 0-prereqs (A3 memory-writer + A5 agent-router context + A6 guardian-bus), da:

1. Recorder fanger `intent_input = ""` — A5-gapet blir usynlig skjult i data
2. Recorder fanger memory-ops, men writer eksisterer ikke — data lander i dead-letter uten konsument
3. Recorder fanger guardian-verdicts, men bus er in-process — cross-process konsumenter mangler

Data uten konsumenter er ikke "ready for future use" — det er **dead letters som masker rot-årsaken**. Neste developer ser "ser, vi har recorder" og antar systemet fungerer, fordi tomhet logges konsistent.

## Rule

**Før du bygger en observability-layer, verifiser at konsumentene eksisterer og producer-siden er fullstendig.** Order matters:

1. Writer (producer)
2. Reader (consumer)
3. Observer (recorder)

Ikke omvendt. Ikke parallelt uten tight gating.

## How to apply

- Når noen foreslår "bygg recorder først, så ser vi hva som er feil" → still motspørsmål: "hvilken producer er ufullstendig? Hvilken reader er ikke koblet?"
- Hvis noen av disse mangler → recorder blir inne i Phase 0 prereq-chain, ikke utenfor
- CI-gate: recorder-deploy blokkeres til alle producers/readers er grønne i `BOTSSON-SYSTEM-MAP.md`

## References
- Council verdict: `docs/council/COUNCIL-LOG.md` 2026-04-22
- Spec: `docs/superpowers/specs/2026-04-22-session-recorder-platform-admin-design.md` §3, §4 Phase 0
- ADR-0184 §Dependencies
