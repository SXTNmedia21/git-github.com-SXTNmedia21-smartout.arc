---
title: "Botsson as Conversational Front Door, Not Cascade Orchestrator"
id: ADR-0220
status: accepted
layer: decision
created: 2026-04-28
updated: 2026-04-28
accepted: 2026-04-28
---

# ADR-0220: Botsson as Conversational Front Door, Not Cascade Orchestrator

## Context and Problem Statement

The brainstorming strawman for /dashboard/help (Q3) proposed "Botsson as orchestrator — all entries route through Botsson; Botsson chooses speak / show article / start tour / create ticket." Five council reviewers responded with three different verdicts because the word "orchestrator" admits three distinct readings:

1. **Literal router** — Botsson decides which capability runs (replaces `agent-router`).
2. **Conversational front door** — user types in Botsson hero, intent is detected, capability fires (current behavior).
3. **Cross-runtime conductor** — chat + voice + UI takeover unified through one Botsson session.

Reading 1 contradicts ADR-0073 (`agent-router` already orchestrates). Reading 3 is unbuildable in v1 — system-agent-coordinator's code-trace proved Botsson is three disconnected runtimes (Stage Engine `/api/botsson/chat`, Ultravox client tools, dead `runBotssonAgent`) that share no state. Reading 2 is what the platform already does and is what the rescoped /help v1 ships.

This ADR locks the term so future specs do not regress.

## Decision Drivers

- Three readings caused a council to fragment. Future specs will fragment the same way unless terminology is fixed.
- ADR-0073 establishes `agent-router` as the orchestrator. A second orchestrator would be ontologically wrong.
- System-agent-coordinator's three-runtime finding (Phase 3) means cross-runtime "transparent orchestration" requires platform-level architecture work currently at D4 (Phase 12+ weeks). Banning the term in v1 specs prevents accidental promise of D4-dependent behavior.
- L-0148 (this council) names "orchestrator" as a trap word.

## Considered Options

1. **Accept "orchestrator" as informal shorthand** — let context disambiguate. Risk: future specs continue to fragment.
2. **Ban "orchestrator" without modifier** — require specs to use one of three precise terms.
3. **Define orchestrator narrowly = Reading 2 only** — rename Reading 1 to "router" and Reading 3 to "cross-runtime bridge".

## Decision Outcome

Chosen option: **Option 2 — ban "orchestrator" without modifier**.

Specs touching Botsson MUST use one of:

- **"Conversational entry point"** — when describing Botsson chat as user-facing input surface.
- **"Intent classifier"** — when describing the `agent-router`'s pre-capability classification step (per ADR-0073).
- **"Cross-runtime bridge"** — when describing hypothetical (D4) chat+voice+DOM unification.
- **"Router" / "agent-router"** — when describing the existing `services/stage-engine/src/core/agent-router.ts`.

The bare word "orchestrator" is forbidden in new specs touching Botsson, capabilities, or stage-engine. Existing ADRs that use it (ADR-0073, ADR-0099) keep their text — those usages are anchored to Reading 1 and disambiguated by surrounding context.

## Rules & Consequences

- **Good, because** new specs cannot accidentally promise D4-dependent behavior in a v1 surface.
- **Good, because** code-tracing reviewers (system-agent-coordinator, botsson-harness-builder) will catch any "orchestrator" term in fact-check pass and force disambiguation before Phase 3.
- **Good, because** preserves ADR-0073's existing orchestrator semantics without rename churn.
- **Bad, because** disambiguation adds verbosity to specs. The trade-off is worth it given the runtime split is permanent v1 reality.
- **Bad, because** non-Smartout audiences (investors, new hires) may find "conversational entry point" stilted. Marketing copy may continue using "AI assistant" or similar — this ADR governs specs, not landing pages.
- **Agent Impact:**
  - Council fact-check (Phase 2.5) MUST flag any "orchestrator" usage in briefings touching Botsson and demand the precise reading.
  - System-steward Phase 5 synthesis MUST classify Q&A items mentioning "orchestrator" as PARTIAL OVERLAP until terminology is resolved.
  - Spec templates updated to reference the three precise terms.

## References

- Council 2026-04-28 (System Council, 5 reviewers)
- ADR-0073 — agent-router as orchestrator (anchors Reading 1 semantics)
- ADR-0078 — engine_process channel restriction (voice/PII forbidden — affects Reading 3)
- L-0148 — "Orchestrator" trap word in AI specs (this council)
- system-agent-coordinator Phase 3 finding: three Botsson runtimes (Runtime A `/api/botsson/chat`, Runtime B `BotssonTools.ts` Ultravox, Runtime C `runBotssonAgent` dead code)
