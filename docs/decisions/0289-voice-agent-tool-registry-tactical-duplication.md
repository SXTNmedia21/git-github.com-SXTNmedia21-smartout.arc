---
title: "Voice-Agent Tool Registry — Tactical Duplication, R1.3 Closure"
id: ADR-0289
status: proposed
layer: decision
created: 2026-05-06
updated: 2026-05-06
---

# ADR-0289: Voice-Agent Tool Registry — Tactical Duplication, R1.3 Closure

## Context and Problem Statement

As of the ADR-0282 R1.1 cutover (2026-05-06), the LiveKit voice-agent
(`services/voice-agent/src/`) maintains a parallel, hardcoded tool array built
by `adapter.ts:buildAllBotssonTools()`. This array is composed from four local
modules (`tools-orb.ts`, `tools-personal.ts`, `tools-capability.ts`,
`tools-schedule.ts`) and is completely disconnected from the authoritative
capability registry at `packages/ai/src/capabilities/registry.ts`.

The browser Ultravox path (still initialized in `BotssonProvider.tsx:useAgent`)
uses a second parallel array built from `BotssonTools.ts:buildBotssonToolKit()`
+ `useRegisteredTools()` from the Botsson tool-registry.

The single authoritative source mandated by the Pontus corrected mental-model
brief (2026-05-06 §3) is `packages/ai/src/capabilities/registry.ts`. Both
runtimes should derive their tool surface from this source.

## Decision Drivers

- Pontus brief §3 (2026-05-06): "Ingen hardkodet array av tool-definisjoner i
  runtime-koden. Ingen parallelle lister."
- ADR-0282 R1.3: capability-registry-driven tool exposure for both runtimes is
  the committed end-state.
- Fase 4 sortie scope is schedule-domain only (V0). Consolidating the registry
  now would require migrating 22 voice-agent tools + 16 browser tools in one
  move — out of scope and high-risk mid-sortie.
- Proposal-pipeline (Fase 4) adds three new `propose_*` tools to the
  voice-agent array. These are the last deliberate additions to the parallel
  list before R1.3 consolidation.

## Considered Options

1. **Option A — Tactical duplication, R1.3 closure (this ADR):** Ship Fase 4
   with parallel tool arrays. Freeze further additions to the parallel list
   after `propose_create_shift`, `propose_update_shift`, `propose_delete_shift`.
   R1.3 consolidates both runtimes to registry-driven.

2. **Option B — Consolidate now:** Refactor all 22 voice-agent tools + 16
   browser tools to registry-driven before Fase 4 lands. Blocks schedule
   proposal pipeline by 1-2 weeks. Risk: mid-sortie architecture change on an
   untested path.

3. **Option C — Defer indefinitely:** Accept permanent duplication. Violates
   the corrected mental model and ADR-0282 R1.3 commitment.

## Decision Outcome

Chosen option: **Option A — Tactical duplication, R1.3 closure.**

Fase 4 (schedule proposal pipeline + auth fix) ships with parallel arrays.
R1.3 is the binding closure point. Any capability added to
`packages/ai/src/capabilities/registry.ts` after Fase 4 MUST also be evaluated
for manual inclusion in `tools-capability.ts` until R1.3 lands. This evaluation
is the harness-builder's responsibility per the Verification Checklist.

**Rotation note:** `BOTSSON_SERVICE_JWT` minted as part of Fase 4 auth fix.
Rotation due: mint date + 25 days. Stored at `op://smartout_ai/botsson-service-jwt/value`
(dev) and `op://smartout_ai_prod/botsson-service-jwt/value` (prod). Add calendar
reminder at mint time.

## Rules & Consequences

- **Good, because** Fase 4 ships without multi-week consolidation risk. Schedule
  proposal pipeline unblocked.
- **Bad, because** any new capability added to the registry is silently invisible
  to the voice-agent until R1.3. Harness-builder must manually mirror in
  `tools-capability.ts`.
- **Agent Impact:** Do NOT add new tool arrays to `services/voice-agent/src/`
  beyond the three `propose_*` tools introduced in Fase 4. All additions after
  Fase 4 must wait for R1.3 registry-driven wire. R1.3 closure: delete
  `tools-orb.ts`, `tools-personal.ts`, `tools-capability.ts`,
  `tools-schedule.ts` from voice-agent and replace with a registry adapter that
  maps `CapabilityDefinition.readOnlyTools` → `llm.ToolContext` at session start.

---

> Registered in `docs/decisions/0000-decision-log.md` 2026-05-06.
> Linked to ADR-0282 (voice plane consolidation).
> Closure: when R1.3 lands, update this ADR status to `superseded` and cite the
> implementing commit.
