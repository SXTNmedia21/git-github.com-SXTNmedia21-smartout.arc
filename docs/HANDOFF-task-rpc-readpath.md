---
title: "HANDOFF — Task RPC Read-Path (Sortie B)"
status: done
updated: 2026-05-13
created: 2026-05-13
module: cascade
tags: [sortie-b, task-ontology, rpc, ADR-0298, ADR-0300]
---

# HANDOFF — Task RPC Read-Path (Sortie B)

> Branch: `feat/task-rpc-readpath` | Worktree: `/home/sxtnl/dev/smartout.ai-wt-4`
> Base: `development` | Closed: 2026-05-13

---

## What Was Built and Why

Sortie B delivers the **single read surface** mandated by ADR-0298 §Architecture: a SECURITY DEFINER RPC `fn_list_my_tasks` that unions four task sources into one normalized result set, wired into the mobile `useMyTasks` hook.

Before this sortie, mobile task reads were fragmented across 4+ separate queries with heterogeneous status enums, no consistent priority ordering, no workspace isolation invariant at the RPC layer, and a `resolveTaskType` function that silently dropped task type metadata for hooked tasks. The mobile hook was also wired directly to individual table queries, meaning any new task source required a new hook.

Sortie B ships:
1. **2 normalize helpers** (`fn_normalize_session_task_status`, `fn_normalize_priority`) — `IMMUTABLE PARALLEL SAFE`, `REVOKE ALL FROM PUBLIC`, grants to `authenticated` + `service_role`.
2. **`fn_list_my_tasks` RPC** — SECURITY DEFINER, identity from `auth.uid()`, UNION across `session_task` (D6 cascade), `schedule_day_task` (D6 ad-hoc), `personal_task` (C2 user-curated), `emma_task` (C2 agent-curated). `engine_state_step` excluded per R2. NULL-assigned `schedule_day_task` rows visible to all workspace members (pickup flow). Multi-workspace: single call returns all workspaces the caller is a member of.
3. **`activity_trail` backfill migration** — seeds `personal_task_action` → `personal_task` entity_type corrections as zero-row no-op on local DB.
4. **21 pgTAP assertions** — 15 RPC invariants + 6 backfill checks. All green.
5. **`database.types.ts` regen** — types reflect new RPC signature.
6. **12-file mobile `useMyTasks` rewire** — consumers across `apps/mobile/` now call the single RPC surface. `resolveTaskType` updated with placeholder for hooked tasks pending Sortie 3.

Scope is deliberately read-only: no capability tools, no write paths, no mobile Kalender UI. Those belong to Sorties 3–5 per ADR-0298.

---

## 7 Commits — Enumerated

| SHA | Commit | Description |
|-----|--------|-------------|
| `2576a492e` | `docs(sortie-b): spec + plan` | Spec + canonical plan committed to development before wt-4 creation |
| `30c36fffd` | `feat(rpc): add fn_normalize_session_task_status + fn_normalize_priority helpers` | Migration `20260606120000` — 2 IMMUTABLE helpers, REVOKE FROM PUBLIC, GRANT to authenticated + service_role |
| `5e0864ea2` | `feat(rpc): add fn_list_my_tasks SECURITY DEFINER RPC` | Migration `20260606130000` — UNION across 4 task sources; identity from auth.uid(); NULL-assigned pickup flow; multi-workspace |
| `7e7d0b4b9` | `fix(db): backfill personal_task_action → personal_task entity_type` | Migration `20260606140000` — zero-row no-op on local; RAISE NOTICE rowcount for production apply |
| `791cff0c3` | `test(pgtap): 21 assertions — RPC + backfill invariants` | 15 RPC invariants (identity isolation, workspace boundary, NULL-assigned pickup, anon→0-rows, multi-workspace R8) + 6 backfill checks |
| `a2afcfb59` | `chore(types): regen database.types.ts for fn_list_my_tasks` | `pnpm supabase gen types` — adds `fn_list_my_tasks` return type to generated types |
| `2c0ab2804` | `feat(mobile): rewire useMyTasks to fn_list_my_tasks RPC (12 files)` | 12 consumer files updated; `resolveTaskType` extended with placeholder for procedure/checklist hook types |

---

## Decisions Made

### D1 — ADR-0300 (Sortie B Task RPC Read-Path)

