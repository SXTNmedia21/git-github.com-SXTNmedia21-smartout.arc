---
title: Botsson Soul Documentation
status: draft
version: 0.1
created: 2026-05-15
module: agent-system
tags: [botsson, agent, soul, documentation]
---

# Botsson Soul Documentation

## Formål

Denne dokumentpakken samler produkt, arkitektur, kontrakter, API, datamodell, UX og implementeringsplan for Botsson Soul.

Målet er å gjøre Botsson konsistent på tvers av chat, voice og fremtidige kanaler.

> Én sjel. Flere kanaler. Samme autoritet. Ulike evner.

---

## Dokumenter

| Fil | Ansvar |
|---|---|
| `01-prd.md` | Produktkrav: hva vi bygger, hvorfor og for hvem |
| `02-architecture.md` | Arkitektur: komponenter, ansvar og dataflyt |
| `03-soul-contract.md` | Kontrakt: regler, lag, resolution order og ikke-forhandlingsbare krav |
| `04-api-contracts.md` | API-kontrakter: payloads mellom UI, chat, voice og stage-engine |
| `05-data-model.md` | Datamodell: tabeller, persistence, RLS og audit |
| `06-ux-design.md` | UX: hvordan brukeren styrer Botsson uten å forstå arkitekturen |
| `07-implementation-plan.md` | Implementeringsplan: P0–P3, acceptance criteria og rekkefølge |

---

## Leserekkefølge

1. Start med `03-soul-contract.md`
2. Les `07-implementation-plan.md`
3. Les `04-api-contracts.md`
4. Les `05-data-model.md`
5. Bruk `02-architecture.md` for systembildet
6. Bruk `01-prd.md` og `06-ux-design.md` for produkt og brukeropplevelse

---

## Kjerneprinsipp

UI uttrykker preferanser.  
Stage-engine validerer, løser og kompilerer Botssons sjel.  
Chat og voice skal dele samme resolved identity, posture, memory, context og authority envelope.  
Authority overstyrer alltid persona.  
Channel policy overstyrer alltid tool availability.
