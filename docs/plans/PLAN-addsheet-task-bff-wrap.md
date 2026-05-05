---
title: "Plan — addsheet-task-bff-wrap"
status: draft
updated: 2026-05-04
created: 2026-05-04
module: mobile
tags: [plan, mobile, task, bff, addsheet]
---

# Plan — addsheet-task-bff-wrap

> Branch: `feat/mobile-addsheet-task-bff-wrap` | Worktree: `~/dev/smartout.ai-mobile-wt-6` | Base: `campaign/mobile`

## Trigger

AddSheet BFF-wrap audit 2026-05-04: PARTIAL — `add-task-action.ts` exists + gates correctly + telemetry registered. Mobile bypass: `actionMap.create_task` (action-map.ts:146) does direct `supabase.from("session_task").insert(p)`, skipping `gateAction('task.add_task_manual')` + `emit("task.added_manual")`.

Smallest of three sorties (~0.5 days). Pure mobile fix.

## Goal

`actionMap.create_task` calls BFF instead of direct insert. BFF wraps existing `add-task-action.ts` with `actor` parameter (mirror ADR-0270 wt-2 pattern).

## Hard constraints

- Web `add-task-action.ts` — extend with `actor?` + `channel?` params (mirror ADR-0270 §B2/B3)
- ADR-0114, ADR-0099, ADR-0134, ADR-0151
- BFF Bearer-auth, JWT-derive workspace

## Phases

### Phase 1 — Refactor `add-task-action.ts`
- Accept `actor?: ResolvedActor` + `channel?: "chat" | "system"`
- Backward compat: cookie-flow callers unchanged

### Phase 2 — BFF route
- `apps/web/src/app/api/mobile/tasks/route.ts` — Bearer + delegate

### Phase 3 — Mobile sync
- `actionMap.create_task` calls BFF instead of direct insert
- Or deprecate to throwing stub (per ADR-0270 pattern)

### Phase 4 — ADR + review

## Acceptance
- [ ] Mobile `create_task` no longer direct-inserts
- [ ] BFF route Bearer-auth verified
- [ ] Web action accepts both auth-modes (cookie + actor)
- [ ] HANDOFF
