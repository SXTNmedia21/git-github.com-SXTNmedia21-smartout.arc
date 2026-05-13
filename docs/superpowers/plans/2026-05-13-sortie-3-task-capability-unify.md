---
title: "Plan — Sortie 3 task-capability-unify"
slug: sortie-3-task-capability-unify
status: ready
revision: v1
layer: plan
created: 2026-05-13
updated: 2026-05-13
spec: docs/superpowers/specs/2026-05-13-sortie-3-task-capability-unify-design.md
adr: ADR-0298
sortie_adr_reserved: ADR-0301
target_branch: feat/task-capability-unify
target_worktree: ~/dev/smartout.ai-wt-5
tags: [sortie-3, plan, task-capability, ADR-0298, ADR-0301]
---

# Plan — Sortie 3 task-capability-unify

> Branch: `feat/task-capability-unify` | Worktree: `~/dev/smartout.ai-wt-5` | Base: `development` | Module: cascade

**Spec:** [2026-05-13-sortie-3-task-capability-unify-design.md](../specs/2026-05-13-sortie-3-task-capability-unify-design.md)

## Goal

Ship ADR-0298 row 3: new `task` capability with 6 tools + intent-classifier extension + `collector.ts` R7 personal_task fetch + `resolveTaskType` restoration + BFF complete route + `addTaskAction` delegation. No mobile UI; no new task tables.

## Pre-flight

- [ ] P.1 — Main repo on `development` (clean or only spec+plan staged)
- [ ] P.2 — Spec + plan present on development
- [ ] P.3 — ADR-0301 slot free (`grep "ADR_0301\|ADR-0301" docs/decisions/`)
- [ ] P.4 — `new-feature.sh task-capability-unify 5 cascade` spawns wt-5
- [ ] P.5 — Verify spec + plan present in wt-5; pre-warm install + dist build

## Phase 1 — Pre-flight greps + dist build

- [ ] T1.1 — `pnpm install --frozen-lockfile`
- [ ] T1.2 — `pnpm turbo build --filter=@smartout/telemetry --filter=@smartout/types --filter=@smartout/supabase --filter=@smartout/ai` (dist available before agent dispatch)
- [ ] T1.3 — Re-grep canonical reality per spec §3; assert all entry points exist
- [ ] T1.4 — `pnpm turbo typecheck` baseline green

## Phase 2 — Skeleton capability + types

- [ ] T2.1 — Create `packages/ai/src/capabilities/task/index.ts` per spec §4.1 + §4.2 (allowedChannels split)
- [ ] T2.2 — Create `packages/ai/src/capabilities/task/gate.ts` (gateAction helpers mirror `personal/gate.ts`)
- [ ] T2.3 — Create `packages/ai/src/capabilities/task/tools.ts` with 6 tool skeletons (defineTool exports, body = `not_implemented` placeholder)
- [ ] T2.4 — Extend `CapabilityName` union in `packages/ai/src/capabilities/types.ts`: add `"task"`
- [ ] T2.5 — Register `task: taskCapability` in `packages/ai/src/capabilities/registry.ts`
- [ ] T2.6 — `pnpm --filter @smartout/ai typecheck` green
- [ ] T2.7 — Commit: `feat(ai): task capability skeleton + registry (ADR-0298 Sortie 3)`

## Phase 3 — Authority seed + RPC v2 migration

- [ ] T3.1 — `supabase/migrations/20260607100000_task_capability_authority_seed.sql` per spec §4.3 (mirrors personal_task.sql seed block, capability='task')
- [ ] T3.2 — `supabase/migrations/20260607100100_fn_list_my_tasks_v2_hook_links.sql` — CREATE OR REPLACE adds `hook_linked_procedure_id UUID`, `hook_linked_routine_id UUID`; SESSION branch JOINs `session_hook`; other branches NULL-fill
- [ ] T3.3 — `npx supabase migration up` (without `op run` per L-op_run_supabase_gen_types_corrupts)
- [ ] T3.4 — `npx supabase gen types typescript --local > packages/supabase/src/database.types.ts` (no op run wrap)
- [ ] T3.5 — EXPLAIN ANALYZE for v2 RPC captured in commit message
- [ ] T3.6 — Commit: `feat(rpc): fn_list_my_tasks v2 + task capability authority seed`

## Phase 4 — Tool bodies (read + simple writes)

- [x] T4.1 — `task.list_mine` body: direct table reads across 4 arms (fn_list_my_tasks skipped — service_role auth.uid()=NULL per migration grant note); workspace_id + profile_id scoped
- [x] T4.2 — `task.create_personal` body: chat-only guard, gateTaskAction, INSERT personal_task, emit "task created" {source:'personal'}
- [x] T4.3 — `task.cancel_personal` body: chat-only guard, gateTaskAction, UPDATE SET status='cancelled' WHERE profile_id=self, emit "task cancelled"
- [x] T4.4 — `pnpm --filter @smartout/ai typecheck` green
- [x] T4.5 — Commit: `feat(task): list_mine + create_personal + cancel_personal tool bodies` (3441556d7)

## Phase 5 — Tool bodies (cross-source writes + complete dispatch)

- [x] T5.1 — `task.create_session` body: chat-only guard, gateTaskAction(task.create_session), session workspace-match, hook dept-match, assignee workspace-membership (L-0177), INSERT session_task, dual-emit ("task created" + "task.added_manual" alias)
- [x] T5.2 — `task.create_day_ad_hoc` body: chat-only guard, gateTaskAction, assignee check, INSERT schedule_day_task, emit "task created" {source:'day_ad_hoc'}
- [x] T5.3 — `task.complete` body: 4-branch dispatch (personal→UPDATE personal_task, session→UPDATE session_task+completed_by, day_ad_hoc→UPDATE schedule_day_task, emma→admin UPDATE emma_task); single emit "task completed" {source, completed_via}
- [x] T5.4 — `resolveAssigneeWorkspaceMembership` already present in gate.ts (Phase 2 skeleton); used in create_session + create_day_ad_hoc
- [x] T5.5 — `pnpm --filter @smartout/ai typecheck` green; all 50 test files pass (445 tests)
- [x] T5.6 — Phases 4+5 shipped together in commit 3441556d7 (both phases written atomically)

