---
title: "L-0241 — UI-local task state callbacks collide with task.complete capability"
id: L-0241
status: accepted
created: 2026-05-13
updated: 2026-05-13
module: agent-architecture
tags: [task-ontology, botsson-arena, dual-naming, capability, l-0182]
related: [ADR-0298, L-0176, L-0237]
---

# L-0241: UI-local task state callbacks collide with task.complete capability namespace

## Trigger

ADR-0298 task ontology cutover (Sortie 3 + 5b) introduced `task.complete` capability tool with source-dispatched dispatch (session / personal / day_ad_hoc / emma).

Code-trace by council 2026-05-13 found `apps/web/src/app/Botsson/_components/BotssonProvider.tsx:396` exposes `completeTask(taskId)` callback bound to local React state (Emma in-memory task list, NOT session_task).

Same function name. Different entity. Different layer. Different lifecycle.

Council scoped Botsson Arena `completeTask` as DO NOT TOUCH for Sortie 5b. Correct decision. But:

- New contributor reads "I need to complete a task in Botsson" → finds `BotssonProvider.completeTask` → wires UI button to wrong layer.
- Botsson Arena LLM (Ultravox-era voice tool registry) at `BotssonTools.ts:404` declares `modelToolName: "complete_task"` for the in-memory task list. After Sortie 5b, capability `complete_task` is deleted. Voice/chat invocation of `complete_task` now hits a dead tool OR the Arena local handler (depending on router lookup order). Disambiguation broken.

## Pattern

When unifying a capability namespace, existing UI-local state callbacks with the same verb create silent shadow API. The shadow lives until:
- A contributor calls the wrong one
- The Tracker/Ultravox/LiveKit registry resolves the wrong one
- Telemetry emits to the wrong namespace

Same anti-pattern class as L-0237 (silently accepting forgeable identity). Difference: that was about Zod-level schema; this is about function-name-level UI/capability collision.

## Rule

When a new capability tool launches and a UI-local callback shares the same verb:

1. **Rename UI-local callback** to disambiguate (e.g. `BotssonProvider.completeTask` → `BotssonProvider.markEmmaTaskComplete` OR `BotssonProvider.dismissTask`).
2. **Update LLM tool registry** (`BotssonTools.ts`) to use the renamed verb.
3. **Verify Ultravox/LiveKit voice tool name** doesn't collide.
4. **Audit comments** referencing the old verb — replace.

Do this at the same commit as the capability launch, not as a deferred sortie. The shadow API is born at capability launch and lives until rename.

## Mitigation

Suggest follow-up sortie `botsson-arena-completetask-rename`:
- Rename `BotssonProvider.completeTask` → `BotssonProvider.dismissEmmaTask` (or similar)
- Update `BotssonTools.ts:404` modelToolName + handler
- Update `BotssonArena.tsx` callers
- Verify Ultravox voice tool name (or confirm LiveKit migration superseded this Tracker)

Scope: ~3-5 files, ~50 lines, 30 min.

## Sibling references

- ADR-0298 row 5b (operations.complete_task hard-delete that exposed this collision)
- L-0237 (forgeable identity at Zod boundary)
- L-0176 (docstring claims drift from body — same class)
