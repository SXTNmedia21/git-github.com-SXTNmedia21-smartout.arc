---
title: "Botsson Arena extraction — web-only + mobile sibling + tokens single-source"
id: ADR-0209
status: accepted
layer: decision
module: botsson-arena
created: 2026-04-24
updated: 2026-04-24
tags: [botsson-arena, extraction, nordic-split, design-tokens, mobile, adr-0133, council-2026-04-24]
---

# ADR-0209: Botsson Arena Extraction Contract

**Status:** Accepted
**Date:** 2026-04-24
**Council:** 2026-04-24 (Botsson Harness v2 spec review)

## Context and Problem Statement

v2-specen foreslo å ekstraherere `apps/web/src/app/Botsson/_components/*` til én `@smartout/botsson-arena`-package som både web og mobile kan importere, og å duplisere tokens i `botsson-arena/tokens/`. Council 2026-04-24 Frontend Designer flagget dette som to blockere:

1. **Universal web+mobile package bryter ADR-0133** ("web composes, mobile executes") og er teknisk umulig — DOM-API-er (pointer events, getBoundingClientRect), Framer Motion web vs native er forskjellige SDK-er, 12 Arena-views er rike web-UI-er.
2. **Token-duplikering bryter Nordic Splits single-source-of-truth** (tokens bor i `packages/design-tokens/` alene).

## Decision Drivers

- ADR-0133 binder mobile til thin-client-modell.
- ADR-0132 binder mobile AI-routing via BFF.
- Nordic Split-regel: én kilde til tokens, genererte artefakter downstream.
- `BotssonArena.tsx` er i dag 2377 LOC monolitt; design-handoff har allerede splittet views i 4+ filer.

## Considered Options

1. **Universal package med platform-shims.** Avvist — bryter ADR-0133 og krever dobbel implementasjon av interaction-layer uansett.
2. **To packages: `@smartout/botsson-arena` (web) og `@smartout/botsson-mobile` (thin-client).** Tokens forblir i `packages/design-tokens/`.
3. **Behold alt i `apps/web/`, ikke ekstrahér.** Avvist — blokkerer landing-site og tredjepart.

## Decision Outcome

**Valgt: Option 2.** Ekstraksjon i tre bølger til **web-only** `@smartout/botsson-arena`. Mobile får egen **søster-package** `@smartout/botsson-mobile` (Orb + Sticky + Chat-surface), som konsumerer capabilities via BFF per ADR-0132. Tokens blir værende i `packages/design-tokens/`.

**Forutsetning:** `BotssonArena.tsx` splittes inn i view-sub-komponenter i `apps/web/` *først*, ikke under ekstraksjonen.

**Forutsetning:** Phase D3 (Emma-illustrasjon + Immersive backdrop) lander i `apps/web/` med pixel-parity mot handoff-en først, så migrerer.

**Forutsetning:** `packages/Botsson/` (kapital B, docs-only) flyttes til `docs/botsson/` og kapital-B-mappen slettes før ekstraksjon starter, for å unngå case-sensitivitets-kollisjon.

## Rules & Consequences enforced for Agents

- **Good, because** ADR-0133 opprettholdes.
- **Good, because** Nordic Split-drift er utelukket — ingen parallell token-source.
- **Good, because** landing-site + tredjepart kan importere `@smartout/botsson-arena` uten Next.js.
- **Bad, because** to packages å vedlikeholde i stedet for én.
- **Agent Impact:** Ingen subagent foreslår "share Arena components with mobile". Mobile får sibling-package som implementerer det samme designspråket med RN-kompatibel motion. `useReducedMotion()` må ha platform-shim. Tokens skal *aldri* dupliseres inn i noen botsson-package.
