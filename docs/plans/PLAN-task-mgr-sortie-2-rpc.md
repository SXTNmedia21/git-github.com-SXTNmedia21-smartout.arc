---
title: "Plan — task-mgr-sortie-2-rpc"
status: done
updated: 2026-05-14
created: 2026-05-14
module: task-manager
tags: [plan]
---

# Plan — task-mgr-sortie-2-rpc

> Branch: `feat/task-mgr-sortie-2-rpc` | Worktree: /home/sxtnl/dev/smartout.ai-wt-4 | Base: `development` | Module: task-manager | Started: 2026-05-14

## Goal

Formalize the `fn_list_my_tasks` RPC contract (auth divergence invariant, TS-fallback shape, drift-marker requirement) into ADR-0317, register `task.list_mine` telemetry event, strengthen drift markers in tools.ts, and write the JOURNEY covering all three caller paths.

## Context discovered at session start

- `fn_list_my_tasks` v1 + v2 migrations already exist on development (shipped in prior sorties).
- ADR-0314 taken (PDF preview gate). ADR-0315 taken in git history. Using **ADR-0317**.
- L-0245 (drift-marker rule) already codified from prior sortie — no new L-0253 needed.
- `task.list_mine` telemetry event NOT registered — added this sortie.
- TS-fallback in tools.ts documented but lacked ADR-0317 cross-reference — updated.

## Tasks

- [x] Task 1 — ADR slot verification (0314 taken, 0315 taken, 0316 free)
- [x] Task 2 — ADR-0317 at `docs/decisions/0317-fn-list-my-tasks-auth-divergence-invariant.md`
- [x] Task 3 — Register ADR-0317 in `docs/decisions/0000-decision-log.md`
- [x] Task 4 — `task.list_mine` TypeScript interface + routing entry in `packages/telemetry/src/registry.ts`
- [x] Task 5 — Drift markers updated in `packages/ai/src/capabilities/task/tools.ts` (file-header + execute body, citing ADR-0317)
- [x] Task 6 — JOURNEY at `docs/journeys/JOURNEY-task-mgr-sortie-2-rpc.md` (mobile employee + mobile manager + agent caller paths)
- [x] Task 7 — L-0253 decision: SKIPPED — no new meta-pattern. L-0245 already covers the drift-marker rule; this sortie applied it without discovering new shape.
- [ ] Task 8 — typecheck pass

## Acceptance Criteria

- [x] Decision log updated (ADR-0317 registered)
- [x] User journeys written (3 paths: mobile employee, mobile manager, agent caller)
- [ ] Typecheck passes: `pnpm turbo typecheck`

## Deliverables

| File | Status |
|------|--------|
| `docs/decisions/0317-fn-list-my-tasks-auth-divergence-invariant.md` | done |
| `docs/decisions/0000-decision-log.md` (ADR-0317 row added) | done |
| `packages/telemetry/src/registry.ts` (TaskListMine interface + routing entry) | done |
| `packages/ai/src/capabilities/task/tools.ts` (drift markers strengthened) | done |
| `docs/journeys/JOURNEY-task-mgr-sortie-2-rpc.md` | done |
| L-0253 | skipped (justified above) |
| New migration | NOT NEEDED — fn_list_my_tasks v2 already on development |
