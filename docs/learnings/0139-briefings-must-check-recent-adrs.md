---
id: L-0139
title: Council briefings must cross-check ADRs landed in last 14 days
status: active
date: 2026-04-24
updated: 2026-04-24
layer: learning
module: council-process
tags: [learning, council, briefing, adr, temporal-drift, council-2026-04-24]
---

# L-0139: Council briefings must cross-check ADRs landed in last 14 days

## Context

Council 2026-04-24 Botsson Harness v2-spec foreslo en MCP-gateway `auth-guard.ts` som ville kalt kun `callGateAction()` før hver tool-call — effektivt kollapsert dual-gate tilbake til én. ADR-0203 (dual-gate = two policies, not one) og ADR-0204 (gatedMutation orkestrator) ble akseptert **24 timer før** specen ble skrevet. Specen siterte dem ikke, viste ikke kjennskap til dem, og foreslo stille det nøyaktige motsatte.

Council Steward fanget dette i Phase 3-review. Uten det ville v2-a ha re-åpnet en decision som tok en hel council å lukke.

## Why it matters

Council-beslutninger har kort halveringstid. En spec skrevet ukemessig sent vs en nylig ADR har høy risiko for å snu beslutningen stille. ADRs forlanger å bli sitert fordi det viser at forfatteren visste om dem — fraværet av sitat er et varselsignal.

## What to do next time

Phase 2.5 fact-check intake må eksplisitt:

1. Liste alle ADRs merket `status: Accepted` i siste 14 dager (`find docs/decisions -newer $(date -d '14 days ago')` eller git-log-basert).
2. For hver, oppsummér decision i én setning.
3. Check: siterer specen denne ADR-en? Hvis nei — flag for Phase 3-reviewers.

**Format-tillegg til council-briefing:**

```
### Recently-accepted ADRs (last 14 days)
- ADR-NNNN (YYYY-MM-DD): <one-line decision>
- ...
```

Hvis listen er tom: eksplisitt si det, ikke utelat seksjonen.

## Pattern

Same shape som L-0138 (docs drift). Temporal drift i decisions er like farlig som spatial drift i docs.
