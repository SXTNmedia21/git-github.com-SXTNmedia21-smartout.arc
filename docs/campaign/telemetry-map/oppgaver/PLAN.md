---
title: Oppgaver — Telemetry Implementation Plan
status: draft
updated: 2026-05-31
created: 2026-05-31
module: oppgaver
tags: [plan, telemetry, oppgaver, P11]
---

# Implementation Plan — oppgaver telemetry + hook wiring

Gate status: **FAIL** — must resolve P0 and P1 blockers before production.

---

## P0 — Registry gaps (must add before any emit-site work)

### A. Add `oppgaver.task_completed` to registry.ts

```typescript
export interface OppgaverTaskCompleted extends BaseEvent {
  event: "oppgaver.task_completed";
  properties: {
    data: {
      task_id: string;
      entity_type: "session_task" | "personal_task" | "schedule_day_task";
      from_status: "todo" | "inprogress" | "overdue" | "done";
      to_status: "done" | "todo" | "inprogress";
      /** "toggle" | "drawer_footer" | "bulk" | "form_complete" | "drag_complete" */
      trigger_source: string;
    };
  };
}
```

Destinations: `["posthog", "activity_trail", "engine_event"]`
Category: `"oppgaver"`

Add to `SmartoutEvent` union and EventMeta registry map.

### B. Add `oppgaver.subtask_toggled` to registry.ts

```typescript
export interface OppgaverSubtaskToggled extends BaseEvent {
  event: "oppgaver.subtask_toggled";
  properties: {
    data: {
      task_id: string;
      subtask_id: string;
      to_done: boolean;
    };
  };
}
```

Destinations: `["posthog", "logger"]`
Category: `"oppgaver"`

---

## P1 — Hook wiring: task completion (primary mutation)

### Wire `useCompleteTask` into oppgaver surface

The hook exists at `apps/web/src/app/dashboard/hms/_hooks/use-complete-task.ts`.
The oppgaver surface must NOT use a copy — import the same hook.

Controls requiring this hook:

- `TaskRow.onToggleStatus` (called from TaskList, DayBoard, Dagslinje)
- `Drawer` footer "Marker ferdig" / "Gjenåpne"
- `Drawer` Status segment selector (todo/inprogress/done)
- `Drawer` "Marker pågår" button
- `FormViewer` "Ferdig" button (post-sign complete)
- `BulkAction` "Marker ferdig" (extend to batch call)
- `DayBoard` TaskRow onToggleStatus

Emit `oppgaver.task_completed` from the hook's `onSuccess` callback when trigger source is `"oppgaver_surface"`.

Hook call pattern:

```typescript
const { mutate: completeTask } = useCompleteTask();
// on toggle:
completeTask({ taskId: task.id, sessionId: currentSessionId });
// emit oppgaver.task_completed via onSuccess
```

ADR refs: 0099, 0114, 0134, 0151, 0204, 0298

---

## P1 — Gating flagged anti-pattern hooks (F0.3)

### useCreateQuickTask — needs Server Action

Current: direct browser `.insert` on `session_task` + fire-and-forget `void emit()`

Required path (ADR-0114, 0134, 0151, 0298):

1. Create `_actions/create-quick-task-action.ts` Server Action with `gate_action('task.add_task_manual')`
2. Move insert to admin client inside Server Action
3. Await emit inside Server Action
4. Replace mutationFn body in useCreateQuickTask with Server Action call
5. Emit `task.added_manual` (already in registry)

### useAssignTask — needs Server Action

Current: direct browser `.update` on `session_task` + fire-and-forget `void emit()`

Required path:

1. Create `_actions/assign-task-action.ts` Server Action
2. Move update to admin client, await `emit("session_task.assigned", ...)`
3. Replace mutationFn body

---

## P2 — Emit read-surface events (no hook changes needed)

These events are in registry; only emit-sites are missing. Add to the React component that will wrap the design:

