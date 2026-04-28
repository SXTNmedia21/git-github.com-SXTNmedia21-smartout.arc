---
title: "Orchestrator Is a Trap Word in AI Agent Specs"
id: LEARNING_0148
status: canonical
layer: learning
created: 2026-04-28
updated: 2026-04-28
tags: [terminology, council-process, run-council, ai-architecture, trap-word, botsson, agent-router]
---

# Learning-0148: "Orchestrator" Is a Trap Word in AI Agent Specs

## Context

Council 2026-04-28 reviewing /dashboard/help. Strawman Q3 proposed "Botsson as orchestrator — all entries route through Botsson; Botsson chooses speak / show article / start tour / create ticket."

Four of five reviewers responded with different verdicts on Q3, and the disagreement was traced to three different readings of "orchestrator":

1. **Literal router** — Botsson decides which capability runs (system-steward + system-agent-coordinator REJECTED on this reading: contradicts ADR-0073 which establishes `agent-router` as orchestrator).
2. **Conversational front door** — user types in Botsson hero, intent detected, capability fires (frontend-designer implicitly ACCEPTED on this reading: matches existing `/api/botsson/chat` behavior).
3. **Cross-runtime conductor** — chat + voice + UI takeover unified (botsson-harness-builder CONDITIONAL on this reading: depends on D4 page-takeover harness, 12+ weeks).

Phase 5 synthesis classified the disagreement as semantic, not substantive — three readings, three correct positions.

## Discovery

**"Orchestrator" without modifier is unsafe in AI agent specs.** It admits at least three distinct readings, and Smartout's runtime architecture has three implementations that map to those readings (`agent-router` is Reading 1; `/api/botsson/chat` user surface is Reading 2; D4 hypothetical is Reading 3). Any spec using the bare word will produce three verdicts.

The same trap applies to other generalist words in this domain:

- **"Router"** — alone is also ambiguous (intent classifier vs HTTP router vs message router).
- **"Agent"** — Botsson the user-facing assistant vs. an agent in agent-sdk vs. an agent persona in a multi-agent system.
- **"Conductor"** — synonym for orchestrator, same trap.
- **"Pipeline"** — ingest pipeline vs. data pipeline vs. CI pipeline.

## Impact

Codified in ADR-0220 (Botsson as Conversational Front Door). New rules for Smartout AI specs:

1. **Ban bare "orchestrator"** in new specs touching Botsson, capabilities, or stage-engine.
2. **Use precise terms:**
   - "Conversational entry point" — for user-facing chat input surfaces.
   - "Intent classifier" — for the `agent-router`'s pre-capability classification.
   - "Cross-runtime bridge" — for hypothetical (D4) unification.
   - "Router" / "agent-router" — for the existing `services/stage-engine/src/core/agent-router.ts`.
3. **Phase 2.5 fact-check enforcement** — flag any "orchestrator" in briefings, force disambiguation before Phase 3.
4. **Phase 5 synthesis pattern** — when reviewers diverge on a Q&A item, check if a trap word is causing semantic-not-substantive disagreement. Resolve by naming the readings.

The lesson generalizes: in any domain with multiple co-existing runtimes that solve overlapping problems, the words used to describe them must be precise enough to identify which runtime is meant.

## References

- Council 2026-04-28 — System Council on /dashboard/help
- ADR-0073 — agent-router as orchestrator (anchors Reading 1)
- ADR-0220 — Botsson as Conversational Front Door (this council)
- system-agent-coordinator Phase 3 finding: three Botsson runtimes (Runtime A `/api/botsson/chat`, Runtime B Ultravox, Runtime C dead `runBotssonAgent`)
- L-0148 cross-link: every reviewer's verdict on Q3 mapped to a different reading
