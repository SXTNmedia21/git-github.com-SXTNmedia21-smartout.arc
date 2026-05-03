---
id: L-0137
title: Subpath exports deliver ~80% of package-split benefit at near-zero scaffolding cost
status: active
date: 2026-04-24
updated: 2026-04-24
layer: learning
module: package-architecture
tags: [learning, packages, subpath-exports, pnpm, modularity, council-2026-04-24]
---

# L-0137: Subpath exports deliver ~80% of package-split benefit at near-zero cost

## Context

Council 2026-04-24 Supervisor målte: `packages/ai/package.json` har allerede **39 subpath-exports** (`@smartout/ai/capabilities/journey`, `@smartout/ai/router`, osv.). Konsumerer kan importere én capability uten å dra hele packagen.

v2-specen foreslo å splitte samme `packages/ai/` til 16 capability-sub-packages. Supervisor påpekte at subpath-exports leverer det meste av modularitets-gevinsten uten scaffolding-kost (ingen nye `package.json`, ingen nye `tsconfig.json`, ingen turbo task-graph-eksplosjon, ingen pnpm-workspace-glob-endringer).

## Why it matters

Før man foreslår "splitt pakken X til N nye packages" — mål hva subpath-exports allerede leverer, og hva slags coupling som faktisk gjenstår. Hvis coupling er circular-imports eller delte side-effects, løser ikke package-split det uansett.

## What to do next time

Før ny package-split:

1. Tell subpath-exports på pakken som foreslås splittet.
2. Mål konkret coupling som *ikke* kan løses ved subpath + intern refaktor.
3. Kun hvis (2) gir et skarpt svar, foreslå splitt. Ellers utvid subpath-exports.

Pilot-split først (én package), mål coupling-reduksjon empirisk, decision gate før fleet-migrate.

## Pattern

Same shape som "avoid premature abstraction" — scaffolding-kost er ikke null. 35-package-monorepoer har målbare bygg-tid / cache-granularitets / DX-kostnader.
