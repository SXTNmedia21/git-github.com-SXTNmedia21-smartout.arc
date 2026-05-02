---
id: L-0140
title: In-process primitives claimed by specs must be grep-verified in Phase 2.5
status: active
date: 2026-04-24
updated: 2026-04-24
layer: learning
module: council-process
tags: [learning, council, phase-2-5, grep-verification, phantom-primitives, council-2026-04-24]
---

# L-0140: In-process primitives claimed by specs must be grep-verified in Phase 2.5

## Context

Council 2026-04-24 Botsson Harness v2-spec §"Subagents som cattle" refererte `executeSubagent()` som "in-process i stage-engine" som v2 skulle flytte til cattle-pattern. Agent-Coordinator code-trace: **null grep-hits**. Funksjonen finnes ikke. Specens migrasjons-claim var fundert på en ikke-eksisterende baseline.

Dette er samme shape som L-0045 / L-0096 (code-trace catches schema fiction), men spesifikt for "this thing exists in-process today" claims.

## Why it matters

Specs snakker ofte om current-state i vage termer. "X-en som kjører in-process i dag" høres ut som en verifiserbar realitet men er faktisk en antakelse. Hvis antakelsen er feil, er migrasjonsplanen fundert på fiksjon.

## What to do next time

Phase 2.5 fact-check intake inkluderer: for hvert "in-process" / "eksisterer i dag" / "kalles fra X" claim i specen, grep-verifiser:

- Funksjonsnavn → grep returner filer + linje-numre
- Call-site-count → grep-c returnerer antall kallssteder
- Tabellnavn → SQL-grep i migrations-mappa

Hvis en claim ikke kan verifiseres, merk den **UNVERIFIABLE** og flag for Phase 3-reviewers.

## Pattern

Reinforces L-0045 (code-trace catches schema fiction) og L-0096 (code-trace reinforcement). Utvider fra kun schema-claims til alle "this exists today" claims.
