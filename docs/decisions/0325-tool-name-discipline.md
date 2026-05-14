---
title: "Tool-name discipline — page-scoped prefix convention for harness tool registry"
id: ADR_0325
status: proposed
layer: decision
created: 2026-05-14
updated: 2026-05-14
module: governance
tags: [page-tools, harness, tool-registry, naming, collision, adr-0324]
---

# ADR-0325: Tool-name discipline — page-scoped prefix convention

## Context

`apps/web/src/app/Botsson/_components/tool-registry.ts:85` uses `Object.assign(implementations, set.implementations)` and `definitions.push(...)` to merge tool kits from all registered page bridges. The merge is **silent last-wins** on duplicate `modelToolName`.

The 2026-05-14 Polish-Wave QA Council (Agent-coord code-trace) found **9 confirmed name collisions** from the 33-bridge wave:

| Duplicate `modelToolName` | Count |
|---------------------------|-------|
| `listOpenDeviations` | 3 |
| `switchStatusFilter` | 2 |
| `listTeams` | 2 |
| `proposeActivateSeason` | 2 |
| `getUnreadCount` | 2 |

When the LLM receives duplicate definitions in the tool array, it sees ambiguous entries. Execution routes to whichever implementation won the Object.assign race (mount order). The other implementation is silently dropped.

## Problem Statement

Three viable approaches were identified by the council. This ADR documents the options and records the council's request for a follow-up decision session to choose between them.

### Option A — Page-scoped prefix convention

Format: `<page-slug>.<toolName>` — e.g. `hms.listOpenDeviations`, `schedule.listOpenDeviations`.

Pros: zero collision class, human-readable, self-documenting, traceable to source bridge.
Cons: breaks LLM tool-name stability (all 33 bridges must be retrofitted), voice channel must forward new names, `site-map.json` `tools[]` list needs update, any hardcoded references in stage-engine or voice-agent must be remapped.

### Option B — Central allowlist

Maintain a `TOOL_NAME_ALLOWLIST` map in `tool-registry.ts`. Registration throws if name not in allowlist. Single source of truth for all tool names — no duplicates permitted by construction.

Pros: no rename required for non-colliding tools, compile-time enforcement.
Cons: allowlist becomes a merge-conflict hotspot for every new bridge; registry becomes a bureaucratic gate.

### Option C — Runtime collision detector (minimum viable, non-breaking)

At registration time, warn (or throw in development) when a duplicate `modelToolName` is detected. No rename required. CI fails on collision count regression.

Pros: immediate detection, zero breaking change, deployable same-sortie.
Cons: does not prevent collisions — only surfaces them faster. Requires follow-up rename sortie for existing 9.

## Decision

**Deferred — council follow-up required.** The 2026-05-14 evening council logged Option C as the immediate unblock (M3 sortie scope: add collision detector to `tool-registry.ts` registration loop) while the prefix-convention decision (Option A) is resolved in a dedicated council session.

**Interim rule (binding until follow-up council):**
- New bridges MUST choose tool names not already in the registry (grep `tool-registry.ts` `modelToolName` before merge).
- M3 sortie MUST ship Option C collision detector as a blocking pre-merge gate.
- Option A prefix adoption requires a council vote with LLM-compatibility impact assessment.

## Consequences

**Immediate (M3 sortie):**
- Collision detector in registration loop — `console.error` in dev, throw in test
- Existing 9 collisions documented in M3 sortie scope

**Follow-up council:**
- Pick Option A, B, or hybrid
- Retrofit plan for 33 bridges if Option A chosen
- Voice-channel naming impact assessment

## Cross-references

- ADR-0324 (page-tool authority semantics — companion ADR)
- L-0258 (Tool-registry Object.assign collision — 9 confirmed 2026-05-14)
- Polish-Wave QA Council 2026-05-14 (M3 finding: tool-registry collision detector)
- `apps/web/src/app/Botsson/_components/tool-registry.ts:85`
