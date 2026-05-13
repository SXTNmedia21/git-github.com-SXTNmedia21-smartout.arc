---
title: "Plan — Sortie 5a voice-task-infra"
slug: sortie-5a-voice-task-infra
status: ready
revision: v1
layer: plan
created: 2026-05-13
updated: 2026-05-13
spec: docs/superpowers/specs/2026-05-13-sortie-5a-voice-task-infra-design.md
adr: ADR-0298
sortie_adr_reserved: ADR-0303
campaign: sortie-5-task-cutover
target_branch: feat/sortie-5-task-cutover-voice-task-infra
target_worktree: ~/dev/smartout.ai-sortie-5-task-cutover-wt-1
tags: [sortie-5a, plan, voice-agent, task]
---

# Plan — Sortie 5a voice-task-infra

> Sub-sortie of campaign `sortie-5-task-cutover` | Branch: `feat/sortie-5-task-cutover-voice-task-infra` | Worktree: wt-1

## Goal

Ship `tools-task.ts` typed voice-agent surface (6 thin tools) + adapter wiring + vitest coverage. Prereq for 5b hard-delete.

## Phases

### Phase 1 — Pre-flight + greps

- [ ] T1.1 — `pnpm install` warm + dist build (done as part of setup)
- [ ] T1.2 — Verify `ask` AskFn signature unchanged (`tools-personal.ts:21`)
- [ ] T1.3 — `pnpm turbo typecheck` baseline green

### Phase 2 — tools-task.ts

- [ ] T2.1 — Create `services/voice-agent/src/tools-task.ts` per spec §4.1: 6 `llm.tool()` wrappers, each calling `ask()`
- [ ] T2.2 — Norwegian descriptions matching ADR-0298 tool semantics
- [ ] T2.3 — `additionalProperties: false` on every JSON schema (LLM-side strict)
- [ ] T2.4 — `pnpm --filter @smartout/voice-agent typecheck` green
- [ ] T2.5 — Commit: `feat(voice-agent): tools-task.ts — 6 task tool wrappers (ADR-0298 row 5a)`

### Phase 3 — adapter.ts wiring + tools-personal.ts amend

- [ ] T3.1 — Add `buildTaskTools` import + spread in `buildAllBotssonTools()` per spec §4.2
- [ ] T3.2 — Update adapter.ts JSDoc lines 162-169 to include task row
- [ ] T3.3 — Amend `tools-personal.ts:53` `create_task` description to point at task namespace per spec §4.3
- [ ] T3.4 — `pnpm --filter @smartout/voice-agent typecheck` green
- [ ] T3.5 — Commit: `feat(voice-agent): wire tools-task into adapter + soft-deprecate personal.create_task`

### Phase 4 — Tests

- [ ] T4.1 — Create `services/voice-agent/__tests__/tools-task.test.ts` per spec §5.1 (T1-T8)
- [ ] T4.2 — `pnpm --filter @smartout/voice-agent test` all green
- [ ] T4.3 — `pnpm turbo typecheck` final gate green
- [ ] T4.4 — Commit: `test(voice-agent): tools-task vitest coverage`

### Phase 5 — Closure

- [ ] T5.1 — `docs/HANDOFF-sortie-5a-voice-task-infra.md`
- [ ] T5.2 — `docs/journeys/JOURNEY-sortie-5a-voice-task-infra.md` — 3 journeys: (a) voice "vis mine oppgaver" → list_my_tasks → ask() → fn_list_my_tasks; (b) voice "marker som ferdig" → complete_task → ask() → task.complete; (c) voice "lag oppgave til Anna" → create_session_task → ask() → stage-engine returns "Si dette på tekst..." (chat-only refusal)
- [ ] T5.3 — No new ADR for 5a (sub-sortie within campaign; campaign closure ADR-0303 in 5b)
- [ ] T5.4 — `pnpm turbo typecheck` final
- [ ] T5.5 — Closure commit: `docs(sortie-5a): HANDOFF + JOURNEY closure`
- [ ] T5.6 — Tell Pontus: "Sortie 5a ready for sub-sortie closure. Run `close-feature.sh` from wt-1 to merge into campaign."

## Acceptance criteria

- [ ] `pnpm turbo typecheck` green
- [ ] vitest tools-task.test.ts all green (8 cases)
- [ ] tools-task.ts present + wired in adapter.ts
- [ ] tools-personal.ts create_task description amended (no deletion)
- [ ] HANDOFF + JOURNEY present
- [ ] No production deletes
- [ ] No new BFF routes
- [ ] No telemetry registry changes
- [ ] No intent-classifier changes