## Phase 6 — BFF route + addTaskAction wrapper

- [ ] T6.1 — `apps/web/src/app/api/mobile/tasks/[id]/complete/route.ts` (POST verb) per spec §4.6: `resolveMobileActor` → invoke `task.complete` tool body
- [ ] T6.2 — Rewrite `apps/web/src/app/dashboard/_actions/add-task-action.ts:55` body as thin wrapper around `task.create_session` tool (spec §4.7); preserve signature + return type
- [ ] T6.3 — Update telemetry registry `packages/telemetry/src/registry.ts`: add `"task created"`, `"task completed"`, `"task cancelled"`, `"task assigned"`, `"task overdue"` events with 4-destination routing; keep `task.added_manual` as alias for 30 days
- [ ] T6.4 — `pnpm turbo typecheck` clean
- [ ] T6.5 — Commit: `feat(task): mobile BFF complete route + addTaskAction delegates`

## Phase 7 — Intent-classifier + collector.ts R7

- [ ] T7.1 — Extend capability enum in `packages/ai/src/router/intent-classifier.ts:38-72` with `"task"`
- [ ] T7.2 — Add alias-shim `aliasTaskVerbs(intent)` in `packages/ai/src/router/router.ts` (or equivalent); routes `personal` + task-verb → `task` for 30 days
- [ ] T7.3 — Update `packages/ai/src/router/__evals__/intent-classifier.eval.ts` with 4 task-verb examples per spec §6.2
- [ ] T7.4 — Update `packages/ai/src/context/collector.ts`: add `personal_task` fetch as 6th Promise.all member; thread into `AgentContext.personalTasks` (new field in `types.ts`)
- [ ] T7.5 — Update prompt assembler (`packages/ai/src/prompts/system.ts` or equivalent) to inject `<active_tasks>` slice when non-empty
- [ ] T7.6 — `pnpm --filter @smartout/ai typecheck` + `pnpm --filter @smartout/ai test -- intent-classifier` green
- [ ] T7.7 — Commit: `feat(router): task intent + alias shim + collector.ts R7 wiring`

## Phase 8 — resolveTaskType restoration

- [ ] T8.1 — Update `apps/mobile/src/hooks/queries/use-my-tasks.ts`: extend `MyTaskRow` type with `hook_linked_procedure_id` + `hook_linked_routine_id`
- [ ] T8.2 — Update `apps/mobile/src/lib/resolve-task-type.ts`: add procedure + checklist branches before confirmation fallback per spec §4.10
- [ ] T8.3 — `pnpm --filter @smartout/mobile typecheck` green
- [ ] T8.4 — Manual smoke: PWA `localhost:8083` task list refresh; HACCP/procedure/checklist/confirmation/general render distinct UI
- [ ] T8.5 — Commit: `feat(mobile): restore resolveTaskType procedure + checklist branches`

## Phase 9 — Tests

- [ ] T9.1 — `packages/ai/src/capabilities/task/__tests__/tools.test.ts` — 9 vitest cases per spec §6.1
- [ ] T9.2 — `supabase/tests/sortie-3-task-capability.spec.sql` — 4 pgTAP cases per spec §6.3
- [ ] T9.3 — `pnpm --filter @smartout/ai test -- task` all green
- [ ] T9.4 — `npx supabase test db` all green
- [ ] T9.5 — Commit: `test(task): vitest + pgTAP coverage for task capability + RPC v2`

## Phase 10 — Closure

- [ ] T10.1 — `docs/HANDOFF-task-capability-unify.md` per feature-closure template
- [ ] T10.2 — `docs/journeys/JOURNEY-task-capability-unify.md` covering 5 journeys: (a) employee asks Botsson "hva må jeg gjøre" → list_mine union; (b) manager voice-says "lag oppgave til Anna" → create_session with assignee verification; (c) employee taps complete on mobile → BFF route → source-dispatch; (d) cross-workspace assignee rejected; (e) chat-only enforcement on create_*
- [ ] T10.3 — `docs/decisions/0301-task-capability-unify.md` (status: accepted); register in `0000-decision-log.md`
- [ ] T10.4 — `pnpm turbo typecheck` final gate green
- [ ] T10.5 — Closure commit: `docs(sortie-3): HANDOFF + JOURNEY + ADR-0301 closure`
- [ ] T10.6 — Tell Pontus: "Sortie 3 ready for closure. Run `close-feature.sh 5` to merge `feat/task-capability-unify` → development."

## Acceptance criteria

- [ ] `pnpm turbo typecheck` green
- [ ] All vitest + pgTAP green (13+ assertions)
- [ ] Decision log + ADR-0301 registered
- [ ] HANDOFF + JOURNEY present
- [ ] 2 SQL migrations applied + idempotent on db reset
- [ ] Task capability registered + 6 tools wired
- [ ] `intent-classifier` enum extended + alias shim live
- [ ] `collector.ts` R7 personal_task slice in system prompt
- [ ] `resolveTaskType` returns 5 distinct types
- [ ] `addTaskAction` callers unbroken
- [ ] Zero mobile UI work (deferred Sortie 4)
- [ ] Zero `engine_state_step` exposure
