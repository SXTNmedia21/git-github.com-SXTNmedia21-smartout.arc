---
id: L-0138
title: Authoritative system-maps drift from code; council must cross-check with registry.ts
status: active
date: 2026-04-24
updated: 2026-04-24
layer: learning
module: council-process
tags: [learning, docs-drift, system-map, council-process, briefing, council-2026-04-24]
---

# L-0138: Authoritative system-maps drift from code

## Context

Council 2026-04-24 Botsson Harness v2-review oppdaget at `BOTSSON-SYSTEM-MAP.md` — merket som "canonical" + "autoritativ kilde for Botsson-kampanjen" — hadde drift på tre punkter:

- **14 capabilities** i map vs **17 registrert** i `packages/ai/src/capabilities/registry.ts`
- **17 engine-dispatch action-handlers** i briefing vs **29 case branches** i `supabase/functions/engine-dispatch/index.ts`
- **`helpdesk_query` merket 🔴** ("ikke registrert, Phase B4") vs faktisk registrert i registry.ts:18+39

Specen var skrevet fra map-en. Map-en hadde drift. Specen arvet feilene.

## Why it matters

"Canonical" docs er ikke canonical hvis ingen CI kryss-sjekker dem mot kode. De blir eldre, får ny drift, og feeder fremtidige council-briefings med gamle tall. Dette er nøyaktig L-0094-mønsteret (phantom emit contracts) utvidet fra kode til dokumentasjon.

## What to do next time

**Phase 2.5 fact-check må eksplisitt:**

1. Telle entries i registry-filer som map-en refererer (`capabilities/registry.ts`, `missions/registry.ts`, `telemetry/src/registry.ts`, `engine-dispatch`-switch).
2. Sammenlign med count i "autoritative" docs.
3. Korriger briefing, ikke docs først — Phase 8 oppdaterer docs etter synthesis.

**Ved neste Botsson-council:** kryss-sjekk BOTSSON-SYSTEM-MAP.md mot minst `capabilities/registry.ts` + `engine-dispatch/index.ts` + `services/stage-engine/src/core/*`.

**Langsiktig:** CI-gate som regenererer map-tall fra registry + feil-melder ved drift. Tracked som follow-up.

## Pattern

Reinforces L-0094 (phantom emit contracts) + L-0045 / L-0096 (code-trace catches schema fiction). Utvider mønsteret fra kodeklaim til doc-klaim.
