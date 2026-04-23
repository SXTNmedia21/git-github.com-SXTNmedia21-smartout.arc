---
id: L-0108
title: "Code-trace catches what grep-briefing misses"
status: accepted
date: 2026-04-22
module: MODULE_BOTSSON
tags: [learning, council, briefing, code-trace, verification, phase-2.5]
---

# L-0108 — Code-trace catches what grep-briefing misses

## Context
2026-04-22 council Phase 2.5 fact-check verifiserte alle 15 briefing-claims VERIFIED. Phase 3 reviewers kunne ha stolt på dette og jobbet på concept-level.

I stedet utførte `system-agent-coordinator` en full end-to-end code-trace av en agent turn (chat.ts → session-manager → classifier → authority → memory → prompt-builder → LLM adapter → guardian-evaluator → response). Trace avdekket at **steg 3 (classifier), 4 (authority), 8 (prompt-build), 9 (LLM call) leaver zero persistent trace i dag** — dette var ikke i briefing-en, fordi briefing bare listet at filene fantes, ikke hvordan payloads flyter gjennom dem.

Denne trace'n ble **avgjørende for Q3-konflikten** (metadata vs full LLM I/O) og for Phase 0-prereq-identifisering.

## Learning

**Phase 2.5 fact-check verifierer at claims er sanne. Code-trace verifierer at claims er KOMPLETE.**

En briefing kan si "agent-router.ts eksisterer og kaller intent-classifier" — sant. Men skjuler at `context = ""` ved linje 83, at output ikke persisteres, at classifier-resultatet er usynlig for Guardian.

Fact-check verifiserer eksistens. Code-trace verifiserer flow.

Uten code-trace ville council sannsynligvis akseptert Steward's (b) "metadata only" — et optimistisk kompromiss. Med code-trace ble Coordinator's (c) "full LLM I/O" decisive fordi tracen viste at 4 usynlige steg var akkurat det Platform Admin trenger synlig.

## Rule

For enhver plan som berører agent-stack, data-pipeline, eller cross-system payloads:

**Phase 2.5 ≠ tilstrekkelig. Assign minst én reviewer code-tracer-mandatet eksplisitt.**

Code-tracer's svar MÅ inneholde:
- Filsti:linje for hvert steg
- "Hva persisteres?" per steg
- "Hva er usynlig i dag?" per steg
- Oppdatering til `BOTSSON-SYSTEM-MAP.md` hvis trace avdekker ny 🟡/🔴

Default code-tracer:
- Agent/contract-level: `system-agent-coordinator`
- Botsson-harness reality: `botsson-harness-builder`
- Kryss begge: assign begge, parallel

## How to apply

- `/run-council` briefing-template: inkluder eksplisitt "Code-Tracer Mandate" seksjon for alle agent/stack-emner
- Trace-output må være del av Phase 5 synthesis-input (ikke bare concept-reviews)
- Hvis ingen reviewer har run tracen før Phase 5: re-dispatch med trace-mandat, ikke synthesize

Dette mønsteret er promotert av `run-council` skill (SKILL.md "Code-Tracer Mandate") — dette er 4. bekreftede occurrence etter PR #213 (activity_trail silent-drop), auto_assign migration regression, Tier 2 v1.5 UNIQUE violation.

## References
- `run-council` SKILL.md "Code-Tracer Mandate" seksjon
- Council: `docs/council/COUNCIL-LOG.md` 2026-04-22
- Coordinator's Phase 3 trace (archived in council notes)
- Related L-0096 (code-trace catches schema fiction)
