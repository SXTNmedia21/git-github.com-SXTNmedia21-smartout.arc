---
title: "Persona Vocabulary Doesn't Justify Agent Architecture"
id: LEARNING_0181
status: canonical
layer: learning
created: 2026-04-29
updated: 2026-04-29
tags: [agent, capability, architecture, adr-0220, council, lovsen]
---

# Learning-0175: Persona Vocabulary Doesn't Justify Agent Architecture

## Context

Council 2026-04-29 followup: user proposed Lovsen — norsk arbeidsrett-rådgiver — as a peer agent in a "Hospitality Intelligence team" alongside Botsson, Skiftleggeren, Vertinnen, Vinkjenneren. Spec described agent persona, voice, system prompt, knowledge base, peer relationships, agent-level skill organization (`agents/lovsen/skills/<skill>/SKILL.md`).

System Steward verification: `grep` returned ZERO hits for Skiftleggeren, Vertinnen, Vinkjenneren across codebase. Botsson is sole agent runner per ADR-0220 (Botsson conversational front door, not orchestrator). The other agent files in `packages/ai/src/agents/` (`contract.ts`, `journey.ts`, `journey-ops.ts`, etc.) are narrow tool runners — not personas. "Hospitality Intelligence team" exists as concept-vocabulary, not architecture.

## Discovery

**User-facing branding ≠ runtime architecture.**

Persona names (Lovsen, Skiftleggeren, Vertinnen, Vinkjenneren) describe outputs to users — they don't justify separate agent runtimes. The cascade-correct pattern:

- **One agent runner** = Botsson (conversational front door per ADR-0220).
- **Many capabilities** = `contract`, `payroll`, `legal`, `schedule`, `training`, etc.
- **User-facing persona** = branding metadata on capability outputs, surfaced as Botsson's voice when capability is invoked.

Spawning peer agents to model persona-distinction creates:
1. Parallel orchestration paths (collides with ADR-0220 single-front-door)
2. Parallel knowledge sources (collides with K1a/K1b cascade single-source per cascade-integrity-mandate §1)
3. Parallel skill registries (collides with `packages/ai/src/capabilities/registry.ts` flat 21-capability list)
4. Mental-model bloat (every domain question becomes "which agent" not "which capability")

Pattern signature:
- Spec proposes new agent with persona/voice/system-prompt
- Spec proposes filesystem layout `agents/<name>/skills/<skill>/SKILL.md`
- Spec lists "peer agents" — verify they exist in code; if zero hits, vocabulary not architecture
- Spec proposes parallel knowledge base outside cascade K1a/K1b

## Impact

**Council pattern check:** when user proposes a new agent, ask:
1. Does Botsson cover this conversational surface? (Yes per ADR-0220 → not a new agent.)
2. Are the proposed peer agents implemented? (`grep` for class names. If zero, persona not architecture.)
3. Is the proposed skill set tools or runtime logic? (Tools → capability; runtime logic → capability.)
4. Is the proposed knowledge base K1a (platform-shared) or K1b (workspace)? (Either → cascade tables, not filesystem.)

**Re-spec pattern:** "agent" → "capability". `agents/<name>/` → `packages/ai/src/capabilities/<name>/`. `skills/<skill>/SKILL.md` → `tools.ts` exports. Persona name → user-facing branding metadata on Botsson outputs when capability invoked.

**ADR-0220 enforcement:** every new "agent" proposal verified against ADR-0220 single-front-door rule. ADR-0220 is the canonical authority — capability-as-tool is the resolution pattern.

**Phase 2.5 fact-check addition:** when council briefing proposes new agent, fact-checker MUST grep for proposed peer agents + verify implementation status before Phase 3 dispatch.

## Examples observed

- 2026-04-29 (this learning): Lovsen proposed as peer to Botsson + Skiftleggeren + Vertinnen + Vinkjenneren. Steward verified peers do not exist. Re-spec'd as `legal` capability under existing ADR-0234 split.
- ADR-0220 origin (2026-04-28): "/dashboard/help" council banned bare word "orchestrator" after three readings caused four reviewers to take three different verdicts.

## References

- ADR-0220 (Botsson conversational front door, not orchestrator) — canonical authority
- ADR-0234 (contract/payroll capability split) — Lovsen re-spec'd as `legal` capability third sibling
- L-0174 (UX compose vs author verb collision) — sibling pattern (architectural verb confusion)
- L-0148 ("orchestrator" trap word) — sibling pattern (vocabulary collision)
- Council 2026-04-29 Contract Module Phase 0a + Lovsen integration
- Cascade Core Foundation cascade-integrity-mandate §1, §7 (single source of truth)

---

> Registered in `docs/learnings/0000-learning-log.md` 2026-04-29.
