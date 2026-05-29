---
title: "Plan — task-e2e-spec-fixes"
status: in_progress
updated: 2026-05-29
created: 2026-05-26
module: task
affected_domains: [task]
tags: [plan]
---

# Plan — task-e2e-spec-fixes

> Base: `development` | Module: task | Started: 2026-05-26 | Landed: 2026-05-29 (direct on development; stub wt-4 scrapped)

## Goal

Fix the 4 failing `e2e-task` CI specs (J1–J4). Landed directly on `development`
2026-05-29 — original `feat/task-e2e-spec-fixes` (wt-4) was a stub 98 commits behind;
J2 + J4 had already been fixed independently on development in the interim.

## Outcome (2026-05-29)

- **J1 priority-column** ⏳ FIXED (pending live-CI confirm) — `session_task` has NO `priority`
  column **and no `task_type` column** by design. Priority is synthesized, not stored:
  `fn_list_my_tasks_v2_hook_links.sql:75` → `CASE WHEN st.is_compliance_required THEN 'high'
  ELSE 'normal' END` (ADR-0298 task-ontology; per-source synthesis — session=compliance,
  day_ad_hoc=highlight, personal=real column, emma=constant). Adding a `session_task.priority`
  column would be a dual-truth violation (drift vs `is_compliance_required`). **Fix = remove
  invalid keys from the two cascade-blocking `session_task` seed helpers**:
  `sortie-p0-fix-sweep-task-complete-source.spec.ts` (`seedSessionTask`) +
  `sortie-1-mobile-task-complete.spec.ts` (`seedTask`) — removed BOTH `priority: "normal"`
  AND `task_type: "general"` (council caught task_type as the next PostgREST one-per-request
  miss; L-0348 4th occurrence — removing only priority would have shifted CI-red to task_type).
  Kept `priority` on the `personal_task` insert (that table has a real `priority` CHECK column).
  **Status `in_progress` until live `e2e-task` CI runs green** — per L-0348 discipline, do not
  mark `done` on column-drift fixes without a live invoke (static review + typecheck miss drift).
- **J2 engine_event emit** ✅ already landed — `registry.ts` `"task created"` carries the
  `engine_event` destination.
- **J4 PATCH complete strict** ✅ already landed — `.../complete/route.ts` has
  `z.object({}).strict()`.
- **J3 AddTaskDialog CI** ⚠️ DEFERRED — needs live Playwright trace (setup-redirect
  hypothesis), cannot fix statically.

## Known debt (out of scope, flagged)

- `sortie-p0-fix-sweep-task-complete-source.spec.ts` T3 (`schedule_day_task` insert,
  ~line 277) has 5-column drift: `department_id`/`title`/`task_date`/`status`/`priority`
  vs actual `workspace_id`/`label`/`shift_date`/`task_status` (+ no priority column).
  Test soft-skips on error so it never goes red — separate fix sortie required to
  actually exercise the day_ad_hoc source path.
