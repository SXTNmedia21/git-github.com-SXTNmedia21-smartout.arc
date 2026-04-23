---
title: "MCP-gateway alongside Hono stage-engine (dual transport, not replacement)"
id: ADR-0208
status: Accepted
layer: decision
module: stage-engine
created: 2026-04-24
updated: 2026-04-24
tags: [mcp, stage-engine, transport, botsson, v2-a, council-2026-04-24]
---

# ADR-0208: MCP-gateway alongside Hono stage-engine — dual transport, not replacement

**Status:** Accepted
**Date:** 2026-04-24
**Council:** 2026-04-24 (Botsson Harness v2 spec review)

## Context and Problem Statement

v2-specen foreslo å "erstatte `services/stage-engine/` med `botsson-adapters/web` + `botsson-mcp`". Council 2026-04-24 Harness Builder viste at stage-engine-prosessen **ikke kan forsvinne**: WebSocket-transport for Ultravox, Guardian live-view, pg_notify listener, SessionLane (24-linjers in-memory promise-queue) krever alle en long-lived prosess i samme deployable.

## Decision Drivers

- WebSocket + pg_notify kan ikke bli serverless/ephemeral funksjoner uten re-arkitektur som ikke er i scope.
- SessionLane er per-process primitive, ikke workspace-state — å splitte den på tvers av deployables bryter kontrakten.
- Next.js `route.ts` må leve under `apps/web/src/app/` (framework-constraint). "Flytt routes til botsson-adapters/web" er teknisk umulig som foreslått.

## Considered Options

1. **Erstatt stage-engine-prosessen med ny MCP-only-prosess.**
2. **Legg MCP-transport alongside den eksisterende Hono-service (samme prosess, to transports).**
3. **Egen MCP-prosess ved siden av stage-engine (to deployables).**

## Decision Outcome

**Valgt: Option 2.** Stage-engine-prosessen overlever. MCP-transport legges til ved siden av eksisterende HTTP-routes i samme Hono-service. Prosessen omdøpes fra `stage-engine` til `botsson-mcp` for å reflektere dual-transport-virkeligheten.

BFF-routes under `apps/web/src/app/api/botsson/*` og `/api/emma/*` forblir i Next.js. Deres handler-logikk *kan* trekkes ut til et felles bibliotek, men selve `route.ts`-filene må bli i App Router-treet.

## Rules & Consequences enforced for Agents

- **Good, because** ingen forstyrrelse av fungerende WebSocket / pg_notify / SessionLane.
- **Good, because** én prosess = én deploy-unit = mindre operasjonell kompleksitet.
- **Good, because** MCP-klienter (Claude Code, Cursor, LiveKit, Ultravox) kan koble til samme host som BFF allerede snakker med.
- **Bad, because** `botsson-mcp`-prosessen er ikke en "ren" MCP-server — den er blanding.
- **Agent Impact:** Ingen forslag om å "delete stage-engine and replace with MCP server". Transport-lag legges til; prosess forblir. Enhver BFF-refaktor må respektere Next.js route-handler-constraint.
