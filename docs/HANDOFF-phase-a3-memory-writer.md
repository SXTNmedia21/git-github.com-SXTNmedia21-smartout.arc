---
title: "HANDOFF — Phase A3: Memory Writer"
status: done
type: handoff
created: 2026-04-22
updated: 2026-05-09
module: MODULE_BOTSSON
tags: [botsson, memory, engine_memory, handoff, phase-a3]
decisions: [ADR-0099]
learnings: []
---

# HANDOFF — Phase A3: Memory Writer

## What Was Built

Phase A3 materialised the `memory` capability, which had long been a stub. Prior to this phase
`engine_memory` had a reader (surfaced via `/api/emma/memory`) but no production writer —
`stage-engine`'s own `saveMemory()` was a service-role helper with no UI-facing path.

### Deliverables

| Artifact | Path | Status |
|---|---|---|
| `memory` capability (writer) | `packages/ai/src/capabilities/memory/` | 🟢 |
| `save_memory` tool | `packages/ai/src/capabilities/memory/tools.ts` | 🟢 |
| `memory-writer.ts` context module | `packages/ai/src/context/memory-writer.ts` | 🟢 |
| Authority seed update | `supabase/migrations/...` | 🟢 |
| Arena MemoryView wired | `apps/web/src/app/Botsson/BotssonArena.tsx` (MemoryView) | 🟢 |
| `/api/emma/memory` route | `apps/web/src/app/api/emma/memory/route.ts` | 🟢 |

### How It Works

1. Agent receives context from `memory-manager.ts` (reader — existed since 2026-03).
2. When agent decides to save a memory, it calls `save_memory` tool.
3. `save_memory` is `chat-only` channel, gated via `gate_action` (ADR-0099).
4. PII-filter runs before INSERT into `engine_memory`.
5. Standard authority = `read_only` (hidden) — workspace must opt in for the agent to write memories.
6. `add_key_fact` tool in `onboarding` capability is an alias that proxies to `save_memory` Phase A3 pattern.

### Data Model

- Table: `engine_memory` (workspace-scoped, `scope` column: `personal` / `conversation` / `workspace`)
- `engine_memory` had a reader via `memory-manager.ts` since 2026-03
- Writer via capability/gate_action pattern landed 2026-04-22

## Decisions Made

- **ADR-0099**: All mutation tools gate via `gate_action`. `save_memory` follows this — not bypassed.
- Standard authority = `read_only` by default — opt-in model to prevent agent autonomously cluttering memory.

## Learnings

- `stage-engine`'s `saveMemory()` service-role helper is intentionally separate — future session-summary writer. Do not conflate with capability-level `save_memory`.
- Embedding column in `engine_memory` remains NULL — retrieval ranked by importance, not similarity. Do not add vector search without ADR.

## Known Issues / Debt

- Embedding column: NULL by design (not an error). Future ADR needed for similarity retrieval.
- `engine_memory` write path has no bulk-delete / TTL policy — retention is indefinite until governance sortie.

## Next Steps

- `add_key_fact` in onboarding is an alias pattern; if onboarding capability scope grows, consider promoting to dedicated capability.
- TTL / retention policy for `engine_memory` is unplanned — track in MODULE_BOTSSON backlog.
