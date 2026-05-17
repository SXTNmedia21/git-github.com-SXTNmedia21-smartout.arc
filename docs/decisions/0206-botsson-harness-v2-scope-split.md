---
title: "Botsson Harness v2 — Scope Split (v2-a / v2-b / v2-c)"
id: ADR-0206
status: accepted
layer: decision
module: botsson-arena
created: 2026-04-24
updated: 2026-04-24
tags: [botsson, harness, v2, scope, sequencing, council-2026-04-24]
---

# ADR-0206: Botsson Harness v2 — Scope Split into v2-a / v2-b / v2-c

**Status:** Accepted
**Date:** 2026-04-24
**Council:** 2026-04-24 (Botsson Harness v2 spec review)

## Context and Problem Statement

En full-spec for Botsson Harness v2 ble skrevet som ett stort one-shot-forslag: 9 top-level packages, 16 capability-sub-packages, MCP-gateway, YAML-missions, 3 uferdige fixes fra 2026-04-09. Council 2026-04-24 fant at intent-en er riktig, men formen er feil. Som single-spec er den en cross-campaign-brytende big-bang som parallel-sporer 9 åpne fase-deliverables i aktiv campaign.

## Decision Drivers

- Aktiv `campaign/botsson-arena` har 9 åpne fase-leveranser (B1-D3). Big-bang = månedslang feature freeze eller katastrofal rebase-konflikt.
- Spec blander tre uavhengige leveranser (MCP-gateway, YAML authoring, capability split) med forskjellig risiko-profil.
- Subpath-exports i `packages/ai/package.json` leverer allerede ~80 % av separasjonsgevinsten uten scaffolding-kost.
- Cross-campaign-koordinasjon kreves for ting som spec tar som gitt (`journey-engine`, `daily-operation`, `helpdesk`, `year-wheel` eier alle capabilities i `packages/ai/`).

## Considered Options

1. **Big-bang:** Flytt alt i ett worktree som specen foreslår.
2. **Ren avvisning:** Fortsett på eksisterende layout, ignorer v2.
3. **Rescope til tre uavhengige leveranser** (v2-a / v2-b / v2-c) sekvensiert etter B1-B5 lukkes.

## Decision Outcome

**Valgt: Option 3.** Rescope v2 til tre separable leveranser utført mot eksisterende campaign, i tidsrekkefølge etter at løftet-bærende prereqs lander.

**v2-a — MCP-gateway alene.** Ny package, null file-moves. Eksponerer eksisterende capabilities via MCP-protokollen. Parallelt med C1/C2-arbeidet.

**v2-b — YAML authoring.** Etter koordinasjon med `campaign/journey-engine`: definer om YAML kompilerer til JourneyIR eller er parallell IR.

**v2-c — Gradual capability-split.** Pilot på `billing_query` (minste, read-only). Decision gate etter pilot: fortsett eller stopp basert på målt coupling-reduksjon utover subpath-exports.

**Forutsetninger (Fase P0):**

1. `callGateAction` unification til én canonical wrapper (ADR-0207)
2. Subagent-events registrert i telemetry-registry
3. BOTSSON-SYSTEM-MAP refreshet mot faktisk kode
4. B1 + B3 + B4 + B5 lukket i nåværende layout

## Rules & Consequences enforced for Agents

- **Good, because** leveransene er uavhengige — en feil i v2-a stopper ikke v2-b.
- **Good, because** subpath-exports-rammen tester coupling-gevinsten empirisk før vi forplikter oss til 16 capability-packages.
- **Good, because** cross-campaign-koordinasjon er nå eksplisitt, ikke implisitt.
- **Bad, because** tidslinjen blir lengre enn big-bang ville lovet.
- **Agent Impact:** Ingen subagent foreslår "just move everything to new packages" for Botsson-kode. Gå alltid via v2-a/b/c-rammen. Cross-campaign-arbeid krever sign-off fra eierkampanjer (se ADR-0210).
