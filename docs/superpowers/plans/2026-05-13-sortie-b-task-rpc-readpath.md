---
title: "Plan — task-rpc-readpath (Sortie B)"
slug: task-rpc-readpath
status: done
revision: v1
layer: plan
created: 2026-05-13
updated: 2026-05-13
spec: docs/superpowers/specs/2026-05-13-sortie-b-task-rpc-readpath-design.md
adr: ADR-0298
sortie_adr_reserved: ADR-0300
target_branch: feat/task-rpc-readpath
target_worktree: ~/dev/smartout.ai-wt-4
tags: [sortie-b, task-ontology, rpc, plan, ADR-0298, ADR-0300]
---

# Plan — task-rpc-readpath (Sortie B)

> Branch: `feat/task-rpc-readpath` | Worktree: `~/dev/smartout.ai-wt-4` | Base: `development` | Module: cascade | Started: 2026-05-13

**Spec:** [2026-05-13-sortie-b-task-rpc-readpath-design.md](../specs/2026-05-13-sortie-b-task-rpc-readpath-design.md)

## Goal

Ship ADR-0298 single read surface: `fn_list_my_tasks` RPC + 2 normalize helpers + mobile hook rewire + activity_trail backfill. Read-only sortie.

## Pre-flight

- [ ] P.1 — On main repo `development` branch
- [ ] P.2 — Spec + plan committed on development (single commit, local-only)
- [ ] P.3 — ADR-0300 slot free
- [ ] P.4 — `new-feature.sh task-rpc-readpath 4 cascade` spawns wt-4
- [ ] P.5 — Verify spec + plan present in wt-4

## Phase 1 — Pre-flight greps + canonical reality re-lock

- [ ] Task 1.1 — Re-grep EntityType union; assert 5 task entity types present
- [ ] Task 1.2 — Verify `session_task.completed_at` column exists; escalate trigger 1 if missing
- [ ] Task 1.3 — Verify `activity_trail.entity_id` column type (UUID vs TEXT); adjust §4.5 cast accordingly
- [ ] Task 1.4 — Verify `personal_task.priority` CHECK still `low|normal|high|urgent`
- [ ] Task 1.5 — Update spec §3 if drift; commit drift amendment BEFORE Phase 2

## Phase 2 — Helper functions

- [ ] Task 2.1 — `supabase/migrations/20260606120000_fn_normalize_task_status_priority.sql` containing both helpers per spec §4.2 + §4.3
- [ ] Task 2.2 — Functions `IMMUTABLE PARALLEL SAFE LANGUAGE sql`
- [ ] Task 2.3 — `REVOKE ALL FROM PUBLIC` + `GRANT EXECUTE TO authenticated, service_role`
- [ ] Task 2.4 — Apply locally via `npx supabase migration up`; assert `\df+ fn_normalize_*` shows both
- [ ] Task 2.5 — Commit: `feat(rpc): add fn_normalize_session_task_status + fn_normalize_priority helpers`

## Phase 3 — `fn_list_my_tasks` RPC

- [ ] Task 3.1 — `supabase/migrations/20260606120100_fn_list_my_tasks.sql` with full body per spec §4.1
- [ ] Task 3.2 — Function declared `SECURITY DEFINER STABLE LANGUAGE sql SET search_path = public`
- [ ] Task 3.3 — `REVOKE ALL FROM PUBLIC` + `GRANT EXECUTE TO authenticated`
- [ ] Task 3.4 — `COMMENT ON FUNCTION` per spec §4.1 (includes ADR-0298 ref + R2 + R7 forward note)
- [ ] Task 3.5 — Apply locally; smoke-test `SELECT * FROM fn_list_my_tasks() LIMIT 5` as seeded user
- [ ] Task 3.6 — EXPLAIN ANALYZE plan captured in commit message
- [ ] Task 3.7 — Commit: `feat(rpc): add fn_list_my_tasks union read surface (ADR-0298 Sortie 2)`