| Event                              | Where to call `emit()`                            | Trigger                         |
| ---------------------------------- | ------------------------------------------------- | ------------------------------- |
| `oppgaver.view_opened`             | `OppgaverPage` useEffect mount                    | Page load                       |
| `oppgaver.view_mode_changed`       | Tab button onClick                                | Any tab change                  |
| `oppgaver.area_filter_changed`     | Filter chip onClick                               | Status/origin filter            |
| `oppgaver.task_focused`            | `openItem(id)` call                               | TaskRow open, routine task open |
| `oppgaver.context_pinned`          | `ChapterLink.onOpen`, ChapterViewer open          | Manual/chapter open             |
| `oppgaver.pulse_now_clicked`       | Pulse card onClick                                | Overview card click             |
| `oppgaver.task_re_timed`           | Dagslinje `drop()` onSuccess                      | DnD drop (after hook built)     |
| `oppgaver.location_filter_changed` | Location filter (when LocationSwitcherPill built) | Filter change                   |
| `oppgaver.view_mode_changed`       | Dagslinje mode selector `setMode`                 | Mode switch                     |

These are all fire-and-forget `void emit()` (read-path telemetry — ADR-0134 applies only to write-path).

---

## P3 — New hooks (new capability surface — plan per sortie)

These are future sorties; flag as "not built" in dashboard.

| Gap                     | New hook / action needed                                      | Tables affected                                 | ADR gate required |
| ----------------------- | ------------------------------------------------------------- | ----------------------------------------------- | ----------------- |
| Subtask toggle          | `useToggleSubtask` → Server Action                            | `session_task` (subtask JSONB or subtask table) | ADR-0099/0298     |
| DnD reschedule          | `useUpdateSessionTask` (capability: task.update_session_task) | `session_task`                                  | ADR-0099/0298     |
| Routine toggle          | `useToggleRoutine`                                            | `routine`                                       | ADR-0099          |
| Duplicate task          | `useDuplicateTask`                                            | `session_task`                                  | ADR-0099/0298     |
| Add comment             | `useAddTaskComment`                                           | `session_task_comment` (or activity JSONB)      | ADR-0099          |
| Add evidence/media      | `useUploadEvidence`                                           | `session_task` + Storage                        | ADR-0099/0298     |
| FlowPlayer read-receipt | `useCompleteManual`                                           | `protocol_assignment` or `training_log`         | ADR-0099          |
| Bulk-complete           | Extend `useCompleteTask` to accept array                      | `session_task`                                  | ADR-0298          |
| Priority update         | `useUpdateTaskPriority`                                       | `session_task`                                  | ADR-0099          |

---

## Sequencing recommendation

```
1. Registry additions (A + B) — 1 file, no risk
2. Gate useCreateQuickTask + useAssignTask (F0.3) — unblock production eligibility
3. Wire useCompleteTask to oppgaver surface — primary mutation, highest value
4. Add P2 read-surface emit() calls — low risk, high observability value
5. P3 new hooks — individual sorties, each with gate_action + Server Action pattern
```

---

## Tables referenced by this domain

| Table                 | Operations                                                                               | Hook (current)                                                                                                  |
| --------------------- | ---------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| `session_task`        | read (cascade), update status, update assigned_to, insert (adhoc), update deadline (DnD) | useCascadeTasks (read), useCompleteTask (write, partial), useAssignTask (FLAGGED), useCreateQuickTask (FLAGGED) |
| `protocol_assignment` | read                                                                                     | useCascadeTasks                                                                                                 |
| `schedule_day_task`   | read                                                                                     | useCascadeTasks                                                                                                 |
| `personal_task`       | read                                                                                     | useCascadeTasks                                                                                                 |
| `routine`             | read, toggle active                                                                      | useAssignTask? NO — no hook                                                                                     |
| `runbook`             | read                                                                                     | none wired                                                                                                      |
| `policy`              | read                                                                                     | none wired                                                                                                      |
| `protocol`            | read                                                                                     | none wired                                                                                                      |
| `procedure`           | read                                                                                     | none wired                                                                                                      |
