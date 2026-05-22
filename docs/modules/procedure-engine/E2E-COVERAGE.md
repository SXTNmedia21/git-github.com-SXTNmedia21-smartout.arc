---
title: Procedure Engine — E2E Coverage
status: in_progress
updated: 2026-05-22
created: 2026-05-20
module: procedure-engine
tags: [module, procedure-engine, e2e, playwright, maestro, capability-units, test-matrix]
---

# Procedure Engine — E2E Coverage

> Test plan across web (Playwright), mobile (Maestro), capability units, and a manual matrix. Status reflects what exists vs what Phase 1 requires.

## Existing coverage
- `apps/e2e/dagslinjen-quickadd/` — manager quick-add task on the day timeline (adjacent; covers `add-task` path).
- `apps/e2e/timeline-templates/` — `timeline_template` save/apply (path D).
- Capability unit tests: `packages/ai/src/capabilities/task/` (gate fail-closed, source dispatch) — verify presence before relying.

## Capability units (Vitest)

| Tool | Cases |
|---|---|
| `list_mine` | 4-source union; window filter; multi-workspace; service-role context (explicit profileId) returns rows |
| `create_session` | gate denied (non-manager); `day_line_id` resolves dept_session server-side; missing day_line → fail-fast; audit fields required |
| `create_personal` | self-scope; voice channel refused |
| `create_day_ad_hoc` | category default; date validation |
| `complete` | each source path; non-assignee session complete sets completedVia='manager'; emma via admin client |
| `cancel_personal` | self-only; reason required |

## Web (Playwright) — Phase 1 targets

| Spec | Journey | Status |
|---|---|---|
| `task-manager/manager-creates-location-task.spec.ts` | Flow A — task on a day_line within time window | 🔴 to write |
| `task-manager/shift-tasks-visible.spec.ts` | Flow B — task visible on the correct shift, not other areas | 🔴 to write |
| `task-manager/complete-with-evidence.spec.ts` | HMS evidence completion | 🟡 partial via HMS specs |
| `dagslinjen-quickadd/*` | quick-add | ✅ exists |

## Mobile (Maestro) — Phase 1 targets

| Flow | Status |
|---|---|
| Employee opens shift → sees only this shift's tasks (`shiftSessionId` filter) | 🔴 to write |
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
| Attach routine → steps expand | 🔴 | n/a | ❌ | 🔴 |
| Shift-scoped task feed | 🔴 | 🔴 | — | — |

## Acceptance instrumentation
Each Phase-1 spec asserts on telemetry (`task created`/`completed` reaches activity_trail + engine_event) and on the RPC projection (`day_line_id`/`location_id` non-null where expected). Gate-denied paths assert the Norwegian refusal string and zero DB writes.

## Regression guards
- ADR-0317 lockstep: a unit test should diff `fn_list_my_tasks` column set against the `list_mine` projection and fail on drift.
- L-0066: a seed-presence test asserting `task.*` action_types are seeded in `engine_authority_config`.
