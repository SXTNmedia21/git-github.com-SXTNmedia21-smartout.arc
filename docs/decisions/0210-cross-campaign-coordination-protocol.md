---
title: "Cross-campaign coordination protocol for packages/ai"
id: ADR-0210
status: accepted
layer: decision
module: governance
created: 2026-04-24
updated: 2026-04-24
tags: [campaigns, coordination, boundaries, packages-ai, governance, council-2026-04-24]
---

# ADR-0210: Cross-campaign coordination protocol for packages/ai

**Status:** Accepted
**Date:** 2026-04-24
**Council:** 2026-04-24 (Botsson Harness v2 spec review)

## Context and Problem Statement

`packages/ai/` er **delt** mellom minst fire aktive campaigns:

- `campaign/botsson-arena` — capabilities, agents, router, missions
- `campaign/journey-engine` — `packages/ai/src/capabilities/journey/` + `packages/journey-ir/`
- `campaign/daily-operation` — operations + operations-intelligence
- `campaign/helpdesk` — helpdesk_query capability (Phase B4)
- `campaign/year-wheel` — season + planning intent routing

v2-specen skrevet fra `campaign/botsson-arena` foreslo å dissolve `packages/ai/` komplett inn i 9 nye packages — **uten å konsultere de andre kampanje-eierne**. Dette er eksakt STOPP-regelen i scoped CLAUDE.md skal forhindre. Council 2026-04-24 Steward + Supervisor flagget begge dette som cross-campaign land-grab.

## Decision Drivers

- Ingen campaign bør stille endre delt infrastruktur som andre campaigns har scoped CLAUDE.md pinnet til.
- Manglende koordinasjon = rebase-katastrofe + scope-konflikter + gjentatte ADRs.
- Kampanje-scoped CLAUDE.md har allerede STOPP-regel, men håndhevelsen har vært tynn.

## Considered Options

1. **Ingen protokoll — stol på agent-diskresjon.** Bekreftet ikke-fungerende.
2. **Formalisér prereq-sign-off per endring som krysser grense.**
3. **Frys `packages/ai/` helt.** For stivt; blokkerer legitim innenfor-campaign-arbeid.

## Decision Outcome

**Valgt: Option 2.** Cross-campaign-endringer i delt infrastruktur krever eksplisitt prereq-sign-off fra eier-kampanjene før sub-sortie starter.

**Protokoll:**

1. Forfatter identifiserer **affected-caps matrix** ved plan-skriving — hvilke capabilities / filer i delt infrastruktur blir flyttet, omdøpt, refaktorert.
2. For hver affected cap, identifiser eier-campaign (fra scoped CLAUDE.md + current open sub-sorties).
3. Åpne coordination-note i `docs/council/COORDINATION-NOTES/YYYY-MM-DD-<topic>.md` med:
   - Hvilke caps
   - Hvilken endring
   - Begrunnelse
   - Foreslått timing
4. Eier-campaign svarer: godkjenn / avvis / motspill.
5. Sub-sortie starter ikke før skriftlig godkjenning foreligger.

**Affected-caps matrix (as of 2026-04-24):**

| Capability / fil | Eier-campaign |
|---|---|
| `packages/ai/src/capabilities/journey/` | `campaign/journey-engine` |
| `packages/journey-ir/` | `campaign/journey-engine` |
| `packages/ai/src/capabilities/operations/`, `operations-intelligence/` | `campaign/daily-operation` |
| `packages/ai/src/capabilities/helpdesk/` | `campaign/helpdesk` |
| `packages/ai/src/capabilities/schedule/` (sesong-intent) | `campaign/year-wheel` (rådgir) |
| `packages/ai/src/capabilities/{profile, ui, guardian, communication, contract, contract-intake, shift-swap, shift-lifecycle, training, governance, billing-query, memory}` | `campaign/botsson-arena` |

## Rules & Consequences enforced for Agents

- **Good, because** CVE-klasse "silent boundary violation" får skriftlig papirspor.
- **Good, because** eier-kampanjene får tidlig varsel om endringer som påvirker deres sub-sorties.
- **Bad, because** koordinasjons-overhead legger til 1-3 dager per cross-campaign-endring.
- **Agent Impact:** Enhver sub-sortie-plan som foreslår flytting / omdøping / refaktor i delt `packages/ai/**` MÅ enumerere affected-caps matrix i plan-filen. Close-feature-gate sjekker at coordination-note eksisterer. Ingen "jeg flytter bare én fil" unntak.
