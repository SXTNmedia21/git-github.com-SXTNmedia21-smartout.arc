---
title: "Procedure Engine — E2E Coverage"
status: in_progress
mirror: mixed
last_verified: 2026-05-22
updated: 2026-05-22
created: 2026-05-22
domain: procedure-engine
tags: [domain, procedure-engine, e2e, playwright, maestro, vitest, test-matrix, adr-0298, adr-0391]
---

# Procedure Engine — E2E Coverage

> Test matrix = proof of what is actually built and tested. `mirror: mixed` — existing tests verified; Phase 1 targets are aspirational.
> **Code wins** — presence of a test file does not prove it passes. Verified by file existence grep 2026-05-22.

## Existing coverage (verified)

| Suite | Path | What it covers | Status |
|---|---|---|---|
| dagslinjen-quickadd | `apps/e2e/dagslinjen-quickadd/` | Manager quick-add task on day timeline (covers `add-task` path) | ✅ exists |
| timeline-templates | `apps/e2e/timeline-templates/` | `timeline_template` save/apply (path D materialization) | ✅ exists |
| HMS drift tasks | adjacent HMS specs | HMS evidence completion via `TaskCard`/`DriftTaskList` | 🟡 partial |

## Capability unit tests (Vitest) — `packages/ai/src/capabilities/task/`

| Tool | Cases | Status |
|---|---|---|
| `list_mine` | 4-source union; window filter; multi-workspace; service-role context | 🟡 exists (verify grep) |
| `create_session` | gate denied (non-manager); `day_line_id` resolves dept_session server-side; missing day_line → fail-fast; audit fields required | 🟡 exists |
| `create_personal` | self-scope; voice channel refused | 🟡 exists |
| `create_day_ad_hoc` | category default; date validation | 🟡 exists |
| `complete` | each source path; non-assignee session complete sets completedVia='manager'; emma via admin client | 🟡 exists |
| `cancel_personal` | self-only; reason required | 🟡 exists |

## Phase 1 routine capability unit tests — `packages/ai/src/capabilities/routine/__tests__/`

| Test file | Cases | Status |
|---|---|---|
| `create.test.ts` | inserts routine bound to procedure + protocol; executor_type defaults human | per plan Task 3 |
| `assign-to-location.test.ts` | sets location_id + routine_team rows; L-0177 cross-workspace reject | per plan Task 4 |
| `add-step.test.ts` | inserts procedure_step at max(step_order)+1; L-0177 fail-fast | per plan Task 5b |

> Verify test files exist by grepping `packages/ai/src/capabilities/routine/__tests__/` after Phase 1 build completes.

## Phase 1 cron unit tests — `supabase/functions/session-hook-executor/_tests/`

| Test | Cases | Status |
|---|---|---|
| `routine-expand.test.ts` | `linked_routine_id` hook with 3-step procedure → 3 `session_task` rows (not 1 stub); each with `day_line_id` + provenance triple (origin=routine, generated_by=cron, source_reference=routine_id) | per plan Task 6 |

> Verify file exists after Phase 1.

## Web (Playwright) — targets

| Spec | Journey | Status |
|---|---|---|
| `task-manager/manager-creates-location-task.spec.ts` | Flow A — task on day_line within time window | 🔴 to write (Phase 1) |
| `task-manager/shift-tasks-visible.spec.ts` | Flow B — task visible on correct shift, not other areas | 🔴 to write (Phase 1) |
| `task-manager/routine-creates-step-tasks.spec.ts` | Flow D — routine assigned to location → cron expands steps | 🔴 to write (Phase 1) |
| `task-manager/complete-with-evidence.spec.ts` | HMS evidence completion | 🟡 partial via HMS specs |
| `dagslinjen-quickadd/*` | quick-add | ✅ exists |
| `timeline-templates/*` | template apply | ✅ exists |

## Mobile (Maestro) — targets

| Flow | Status |
|---|---|
| Employee opens shift → sees only this shift's tasks (shiftSessionId filter + status gate) | 🔴 to write (Phase 1) |
| Clock-in → Min dag shows tasks | 🔴 to write (Phase 1) |
| Complete task + evidence offline → sync | 🟡 (offline queue exists; task path to verify) |
| Empty state "Alt klart" | 🟡 |

## Manual test matrix (cross-surface)

| Scenario | Web | Mobile | Voice | Chat |
|---|---|---|---|---|
| List my tasks | ✅ | ✅ | ✅ | ✅ |
| Complete task | ✅ | ✅ | ✅ | ✅ |
| Create session task on day_line | 🟡 | n/a (execute-only) | ❌ (chat-only) | ✅ |
| Create personal task | ✅ | ✅ | ❌ | ✅ |
| Create day ad-hoc | ✅ | n/a | ❌ | ✅ |
| Create routine | 🔴 (Phase 1) | n/a | ❌ | ✅ (tool shipped) |
| Attach routine → steps expand | 🔴 | n/a | ❌ | 🟡 (cron path; UI pending) |
| Shift-scoped task feed | 🔴 | 🟡 (chain wired; status-gate missing) | — | — |
| Clock-in → min dag | 🔴 | 🔴 (Phase 1 Task 9) | — | — |

## Acceptance instrumentation

Each Phase-1 spec MUST assert:
- Telemetry: `task created`/`completed` reaches `activity_trail` + `engine_event` (registry routing).
- Provenance: every new `session_task` from routine expansion has `origin='routine'`, `generated_by='cron'`, `source_reference` non-null.
- RPC projection: `day_line_id`/`location_id` non-null for location-anchored tasks.
- Gate-denied paths: return Norwegian refusal string + zero DB writes.

## Regression guards

- **ADR-0317 lockstep:** a unit test should diff `fn_list_my_tasks` column set against the `list_mine` TS projection and fail on drift. (`packages/ai/src/capabilities/task/tools.ts:41–46` vs migration `20260607100100`)
- **L-0066 seed check:** a seed-presence test asserting `task.*` + `routine.*` action_types are seeded in `engine_authority_config`.
- **Provenance invariant:** any test that inserts a `session_task` via cron must assert all three provenance columns are non-null.
