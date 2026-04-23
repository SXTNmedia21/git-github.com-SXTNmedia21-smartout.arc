---
id: L-0141
title: Universal packages claiming web+mobile parity violate ADR-0133 by definition
status: active
date: 2026-04-24
updated: 2026-04-24
layer: learning
module: mobile-architecture
tags: [learning, mobile, adr-0133, packages, parity, council-2026-04-24]
---

# L-0141: Universal packages claiming web+mobile parity violate ADR-0133 by definition

## Context

Council 2026-04-24 Botsson Harness v2-spec foreslo én `@smartout/botsson-arena`-package som både web og mobile skulle importere. Frontend Designer flagget som 🔴 blocker: ADR-0133 binder mobile til thin-client-modell. Universal package implies composition i mobile = ADR-0133-brudd per definisjon.

Teknisk infeasibility forsterker: `BotssonShell` bruker DOM pointer events + `getBoundingClientRect()`, Framer Motion web vs native er forskjellige SDK-er, `useReducedMotion()` leser CSS `matchMedia` (ikke tilgjengelig på RN). Ingen av disse har platform-shims i én package uten å bli to packages med felles typer.

## Why it matters

"Parity" høres ut som et designmål, men leveranse-vei matter. Fellesverdi er tokens + design-språk, ikke pakke-artefakt. Det er ett designspråk, to implementasjoner.

## What to do next time

Når en spec foreslår "web og mobile importerer samme package":

1. Flag umiddelbart som ADR-0133-review.
2. Spør: *"Hva er fellesverdi — tokens, typer, eller komponenter?"*
3. Hvis svaret inkluderer "komponenter": avvis universal, foreslå sibling-packages med felles types-package.

**Designmønster:** `@smartout/design-tokens` leverer felles tokens. `@smartout/<feature>-web` + `@smartout/<feature>-mobile` leverer platform-spesifikke komponenter. `@smartout/<feature>-types` leverer felles types (hvis det er behov).

## Pattern

Reinforces ADR-0133 (web composes, mobile executes). Utvider håndhevingen fra kode til pakke-grenser.
