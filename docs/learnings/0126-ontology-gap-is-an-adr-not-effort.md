---
id: L-0126
title: "Ontology gap is an ADR, not effort — when two data models diverge, the gap is a contract decision"
status: accepted
date: 2026-04-23
type: principle
created: 2026-04-23
updated: 2026-04-23
related_adrs: [ADR-0194]
module: architecture
tags: [ontology, contract, ir, engine_missions, mapping, council]
---

# L-0126 — Ontology gap is an ADR, not effort: when two data models diverge, the gap is a contract decision

## Context

Campaign `journey-engine` is built on `packages/journey-ir` (JourneyIR v2.0). IR describes executable Playwright steps: `action`, `assertion`, `timeoutMs`, per-step `gate`, `screenshot`, `description`. The capability `journey.publish_mission` (tools.ts:299-344) was scaffolded at M1 with a comment `// S1.4 skeleton — engine_missions insert ... lands in M4`. The plan assumed M4 was an effort ticket: "connect the IR to the insert."

Council code-trace 2026-04-23 (supervisor Layer 2 column-trace) revealed the gap is not effort. `engine_missions` (supabase/migrations/20260301200000_engine_tables.sql:19-30) has `mode text CHECK (sequential|free|hybrid) NOT NULL` and `system_prompt text` (since 20260318120000). Its child `engine_stages` has `goal text NOT NULL`, `instructions text NOT NULL`, `success_criteria text NOT NULL`, `creative_freedom numeric(3,2) CHECK (0..1)`. **JourneyIR has none of these fields.** `action` is a Playwright summary; `instructions` is agent coaching text. `assertion` is a DOM check; `success_criteria` is an agent-visible pass/fail sentence.

These are different ontologies. One describes executable verification; the other describes agent-conversational coaching. The mapping between them cannot be mechanical without quality loss. Forcing `instructions := step.action` produces `engine_stages.instructions = "click button.submit"` — a string that satisfies NOT NULL but has zero coaching value for an agent.

The publisher body cannot be written until the mapping rule is decided. A plan step that says "write publish_mission body in week 3" is a **category error** — the blocker is a decision, not an engineering ticket.

## Discovery

**When two data models with different ontologies are on opposite sides of a capability, the gap is an ADR, not a ticket.** Three recognition signals:

1. **NOT NULL columns on the target that have no source in the input.** The source model lacks the concept entirely. Derivation produces placeholders; those placeholders cannot be improved without changing the source model.
2. **Semantic category mismatch on columns that do share names.** E.g., both models have a field called `instructions` or `goal` but one is machine-readable test steps and the other is human-readable coaching. A literal copy produces technically-valid rows that violate the target model's semantic contract.
3. **The engineer's first instinct is to add a default or hardcode a stub.** `mode := 'sequential'`, `system_prompt := "You are a helpful assistant"`, `success_criteria := "All steps complete"`. Each hardcode is a quiet admission that the decision hasn't been made.

When any of these signal, stop. Write an ADR that decides one of:
- **Extend the source model additively** to carry the missing concept.
- **Document a derivation rule** with an explicit quality-loss acknowledgment and a gate on `is_active` (or equivalent) that prevents derived rows from going live.
- **Reject the integration** — the two models are not compatible at the intended abstraction.

The ADR is the work. Once decided, the implementation is straightforward.

## Impact

**Phase 2.5 council fact-check gains an ontology-gap check.** For every capability plan that proposes writing to a target table, the fact-checker enumerates the target's NOT NULL columns and NOT-CHECK-constrained columns, then verifies each has a source in the declared input. Any NOT NULL column without a source is flagged as a **pending contract decision, not a pending engineering task**.

**Plan-writing convention.** When a plan calls for a capability body that writes to a table, the plan must include an **ontology diff** showing:
- Target schema (columns, constraints).
- Source schema (IR or input).
- Mapping decision per column (direct copy / deterministic derivation / requires author / hardcoded default with rationale).

A plan without the ontology diff is rejected at intake; the missing diff signals a pending ADR.

**Governance impact.** Campaign roadmaps that list "M4 — publish capability bodies" as a single milestone must instead list "M4-decide — mapping ADR" separately from "M4-implement — body." The decision is a prerequisite, not a step. Campaign `journey-engine` corrects this with ADR-0194 (IR v2.1 → engine_missions mapping) landing before any publish_mission body work.

**Case study reference.** ADR-0194 is the canonical example of this learning in action. Reviewers should read it alongside this learning to see the recognition pattern and the decision shape.

## References

- ADR-0194 — JourneyIR v2.1 → engine_missions mapping (the canonical example).
- ADR-0171 — packages/journey-ir canonical.
- ADR-0178 — JourneyIR v2 additive schema expansion (sibling example of ADR-as-decision).
- L-0124 — phantom body (same-council sibling, different failure mode).
- Council: `docs/council/COUNCIL-LOG.md` 2026-04-23.
- `packages/journey-ir/src/types.ts`.
- `supabase/migrations/20260301200000_engine_tables.sql:19-85`.
- `supabase/migrations/20260318120000_engine_tuning_notes_and_mission_prompt.sql`.

---

> After writing: register in `docs/learnings/0000-learning-log.md`.
