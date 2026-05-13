---
title: "JOURNEY — Mobile Session-Task Defense (Sortie 1)"
status: done
updated: 2026-05-13
created: 2026-05-13
module: mobile
tags: [sortie-1, defense, session-task, ADR-0298]
---

# JOURNEY — Mobile Session-Task Defense (Sortie 1)

> Feature: `feat/mobile-session-task-defense` | Branch closed: 2026-05-13

These journeys cover the three defended mutation surfaces shipped in Sortie 1: task completion, shift confirmation, and hours confirmation. All three share the same defense architecture (JWT → `resolveMobileActor` → Server Action with `gateAction` → DB write + telemetry emit).

---

## Journey 1: Employee Completes a Session Task

**Role:** Employee (any `profile` with `assignee_profile_id` on the `session_task` row)
**Precondition:**
- Employee is authenticated and holds a valid JWT (Supabase auth session).
- A `session_task` row exists with `assignee_profile_id = auth.uid()` and `status = 'pending'`.
- `engine_authority_config` has a row for capability slug `task.complete_session_task` with `allow = true` for the workspace.

| Step | User action | System response | User sees |
|------|-------------|-----------------|-----------|
| 1 | Taps "Fullfør" on a task card in the mobile task list | Mobile client sends `PATCH /api/mobile/tasks/{id}/complete` with JWT in `Authorization: Bearer …` header; body is empty (no actor fields) | Loading indicator on task card |
| 2 | — | BFF route extracts JWT via `resolveMobileActor(token)`. Derives `profileId` + `workspaceId` server-side. Returns `401` immediately if token is missing or expired. | — |
| 3 | — | BFF calls `completeSessionTaskAction({ taskId, actorProfileId, actorWorkspaceId })`. `gateAction("task.complete_session_task")` checks `engine_authority_config` — passes if `allow = true` in the workspace config. | — |
| 4 | — | Server Action calls Supabase with service role to `UPDATE session_task SET status = 'completed' WHERE id = {taskId}`. RLS WITH CHECK `(assignee_profile_id = auth.uid())` enforced by Supabase server-side (anon key path would be blocked if actor didn't own the row). | — |
| 5 | — | `emit("session_task completed", { entity_type: "session_task", entity_id: taskId, actor_id: profileId, workspace_id: workspaceId })` fires. Routes to PostHog + Logger + activity_trail + engine_event (all 4 destinations). | — |
| 6 | — | BFF returns `{ ok: true, taskId }` with HTTP 200. | Task card shows "Fullført" checkmark; task removed from active list |

**Postcondition:** `session_task.status = 'completed'`, telemetry emitted to all 4 destinations, activity_trail row created.

**Error paths:**

| Scenario | System behavior | User sees |
|----------|-----------------|-----------|
| JWT missing or expired | `resolveMobileActor` returns `null`; BFF returns `401 Unauthorized` | "Logg inn på nytt" error banner |
| `taskId` not found / not owned by actor | RLS rejects UPDATE (0 rows affected); Server Action returns `{ ok: false, error: "not_found" }`; BFF returns `422` | "Oppgaven ble ikke funnet" error toast |
| `engine_authority_config` has `allow = false` | `gateAction` returns `{ allowed: false }`; Server Action returns `{ ok: false, error: "not_authorized" }`; BFF returns `422` | "Ikke autorisert" error toast |
| Network offline | Mobile client offline queue intercepts; request enqueued with Zod-validated payload; retried when connectivity restored | Offline indicator; task shows "Venter på nett" |
| DB error (5xx) | Server Action catches exception; BFF returns `500`; telemetry emits failure event | "Noe gikk galt, prøv igjen" error toast |

---

## Journey 2: Employee Confirms a Shift

**Role:** Employee (profile with a `schedule_shift` row matching their `profile_id` for the relevant date)
**Precondition:**
- Employee authenticated with valid JWT.
- `schedule_shift` row exists with matching `profile_id` and `status = 'published'`.
- `engine_authority_config` has `schedule.confirm_shift` with `allow = true`.

| Step | User action | System response | User sees |
|------|-------------|-----------------|-----------|
| 1 | Taps "Bekreft vakt" on a shift card in the mobile shift list | Mobile client sends `PATCH /api/mobile/shifts/{schedule_shift_id}/confirm` with JWT | Loading indicator |
| 2 | — | BFF derives actor via `resolveMobileActor(token)`. Returns `401` on invalid JWT. | — |
| 3 | — | BFF calls `confirmShiftAction({ shiftId: schedule_shift_id, actorProfileId, actorWorkspaceId })`. `gateAction("schedule.confirm_shift")` checks authority config. | — |
| 4 | — | Server Action updates `schedule_shift SET confirmed_at = now(), status = 'confirmed' WHERE schedule_shift_id = {shiftId}`. | — |
| 5 | — | `emit("shift confirmed", { entity_type: "schedule_shift", entity_id: shiftId, actor_id: profileId, workspace_id: workspaceId })` fires (4 destinations). | — |
| 6 | — | BFF returns `{ ok: true, shiftId }` with HTTP 200. | Shift card shows "Bekreftet" badge |

**Postcondition:** `schedule_shift.status = 'confirmed'`, `confirmed_at` timestamp set, telemetry emitted.

**Error paths:**

| Scenario | System behavior | User sees |
|----------|-----------------|-----------|
| JWT expired | `401` | "Logg inn på nytt" |
| Shift already confirmed | DB UPDATE returns 0 rows (status constraint); Server Action returns `{ ok: false, error: "already_confirmed" }`; `422` | "Vakten er allerede bekreftet" toast |
| Shift not belonging to actor | RLS or WHERE clause rejects; `422` | "Vakt ikke funnet" toast |
| `allow = false` in authority config | `gateAction` blocks; `422` | "Ikke autorisert" toast |
| Offline | Queued + retried on reconnect | Offline indicator |

---

## Journey 3: Employee Confirms Hours (Shift Approval)

**Role:** Employee (profile with a `shift_approval` row for the relevant pay period)
**Precondition:**
- Employee authenticated with valid JWT.
- `shift_approval` row exists with `approval_id` and `status = 'pending'`.
- `engine_authority_config` has `timesheet.confirm_hours` with `allow = true`.

| Step | User action | System response | User sees |
|------|-------------|-----------------|-----------|
| 1 | Taps "Godkjenn timer" on the hours summary card | Mobile client sends `PATCH /api/mobile/shift-approvals/{approval_id}/confirm` with JWT | Loading indicator |
| 2 | — | BFF derives actor via `resolveMobileActor(token)`. Returns `401` on invalid token. | — |
| 3 | — | BFF calls `confirmHoursAction({ approvalId: approval_id, actorProfileId, actorWorkspaceId })`. `gateAction("timesheet.confirm_hours")` checks authority config. | — |
| 4 | — | Server Action updates `shift_approval SET employee_confirmed_at = now(), status = 'confirmed' WHERE approval_id = {approvalId}`. | — |
| 5 | — | `emit("hours confirmed", { entity_type: "shift_approval", entity_id: approvalId, actor_id: profileId, workspace_id: workspaceId })` fires (4 destinations). | — |
| 6 | — | BFF returns `{ ok: true, approvalId }` with HTTP 200. | Timer-kortet viser "Timer godkjent" |

**Postcondition:** `shift_approval.status = 'confirmed'`, `employee_confirmed_at` timestamp set, telemetry emitted.

**Error paths:**

| Scenario | System behavior | User sees |
|----------|-----------------|-----------|
| JWT expired | `401` | "Logg inn på nytt" |
| Approval not found | `422` | "Timegodkjenning ikke funnet" |
| Already confirmed | `422` | "Timer allerede godkjent" |
| `allow = false` | `gateAction` blocks; `422` | "Ikke autorisert" |
| Offline | Queued; retried | Offline indicator |

---

## Journey 4: Manager Verifies Employee Task Completion (Read — Web Dashboard)

**Role:** Manager (profile with `role = 'manager'` in workspace)
**Precondition:**
- Manager authenticated in web dashboard.
- `session_task` row exists with `status = 'completed'` for an employee in their department.

| Step | User action | System response | User sees |
|------|-------------|-----------------|-----------|
| 1 | Opens Department Session view in web dashboard | `GET /api/dashboard/sessions/[department_id]` fetches `department_session` + child `session_task` rows via RLS (workspace-scoped) | Task list showing employee name, task title, completed timestamp |
| 2 | Clicks on a completed task row | Task detail drawer opens with `completed_at`, `assignee_profile_id`, and the activity_trail entry | Full audit row: who, when, event name `"session_task completed"` |

**Postcondition:** Manager can see task completion evidence without touching mobile defense routes.

**Error paths:**

| Scenario | System behavior | User sees |
|----------|-----------------|-----------|
| RLS rejects (wrong workspace) | 0 rows returned | Empty state "Ingen oppgaver" |
| Department not found | 404 | "Avdelingen ble ikke funnet" |

---

## Journey 5: Attacker Forgery Attempt — Rejected at All 3 Layers

**Role:** Attacker (authenticated user attempting to complete another employee's task)
**Precondition:**
- Attacker holds a valid JWT for their own profile.
- Target `session_task` has `assignee_profile_id` = victim's profile_id.

| Step | Attacker action | System response | Result |
|------|-----------------|-----------------|--------|
| 1 | Sends `PATCH /api/mobile/tasks/{target_task_id}/complete` with attacker's JWT and body `{ "actorProfileId": "{victim_id}" }` | **Layer 1 — Zod schema**: body is rejected by `.strict()` — `actorProfileId` is not a permitted field. Server returns `422 Unprocessable Entity`. | Blocked at schema |
| 2 | Attacker strips body entirely; sends bare PATCH | **Layer 2 — Identity derivation**: BFF calls `resolveMobileActor(attackerJWT)` → returns attacker's own `profileId`. No victim ID anywhere in the chain. `completeSessionTaskAction` called with attacker's `profileId`. | Actor correctly derived as attacker |
| 3 | — | **Layer 3 — RLS WITH CHECK**: Supabase evaluates `UPDATE session_task … WHERE id = {target_task_id}`. Policy `assignee_profile_id = auth.uid()` fails because `auth.uid()` = attacker ≠ victim. 0 rows updated. | `{ ok: false, error: "not_found" }` — BFF returns `422` |

**Postcondition:** Attacker receives `422` at one of the three layers. No modification to victim's task. Attack attempt is logged to `activity_trail` (Layer 3 path only — blocked mutations still emit a failure event via `gateAction` audit trail).

---

## Out of Scope (Sortie 1)

- Read path: `fn_list_my_tasks` RPC (Sortie 2)
- Task creation from mobile (Sortie 3 — unified `task` capability)
- Kalender UI on mobile (Sortie 4)
- Manager task assignment cross-assign flow (Sortie 3)
- `schedule_shift` / `shift_approval` RLS WITH CHECK (Sortie A)
