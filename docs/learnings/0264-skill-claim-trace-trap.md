---
title: Pre-flight Fact-Check Must Grep Alleged Consumers of Artifacts
status: accepted
updated: 2026-05-14
created: 2026-05-14
module: process
tags: [council, fact-check, skill-drift, l-0147, code-trace]
---

# L-0264 — Pre-Flight Fact-Check Must Grep Alleged Consumers of Artifacts

**Date observed:** 2026-05-14
**Class:** documentation drift / aspirational-shipped-as-factual
**Related:** L-0147 (Chair Self-Reversal — 4th occurrence), `run-council` skill, `smartout-page-polish` skill

## What happened

The `smartout-page-polish` skill described a runtime pipe ("BFF → context_init → voice-agent reads site-map.json and injects `## Sidekart`") that does not exist in code. Three concept-level council reviewers (Steward, Supervisor, Frontend-Designer) initially accepted "Phase 7 is wired" in Phase 3. Two code-tracer reviewers (Agent-Coord, Harness-Builder) walked the pipe step-by-step in Phase 3 and surfaced the truth: 75 page-scope tools never reach any LLM.

In Phase 5 synthesis, chair (Steward) self-reversed the Phase 3 claim with code-trace evidence. This is the **4th documented occurrence** of L-0147 (Chair Self-Reversal — 2+ reviewers vote opposite to chair with code-trace evidence ⇒ chair MUST classify Phase 3 vote as REVERSED).

## Root cause

Skill text described a pipe in present tense (factual claim) without a verified-date annotation. The pipe was aspirational at write time; nobody traced it to code at council-Phase-2 fact-check time. Phase 2.5 fact-check focuses on schema/file existence, not on whether the alleged consumer of an artifact actually reads it.

## Rule (promote to `run-council` skill Phase 2.5)

> Pre-flight fact-check MUST include a grep for the **alleged consumer** of any artifact the briefing or skill text references.
>
> For every claim of form "X consumes Y" or "X reads Y" or "Y is injected into X":
> 1. Grep the codebase for an import or read of Y from within X's source tree.
> 2. If zero matches, flag as UNVERIFIED — the briefing must reclassify the claim as "future-target" or remove it before Phase 3 dispatch.
>
> Example: skill text says "voice-agent reads site-map.json". Grep `grep -rn "site-map" services/voice-agent/`. Zero matches ⇒ claim is FALSE-AS-SHIPPED.

## Forward action

- Promote rule to `run-council` skill Phase 2.5 (Briefing Fact-Check Gate)
- Add "Skill claim drift" to the Common-Mistakes table in `smartout-page-polish` skill (done in commit `6ed9eb628`)
- Run a one-pass audit of other Smartout skills for similarly-shaped aspirational claims (`smartout-cascade-developer`, `smartout-edge-function-guide`, `smartout-database-guide`) — separate sortie

## References

- Handoff: `docs/handoffs/HANDOFF-2026-05-14-polish-wave-council-harness-adapter.md` (full council trace, file:line citations for each break point)
- ADR-0327 (proposed) — Unified HarnessAdapter that will close the dead pipe
- Council log: `docs/council/COUNCIL-LOG.md` 2026-05-14 entry