Single SECURITY DEFINER RPC approach chosen over view-based approach (views can't SECURITY DEFINER across tables with heterogeneous RLS) and per-table hook fan-out (violates R1 single-surface requirement). Full decision: `docs/decisions/0300-task-rpc-readpath.md`.

### D2 — engine_state_step excluded (R2)

`engine_state_step` is workflow runtime state, never user-visible as a "task". R2 hardened as explicit exclusion in RPC body and pgTAP test N2 (service_role can't see engine_state_step rows through RPC).

### D3 — Anon JWT returns 0 rows, not GRANT error

N5 spec scenario reframed mid-build: anon JWT → `caller_profiles` CTE returns 0 rows (no `profile` row for anon uid) → RPC returns empty set silently. UI shows empty state. This is correct behavior — not an error surface. pgTAP fixture adjusted accordingly.

### D4 — `department_session.status` enum uses `'upcoming'` not `'open'`

pgTAP fixture for the D6 session-task source was initially written with `status = 'open'`. Local DB enum inspection showed actual value is `'upcoming'`. Fixture corrected. Added to learnings.

### D5 — `activity_trail` columns are `event` + `action_verb` (not `action`)

Spec §4.5 referenced `activity_trail.action`. Real schema has `event` (event name) + `action_verb` (CRUD verb). Backfill migration and pgTAP tests updated to use actual column names.

### D6 — P4 scope expanded from 4 to 12 files (spec §8 trigger 3)

Consumer count exceeded spec §4.4 threshold of 3 (actual: 5+). Council escalation resolved in-flight: option 1 (scope expand) chosen. All 12 consumer files rewired in `2c0ab2804`. Behavioral regression noted: `resolveTaskType` now returns placeholder for hooked procedure/checklist tasks — see Known Issues.

---

## Learnings

### L-NEW-A — grep consumer count BEFORE writing spec §4.4 threshold

Spec §4.4 set "rewire 3–4 consumers" as P4 scope. Real mobile codebase had 5+ `useMyTasks` consumers, triggering spec §8 trigger 3 (council escalation) mid-build. Pattern: for any mobile hook rewire, run `grep -r "useMyTasks\|useTasks" apps/mobile/src --include="*.ts" --include="*.tsx" | wc -l` before committing consumer count to spec. Reserve 2× the grep count as blast radius estimate.

### L-NEW-B — pgTAP fixture column drift: always inspect enum + column before writing fixtures

Two fixture adjustments were needed mid-build:
- `department_session.status` enum value is `'upcoming'`, not `'open'` — local DB `\dT+ department_session_status` would have caught this in 5 seconds.
- `activity_trail` columns are `event` + `action_verb`, not `action` — `\d activity_trail` lookup before spec authoring.
Pattern: for any pgTAP suite touching an enum column, run `\dT+ <enum_name>` locally BEFORE writing fixtures. For any table with audit columns, run `\d <table_name>` before spec authoring.

---

## Known Issues / Debt

### K1 — `resolveTaskType` placeholder for hooked tasks until Sortie 3

`resolveTaskType` in `apps/mobile/src/hooks/useMyTasks.ts` currently returns `'task'` (generic) for tasks sourced from `session_task` rows where `hook_linked_procedure_id` or `hook_linked_routine_id` is set. The correct mapping (procedure/checklist form) requires the `task` capability's `list_mine` tool to resolve the linked entity in the RPC or a join. **Restore in Sortie 3** when `hook_linked_procedure_id`/`hook_linked_routine_id` joins are wired into `fn_list_my_tasks` response or the capability tool resolves it client-side. Tracked: `resolveTaskType` lines 87–93 of `apps/mobile/src/hooks/useMyTasks.ts`.

### K2 — Pre-existing `@smartout/telemetry` TS2307 dist-build noise (~30 files)

The pre-push typecheck will surface `TS2307: Cannot find module '@smartout/telemetry'` in approximately 30 files if the telemetry package dist is stale. This is NOT a Sortie B regression — it pre-dates this branch. Resolve before close-feature: `pnpm --filter @smartout/telemetry build` then re-run `pnpm turbo typecheck`. Do not confuse with actual type errors introduced in this sortie.

### K3 — `personal_task_action` backfill is zero-row no-op on local DB

Migration `20260606140000` corrects `activity_trail` rows where `entity_type = 'personal_task_action'` (unregistered value emitted by pre-Sortie-1 `personal` capability). Local DB has no such rows. On first preview/main apply, `RAISE NOTICE` will report actual rowcount. No action required unless rowcount exceeds expectations — in that case, audit `activity_trail` for downstream consumers reading the bad entity_type value.

---

## Next Steps

1. **Pontus runs `close-feature.sh 4`** to merge `feat/task-rpc-readpath` into `development`.
2. **Sortie 3 (ADR-0301)** — Build `task` capability with 6 tools (`list_mine`, `create_personal`, `create_session`, `create_day_ad_hoc`, `complete`, `cancel_personal`); restore `resolveTaskType` mapping for procedure/checklist hooked tasks; wire `collector.ts` per ADR-0298 R7; replace 3 shadow paths (`personal.create_task` + `operations.complete_task` + `addTaskAction` Server Action).
3. **Sortie 4 (ADR-0302)** — Mobile Kalender UI per design handoff `docs/design/design_handoff_calendar/source/screens.jsx`.
4. **Sortie 5 (no ADR)** — E2E voice → list → complete coverage.
5. **ADR-0298 status** — Flip `proposed` → `accepted` when Sortie 3 ships (RPC + capability both live).

---

## Acceptance Criteria — Spec §9 Verification

| # | Criterion | Result |
|---|-----------|--------|
| A1 | `fn_list_my_tasks` returns rows for authenticated profile | PASS |
| A2 | Anon JWT returns 0 rows (no error) | PASS |
| A3 | NULL-assigned `schedule_day_task` visible to all workspace members | PASS |
| A4 | `schedule_day_task` from W2 does not leak to W1 caller | PASS |
| A5 | Multi-workspace caller E2 sees rows from W1 + W2 in single call | PASS |
| A6 | Deactivated workspace membership excluded from results | PASS |
| A7 | `engine_state_step` rows never appear in RPC output | PASS |
| A8 | `fn_normalize_session_task_status` returns expected mapped values | PASS |
| A9 | `fn_normalize_priority` returns expected mapped values | PASS |
| A10 | pgTAP: 21/21 assertions green | PASS |
| A11 | `database.types.ts` includes `fn_list_my_tasks` return type | PASS |
| A12 | All 12 `useMyTasks` consumers compile with 0 TS errors | PASS |
