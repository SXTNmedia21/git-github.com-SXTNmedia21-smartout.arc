---
title: "Phantom Contracts in Q&A Specs"
id: LEARNING_0149
status: canonical
layer: learning
created: 2026-04-28
updated: 2026-04-28
tags: [phantom-contract, adr-0197, council-process, run-council, qa-spec, brainstorming, fact-check]
---

# Learning-0149: Phantom Contracts in Q&A Specs

## Context

Council 2026-04-28 reviewing /dashboard/help. The brainstorming spec format was 12 questions with multiple-choice options + orchestrator-recommended defaults. Pontus answered Q1 explicitly; Q2–Q12 were left as the orchestrator's strawman.

Three of the strawman recommendations encoded promises the data pipeline cannot keep:

- **Q4 — "auto-generated articles from journeys via RAG over `workspace_doc_chunk`"**: ingest pipeline `ingest-workspace.ts:34-63` only handles handbook_chapter / policy / protocol. `docs/journeys/` is NOT a source. No journey-engine → workspace_doc_chunk pipeline exists.
- **Q11.c — "articles never out of date (synced from journey-engine + code)"**: ingest is hash-diffed but not scheduled. Manual trigger only. No git hook, no cron, no journey-publish trigger.
- **Q11.d — "Show me UI takeover (Botsson navigates UI on user's behalf)"**: requires new tools (`simulate_click`, `submit_form`, `wait_for_state`), cross-runtime bridge between Stage Engine and DOM, multi-step orchestrator. Current `ui` capability has 5 tools, none compose to a takeover.

All three were caught in Phase 3 by code-tracers (supervisor + system-agent-coordinator + botsson-harness-builder, independently). Phase 2.5 fact-check missed them — the fact-check verified individual claims about ADR existence and codebase state, but did NOT trace the strawman Q&A answers against pipeline reality.

## Discovery

**Q&A spec format encourages confident answers without code-trace verification.** The format optimizes for "user picks one" speed; it does NOT optimize for "is this buildable today?" honesty.

Three observations:

1. **Multiple-choice + orchestrator-recommended-default** is a confidence-amplifier. Each Q hands the user a primed answer that feels validated. The spec writer's own bias toward sounding-correct compounds.
2. **Phase 2.5 fact-check as currently scoped is insufficient.** It verifies factual claims (ADR-X exists, file Y has line Z) but does NOT verify Trust Gate claims (capability X is reachable, pipeline Y produces output Z).
3. **Phantom-contract risk grows with spec size.** A 12-Q strawman is 12 chances to encode a phantom. Smaller spec scope → fewer phantoms.

This is a fourth shape of phantom contract beyond the three documented:

- L-0094 — Phantom emit (producer claims work done, nothing written).
- L-0124 — Phantom body (emit fires, registry consistent, body returns ok:true without performing side effect).
- L-0146 — Phantom consumer (producer DID write, nothing reads it).
- **L-0149 (this) — Phantom Q&A answer** (spec recommends a path that depends on infrastructure that doesn't exist, presented with same confidence as paths that do).

## Impact

Update `run-council` SKILL.md Phase 2.5:

1. **Trust Gate fact-check** — for every spec answer that names a capability, tool, pipeline, ingest source, or emit destination, fact-check MUST verify it is reachable + populated + scheduled (as relevant).
2. **Q&A specs flagged for code-trace** — any spec format with multiple-choice + recommended-default MUST go through a Trust Gate pass before Phase 3 begins. Code-tracer (default: system-agent-coordinator) traces every promise to file:line evidence.
3. **Promise vs pipeline matrix** — synthesis Phase 5 produces an explicit table: each promise → file:line evidence → reality (real / partial / phantom). Phantoms force descope or ADR.

Update `superpowers:brainstorming` skill:

- New step before "present design": Trust Gate self-check by orchestrator.
- For each recommendation, ask: "what file:line evidence shows this is buildable today, vs. requires new infra?"
- Specs that mix real-and-phantom recommendations without flagging which is which are a smell.

The general lesson: **confident multiple-choice spec format is structurally biased toward phantoms.** The format is fine; the verification layer must be heavier than its surface implies.

## References

- Council 2026-04-28 — System Council on /dashboard/help
- ADR-0197 — Phantom contracts class rule (parent rule)
- ADR-0221 — KB Capability Registration as Merge Gate (this council)
- L-0094 — Phantom emit
- L-0124 — Phantom body vs phantom emit
- L-0146 — Phantom consumer pattern
- supervisor + system-agent-coordinator + botsson-harness-builder Phase 3 reviews (all three independently caught Q4 + Q11.c + Q11.d)
- Spec: `docs/superpowers/specs/2026-04-28-dashboard-help-design.md` (the rescoped successor with phantoms removed)