## Phase 4 — Mobile `useMyTasks` rewire

- [ ] Task 4.1 — Rewrite `apps/mobile/src/hooks/queries/use-my-tasks.ts` per spec §4.4: introduce `MyTaskRow` type, replace direct PostgREST with `supabase.rpc("fn_list_my_tasks", ...)`, preserve MMKV cache + compliance-first sort
- [ ] Task 4.2 — Update `apps/mobile/src/hooks/queries/use-operations-feed.ts` mapping
- [ ] Task 4.3 — Update `apps/mobile/src/components/task/TaskFeed.tsx` row props
- [ ] Task 4.4 — Update `apps/mobile/src/components/task/TaskModal.tsx` single-row props
- [ ] Task 4.5 — `pnpm --filter @smartout/mobile typecheck` clean
- [ ] Task 4.6 — `pnpm turbo typecheck` clean (catches any other consumer)
- [ ] Task 4.7 — Commit: `chore(mobile): rewire useMyTasks to fn_list_my_tasks RPC`

## Phase 5 — `activity_trail` backfill

- [ ] Task 5.1 — `supabase/migrations/20260606121000_activity_trail_personal_task_backfill.sql` per spec §4.5
- [ ] Task 5.2 — Narrow predicate `entity_type = 'personal_task_action' AND entity_id IN (SELECT id::text FROM personal_task)` (cast direction per Phase 1 task 1.3)
- [ ] Task 5.3 — Apply locally; assert RAISE NOTICE rowcount in output
- [ ] Task 5.4 — Idempotency check: re-apply or db reset cycle; second run reports 0 rows
- [ ] Task 5.5 — Commit: `fix(activity-trail): backfill historical personal_task_action entity_type`

## Phase 6 — pgTAP tests

- [ ] Task 6.1 — `supabase/tests/sortie-b-fn-list-my-tasks.spec.sql` with seed: 2 workspaces, 3 profiles (E1 W1, E2 W1+W2, M1 W1)
- [ ] Task 6.2 — Implement P1-P10 + N1-N5 per spec §6
- [ ] Task 6.3 — `supabase/tests/sortie-b-activity-trail-backfill.spec.sql` per spec §6 backfill section
- [ ] Task 6.4 — `supabase test db` — both spec files green
- [ ] Task 6.5 — Commit: `test(pgtap): coverage for fn_list_my_tasks + activity_trail backfill`

## Phase 7 — Closure

- [ ] Task 7.1 — `docs/HANDOFF-task-rpc-readpath.md` per feature-closure template
- [ ] Task 7.2 — `docs/journeys/JOURNEY-task-rpc-readpath.md` covering 3 journeys: (a) employee mobile task list union of 4 sources; (b) NULL-assigned schedule_day_task appears for all W1 members; (c) multi-workspace E2 sees W1+W2 in single fetch
- [ ] Task 7.3 — `docs/decisions/0300-task-rpc-readpath.md` registering ADR-0300; status `accepted`; cross-link ADR-0298 row 2
- [ ] Task 7.4 — Register ADR-0300 in `docs/decisions/0000-decision-log.md`
- [ ] Task 7.5 — `pnpm turbo typecheck` final gate clean
- [ ] Task 7.6 — Single closure commit: `docs(sortie-b): HANDOFF + JOURNEY + ADR-0300 closure`
- [ ] Task 7.7 — Tell Pontus: "Sortie B ready for closure. Run `close-feature.sh 4` to merge."

## Acceptance Criteria

- [ ] Typecheck passes: `pnpm turbo typecheck`
- [ ] Decision log updated (ADR-0300)
- [ ] User journeys written
- [ ] HANDOFF written
- [ ] 3 SQL migrations apply on local Supabase (db reset cycle)
- [ ] 2 pgTAP spec files green (16+ assertions)
- [ ] `useMyTasks` + 3 mobile consumers adapted
- [ ] Backfill idempotent
- [ ] Zero capability tool changes
- [ ] Zero mobile UI work
