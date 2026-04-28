---
id: L-0136
title: Package-split proposals must begin with cross-campaign impact audit
status: active
date: 2026-04-24
updated: 2026-04-24
layer: learning
module: governance
tags: [learning, package-split, cross-campaign, boundary, council-2026-04-24]
---

# L-0136: Package-split proposals must begin with cross-campaign impact audit

## Context

Council 2026-04-24 vurderte Botsson Harness v2-spec som foreslo å dissolve `packages/ai/` komplett inn i 9 nye packages. Specen var skrevet fra `campaign/botsson-arena`s perspektiv uten å konsultere `journey-engine`, `daily-operation`, `helpdesk`, eller `year-wheel` — selv om alle fire har capabilities bosatt i `packages/ai/`. Det er en lærebokeksempel på cross-campaign land-grab.

## Why it matters

Enhver restrukturering av delt infrastruktur er i praksis en policy-endring for alle kampanjer som konsumerer den. En spec skrevet fra én campaign kan ikke gjøre den beslutningen alene. Council fanget dette; en autonom build-agent ville ikke.

## What to do next time

Før en spec foreslår å flytte / omdøpe / splitte kode i `packages/ai/`, `packages/telemetry/`, `services/stage-engine/` eller andre delte packages:

1. Gjør **affected-caps matrix** (ADR-0210-protokoll).
2. Identifiser eier-campaign per cap.
3. Åpne coordination-note før planen skrives.
4. Vent på godkjenning.

Dette legger til ~1-3 dager koordinasjonsoverhead per cross-campaign-endring. Det er billigere enn rebase-katastrofe eller gjentatte councils.

## Pattern

Reinforces "Audit Inflation Pattern" (MEMORY 2026-04-16): arkitektur-audits basert på grep-counts inflaterer scope. Paret med cross-campaign-koordinasjon håndheves via ADR-0210.
