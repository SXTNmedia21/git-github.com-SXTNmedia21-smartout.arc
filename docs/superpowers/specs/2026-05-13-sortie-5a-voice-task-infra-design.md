---
title: "Sortie 5a — Voice Task Infra (Design Spec)"
slug: sortie-5a-voice-task-infra
status: ready
revision: v1
layer: spec
created: 2026-05-13
updated: 2026-05-13
adr: ADR-0298
sortie_adr_reserved: ADR-0303
related_sorties: [Sortie-3 (ADR-0301), Sortie-4 (ADR-0302)]
campaign: sortie-5-task-cutover
tags: [sortie, spec, voice-agent, task, livekit, ADR-0298]
---

# Sortie 5a — Voice Task Infra (Design Spec)

## 1. Goal

Wire LiveKit voice-agent typed task tools mirroring ADR-0298 capability surface. Enable voice path for `task.list_mine` + `task.complete` (chat+voice safe per ADR-0298 R6); chat-only refusal on `task.create_*` + `task.cancel_personal`. Prerequisite for Sortie 5b hard-delete of `operations.complete_task`.

## 2. Non-goals

- Hard-delete `operations.complete_task` (Sortie 5b).
- Drop telemetry/intent-classifier aliases (Sortie 5c).
- New BFF routes.
- New capability tools (Sortie 3 shipped them).
- Real LiveKit Room.connect e2e (in-process unit test only — full Playwright deferred).
- ADR-0298 promote (Sortie 5b after hard-delete).
- HMS module migration (separate sortie).
- Botsson Arena Ultravox cleanup (separate sortie).

## 3. Canonical reality

- `services/voice-agent/src/adapter.ts:177-186` `buildAllBotssonTools()` spreads `{ orb, personal, capability, schedule }`. No task tools.
- `services/voice-agent/src/tools-personal.ts:53` has `create_task` (free-text wrapper to `ask()`). After Sortie 5a it stays but description updated to point at task namespace.
- `services/voice-agent/src/tools-capability.ts` is the read-only voice surface (queries via `ask()` pipe).
- ADR-0298 R6 channel policy:
  - chat + voice: `list_mine`, `complete`
  - chat-only: `create_personal`, `create_session`, `create_day_ad_hoc`, `cancel_personal`
- Sortie 3 commit `c3bf46610` shipped task capability tools at `packages/ai/src/capabilities/task/{index,tools,gate}.ts`. Per-tool channel guard in tool bodies (returns `chat_only_in_v1` on voice).
- L-0233: voice Realtime LLM ≠ stage-engine LLM. Voice path = LiveKit `agent.chatCtx.updateChatCtx()`. Voice tools call `ask()` which forwards to stage-engine `/agent/chat`.
- `services/voice-agent/__tests__/no-nc.test.ts` is the only test file; no harness for tool dispatch.

## 4. Architecture

### 4.1 tools-task.ts — 6 thin tool wrappers

New file `services/voice-agent/src/tools-task.ts` follows `tools-personal.ts` pattern:

```ts
export function buildTaskTools(ask: AskFn) {
  return {
    // Voice + chat safe
    list_my_tasks: llm.tool({ description: "...", parameters: {...}, execute: async (args) => ask(query, "list_my_tasks") }),
    complete_task: llm.tool({ description: "...", parameters: {...}, execute: async (args) => ask(query, "complete_task") }),
    // Chat-only — voice path returns refusal via stage-engine channel guard
    create_personal_task: llm.tool({ ... }),
    create_session_task: llm.tool({ ... }),
    create_day_task: llm.tool({ ... }),
    cancel_personal_task: llm.tool({ ... }),
  };
}
```

Tool name convention: prefix Norwegian-natural verbs. LLM picks via description match. Each tool description in Norwegian.

Channel enforcement: chat-only tools call `ask()` which forwards to stage-engine. Stage-engine channel guard (per ADR-0288) returns refusal text on voice channel. Voice-agent does NOT block — relies on stage-engine being the single source of truth for channel policy.

### 4.2 adapter.ts wiring

Add to `buildAllBotssonTools()`:
```ts
import { buildTaskTools } from "./tools-task.js";
const taskTools = buildTaskTools(ask);
return { ...orbTools, ...personalTools, ...capabilityTools, ...scheduleTools, ...taskTools };
```

### 4.3 tools-personal.ts update

- `create_task` description amended: "Bruk task.create_personal_task i stedet hvis tilgjengelig — denne er fallback for fri-tekst."
- No deletion (avoids breaking existing voice sessions mid-flight).

### 4.4 In-process test harness

New file `services/voice-agent/__tests__/tools-task.test.ts`:

- Mock `ask` function with `vi.fn().mockResolvedValue("...")`.
- For each tool: invoke `execute()` with valid args, assert `ask()` called with expected query string + label.
- Boundary tests: missing required field → JSON schema rejects at LLM layer (out of scope), but verify tool description contains keyword hints.

Reuse existing vitest setup (look at `services/voice-agent/__tests__/no-nc.test.ts` for pattern).

### 4.5 Documentation

- Update `services/voice-agent/README.md` "Tool surface" section if exists — add task tools row.
- Update `adapter.ts` JSDoc lines 162-169 — add task row.

## 5. Test surface

### 5.1 Vitest

`services/voice-agent/__tests__/tools-task.test.ts`:
- T1: `list_my_tasks` → `ask()` called with query containing "Vis mine oppgaver"
- T2: `complete_task(id: 'uuid', source: 'session')` → `ask()` called with query containing id + source
- T3: `create_personal_task(title, due_at?, priority?)` → `ask()` called with title + due_at + priority
- T4: `create_session_task(session_id, title, assignee_profile_id?, hook_id?, compliance?, reason)` → `ask()` called
- T5: `create_day_task(date, title, ...)` → `ask()` called
- T6: `cancel_personal_task(id, reason)` → `ask()` called
- T7: `buildTaskTools` returns 6 keys
- T8: `buildAllBotssonTools` includes task tools (smoke)

### 5.2 Typecheck

`pnpm turbo typecheck` clean (52 tasks).

### 5.3 Manual smoke (deferred to Sortie 5b — needs end-to-end voice session)

## 6. Risk + mitigation

| Risk | Mitigation |
|---|---|
| LLM picks `create_task` (personal) over `create_personal_task` (task) due to description overlap | Per spec §4.3, deprecate `create_task` description to point at task namespace. Defer hard rename to Sortie 5c. |
| Voice channel returns chat-refusal text mid-conversation (UX awkward) | Per ADR-0298 R6 + ADR-0288, stage-engine returns "Si dette på tekst..." in Norwegian. Acceptable V1 UX. |
| Tool description language drift (NB vs EN) | Mirror `tools-personal.ts` Norwegian descriptions verbatim. |
| ask() pipe routes to wrong capability | Stage-engine intent-classifier + alias shim (still in place per Sortie 3) handles routing. |
| No real LiveKit harness in CI | Out of scope. Sortie 5a covers unit-test layer only. |

## 7. Escalation

Council escalation only if:
- New BFF route required (none expected).
- Channel policy V1 changes (would invalidate ADR-0298 R6).

## 8. References

- ADR-0298 R6 (channel policy)
- ADR-0288 (voice channel policy split)
- ADR-0132 (mobile thin client, voice-agent included)
- L-0233 (voice Realtime LLM ≠ stage-engine)
- L-0234 (voice view-tools mirror pattern)
- Sortie 3 HANDOFF (task capability shipped)
- Council 2026-05-13 verdict (4× APPROVE WITH CHANGES)
