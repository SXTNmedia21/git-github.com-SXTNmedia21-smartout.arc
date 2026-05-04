---
title: Journey — Mobile AddSheet Task BFF Wrap
status: done
updated: 2026-05-04
created: 2026-05-04
module: mobile
tags: [mobile, task, bff, action-map, gate]
---

# Journey: Mobile AddSheet Task BFF Wrap

Covers the task-creation flow from the mobile AddSheet surface after wt-6 routes `create_task` through the `/api/mobile/tasks` BFF instead of a direct Supabase insert.

---

## Journey: Manager Creates a Task from Mobile AddSheet (Happy Path)

**Precondition:** Manager is authenticated on the mobile app with an active session for a department.

1. Manager opens the AddSheet and selects "Opprett oppgave".
2. Manager fills in title (min 1 char, max 200), optional owner, optional compliance flag, reason (min 8 chars), and taps "Legg til".
3. Mobile enqueues a `create_task` WriteAction via `SyncWorker.enqueue()`. The payload is Zod-validated at enqueue per ADR-0134.
4. `SyncWorker` dequeues and calls `actionMap.create_task(payload)`.
5. `actionMap.create_task` reads the active Supabase session and extracts the Bearer `access_token`.
6. Handler POST-fetches `<WEB_API_URL>/api/mobile/tasks` with Bearer token + task fields in body. `workspace_id` is intentionally excluded from the body (ADR-0151).
7. BFF route (`/api/mobile/tasks`) validates the Bearer token via `createAdminClient().auth.getUser()`.
8. BFF resolves `workspace_id`, `profile_id`, and `role` from the active profile row; fails fast with 401 if any identity field is empty (ADR-0134).
9. BFF calls `addTaskAction(taskInput, resolvedActor, "system")` — actor is pre-resolved, cookie path is bypassed.
10. `addTaskAction` validates input, loads the `department_session` row, verifies `workspace_id` matches the resolved actor, runs `gate_action('task.add_task_manual')`, inserts into `session_task`, emits `task.added_manual` with `source: "mobile_addsheet"`.
11. BFF returns `{ ok: true, taskId }` → 200.
12. `SyncWorker` resolves without error; mobile UI shows success feedback.

**Postcondition:**
- One `session_task` row exists with `workspace_id`, `department_session_id`, and `status: "pending"`.
- `task.added_manual` telemetry event emitted with `source: "mobile_addsheet"`, `manual: true`.
- `activity_trail` + `engine_event` receive the event per registry destinations.

**Error paths:**
- No active Supabase session → `actionMap.create_task` throws "No session — cannot create task via BFF" → `SyncWorker` marks action as failed; mobile surfaces error.
- Bearer token invalid or user has no active profile → BFF returns 401 → `SyncWorker` throws `create_task BFF 401: Unauthorized`.
- Session not found or workspace mismatch → BFF returns 422 "Dagen finnes ikke eller annet arbeidsrom." → `SyncWorker` throws.
- `gate_action` denies → BFF returns 403 "Ikke autorisert." → `SyncWorker` throws.
- Title too short / reason too short → Zod validation at enqueue throws before network call; user sees inline validation error.

---

## Journey: Web DayControl Manager Creates a Task (Cookie Path — Unchanged)

**Precondition:** Manager is authenticated on the web dashboard and viewing the DayControl Oppgaver tab.

1. Manager clicks "Legg til oppgave" in the DayControl tasks panel.
2. Manager fills in the form fields and submits.
3. `addTaskAction(input)` is called directly as a Server Action with no `actor` argument, `channel` defaults to `"chat"`.
4. `resolveCurrentProfile()` reads the cookie session.
5. Gate, insert, and emit proceed as before. `source` is `"web_day_control_tasks_tab"`.
6. UI refreshes the task list via TanStack Query invalidation.

**Postcondition:** Same as happy path above, but `source: "web_day_control_tasks_tab"`.

**Error paths:** Unchanged from pre-wt-6 behavior.
