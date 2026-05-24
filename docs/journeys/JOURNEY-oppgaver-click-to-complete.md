---
title: "JOURNEY — Manager clicks task → modal → mark complete"
status: done
created: 2026-05-24
updated: 2026-05-24
feature: p11-oppgaver-page
module: day-session
tags: [journey, oppgaver, click-to-edit, task-complete]
---

# Manager clicks task in Gantt → modal → mark complete

**Precondition:** Manager on `/dashboard/oppgaver`. Gantt rendered with ≥1 task in `status: "upcoming"` or `"in_progress"`.

## Happy path

1. Manager clicks a `TaskBlock` in `PersonLane` → `onTaskClick(task)` fires → `handleFocusTask` runs in shell → `setSelectedTask(task)`.
2. Telemetry emits `oppgaver.task_focused { task_id, area_id }`.
3. `TaskEditModal` opens as right-side `Sheet` (shadcn/ui) → renders task title (font-heading), time range (font-mono), assignee placeholder, status pill, "Marker som ferdig" Button.
4. Manager clicks **Marker som ferdig** → `onComplete(task.id)` callback → `completeSessionTaskAction({ taskId, userId, ... })` (existing Server Action, delegates to `task.complete` capability per ADR-0298).
5. Server Action returns `{ ok: true, taskId }` → modal closes (`setSelectedTask(null)`) → TanStack invalidates `sessionTaskKeys.forDate(...)` query → chart re-fetches → task re-renders with `status: "done"` (s-done modifier class).

**Postcondition:** Task marked complete via canonical capability tool. NO direct DB write from page component (verified by Task 6.3 grep). Botsson context updated via 24h `engine_memory` row.

## Error paths

- **Server Action returns `{ ok: false, error }`:** Modal stays open + shows error toast (deferred to follow-up — V1 silently ignores).
- **RLS denies (manager not in task's workspace):** Action returns false. Same as above.
- **Network failure:** Promise rejects → caught by error boundary; modal can be retried.
- **Task already complete on server (race):** No-op; refresh shows complete state.

## V2 follow-up

- Edit fields inline (title, scheduled_at, assignee) — gated on G19a/b/c capability tools (`schedule.reschedule_shift`, `task.update_scheduled_at`).
- DnD re-time directly in chart — same G19a/b/c gate.
