---
title: "User Journeys — task-capability-unify"
status: done
created: 2026-05-13
updated: 2026-05-13
tags: [sortie-3, journeys, task-capability]
---

# User Journeys — task-capability-unify

> Feature: `task` capability (Sortie 3, ADR-0301). Branch: `feat/task-capability-unify`.
> Five journeys covering the full write surface. Happy paths + error paths per journey.

---

## Journey A: Employee asks Botsson "hva må jeg gjøre i dag"

**Actors:** Employee, Botsson (chat or voice channel)

**Precondition:**
- Employee is authenticated with a valid workspace JWT
- Employee has one or more open tasks across any combination of `session_task`, `personal_task`, `schedule_day_task`, `emma_task`
- `collector.ts` R7 has already fetched `personal_task` rows into `AgentContext.personalTasks` at session start (system prompt contains `<active_tasks>` slice)
- `task` capability is registered and `intent-classifier.ts` has `"task"` in the enum

**Steps:**

1. Employee sends "hva må jeg gjøre i dag" via chat or voice → stage-engine receives turn; intent-classifier returns capability=`task`, intent=`list_mine`.
2. Router resolves `task.list_mine` tool; channel check passes (list_mine allows chat + voice).
3. Tool body executes direct UNION query across 4 tables scoped by `workspace_id = $ctx.workspaceId` and `profile_id = $ctx.profileId` (or `assigned_to = $ctx.profileId` for session/day_ad_hoc tasks); window defaults to `now() - 1 day` → `now() + 7 days`.
4. Result rows are sorted by `due_at ASC NULLS LAST`, filtered to `status = 'open'`, capped at 20.
5. Tool returns `{ tasks: MyTaskRow[] }` with `source` discriminator on each row.
6. Stage-engine assembles Botsson reply listing tasks grouped or enumerated; voice channel reads them aloud.
7. Employee sees (or hears) a list of their open tasks.

**Postcondition:**
- No database writes occurred
- No emit fired (read-only tool is ungated)
- Employee has situational awareness of their current task load

**Error paths:**

- **Empty result**: No open tasks in window → tool returns `{ tasks: [] }` → Botsson replies "Du har ingen åpne oppgaver de neste 7 dagene."
- **Workspace JWT invalid**: `$ctx.workspaceId` is null → tool throws at entry (fail-fast per ADR-0134); stage-engine returns 401 to BFF.
- **Alias backstop**: If classifier returns `personal` + task-verb, `aliasTaskVerbs()` shim in `router.ts` rewrites to `task` capability → `list_mine` resolves correctly (30-day A/B window).

---

## Journey B: Manager voice-says "lag oppgave til Anna" → chat-only enforcement

**Actors:** Manager, Botsson (voice channel initially, then chat)

**Precondition:**
- Manager is authenticated with role = `manager` (or `admin` / `owner`)
- Employee "Anna" (e.g. `anna@example.com`) has an active profile in the same workspace
- Voice channel is active (LiveKit session open)

**Steps:**

1. Manager voice-says "lag oppgave til Anna: sjekk kjølerommet" → voice transcript arrives at stage-engine.
2. Intent-classifier returns capability=`task`, intent=`create_session`.
3. Router resolves `task.create_session`; channel check fires: `create_session` is `allowedChannels: ["chat"]` in V1 (ADR-0298 R6 — free-text PII risk on voice).
4. Tool returns early: `{ ok: false, error: 'chat_only_in_v1', message: 'Si dette på tekst, så lager jeg oppgaven.' }`.
5. Botsson replies (via voice → text-to-speech): "Si dette på tekst, så lager jeg oppgaven."
6. Manager switches to chat and sends: "Lag oppgave til Anna: sjekk kjølerommet" (same session).
7. Stage-engine receives turn via chat channel; intent-classifier returns capability=`task`, intent=`create_session`; channel=`chat` — check passes.
8. Tool body fires: `gateTaskAction('task.create_session')` → manager role passes suggest level.
9. `resolveAssigneeWorkspaceMembership(assignee_profile_id=anna_uuid, workspaceId=$ctx.workspaceId)` → SELECT returns 1 row → passes.
10. INSERT into `session_task` with `title='sjekk kjølerommet'`, `assigned_to=anna_uuid`, `session_id=<current_session_id>`, `created_by=$ctx.profileId`.
11. Dual emit fires: `"task created"` with `{ source: 'session', actor_kind: 'manager', assigned_to_self: false }` AND `"task.added_manual"` alias (30-day window).
12. Tool returns `{ id: <new_session_task_uuid> }`.
13. Botsson replies: "Oppgave opprettet og tildelt Anna."

**Postcondition:**
- `session_task` row created with correct `assigned_to`, `workspace_id`, `session_id`
- Two telemetry events fired (canonical + alias)
- No voice-channel mutation occurred — all writes happened on chat channel

**Error paths:**

- **Voice channel on create**: Steps 3-5 above — Botsson deflects, no write.
- **Manager not authorized**: Employee role → `gateTaskAction` returns denied → tool returns `{ ok: false, error: 'gate_denied' }` → Botsson replies "Du har ikke tilgang til å lage oppgaver for andre."
- **Session not found**: `session_id` doesn't exist or belongs to another workspace → tool returns `{ ok: false, error: 'session_not_found' }`.
- **No session context**: Manager hasn't specified a session → Botsson asks for clarification before invoking the tool.

---

## Journey C: Employee taps complete on mobile task tile

**Actors:** Employee, mobile app (PWA `localhost:8083` in dev; production mobile)

**Precondition:**
- Employee is authenticated via mobile app with a valid Bearer JWT
- Employee has an open `session_task` with `assigned_to = $actor.profileId`
- Mobile task tile displays the task sourced from `fn_list_my_tasks` v2 (via `useMyTasks` hook)

**Steps:**

1. Employee taps "Fullfør" on a task tile in the mobile Oppgaver list.
2. Mobile app sends `POST /api/mobile/tasks/{id}/complete` with body `{ source: 'session' }` and `Authorization: Bearer <jwt>`.
3. BFF route (`apps/web/src/app/api/mobile/tasks/[id]/complete/route.ts`) fires.
4. `resolveMobileActor()` derives identity from JWT: `workspaceId`, `profileId`, `role` — throws if any field is null/empty (ADR-0134 fail-fast).
5. Tool invocation: `task.complete({ id, source: 'session' }, ctx)`.
6. Tool body: `source === 'session'` branch → verifies workspace match on task row AND (`assigned_to === $ctx.profileId` OR `is_admin_in_workspace`).
7. UPDATE `session_task` SET `status = 'completed'`, `completed_by = $ctx.profileId`, `completed_at = now()` WHERE `id = $1` AND `workspace_id = $ctx.workspaceId`.
8. Emit: `"task completed"` with `{ source: 'session', actor_kind: 'employee', completed_via: 'self' }`.
9. BFF returns `{ ok: true }` → mobile app optimistically removes tile from Oppgaver list and re-queries `useMyTasks`.

**Postcondition:**
- `session_task` row updated: `status='completed'`, `completed_by=actor.profileId`, `completed_at` set
- Single telemetry event fired
- Mobile UI reflects completion without full page reload

**Error paths:**

- **Missing/empty actor identity**: `resolveMobileActor()` throws → BFF returns 401.
- **Task belongs to another workspace**: workspace mismatch check fails → BFF returns 403 `{ error: 'workspace_mismatch' }`.
- **Task assigned to someone else, actor is employee (not manager)**: authority check fails → BFF returns 403 `{ error: 'not_authorized_to_complete' }`.
- **Wrong source**: Employee passes `source: 'emma'` on a `session_task` row → source dispatch hits `emma` branch → delegates to `/api/emma/tasks/dismiss` → that endpoint validates task ownership and may reject.
- **Task already completed**: UPDATE affects 0 rows → tool returns `{ ok: false, error: 'task_not_found_or_already_completed' }`.

---

## Journey D: Manager attempts cross-workspace assign (security gate)

**Actors:** Manager from Workspace W1, Employee from Workspace W2 (different workspace)

**Precondition:**
- Manager is authenticated in Workspace W1
- Manager somehow obtains a `profile_id` belonging to a profile in Workspace W2 (e.g., via a prior API response or direct UUID guessing)
- Manager sends a task create request (chat channel) with `assignee_profile_id = <W2_profile_uuid>`

**Steps:**

1. Manager sends (chat): "Lag oppgave: åpningssjekk. Tildel til [W2_profile_uuid]."
2. Stage-engine resolves `task.create_session`, channel=chat passes.
3. `gateTaskAction('task.create_session')` → manager role passes.
4. `resolveAssigneeWorkspaceMembership(assignee_profile_id = W2_profile_uuid, workspaceId = W1_workspace_id)` executes: `SELECT 1 FROM profile WHERE profile_id = $1 AND workspace_id = $2 AND is_active = true`.
5. Query returns 0 rows — the profile exists but is in W2, not W1.
6. Tool returns immediately: `{ ok: false, error: 'assignee_not_in_workspace' }`. No INSERT. No emit. No side effects.
7. Botsson replies: "Denne personen er ikke en del av arbeidsplassen din."

**Postcondition:**
- No `session_task` row created
- No telemetry event fired
- No information about W2 is leaked to the W1 manager

**Error paths:**

- **UUID does not exist at all**: Same path — `SELECT 1` returns 0 rows → same `assignee_not_in_workspace` error (deliberately does not distinguish "doesn't exist" from "exists in another workspace" to prevent enumeration).
- **Inactive profile in W1**: `is_active = false` → same 0-row result → same rejection. Manager must reactivate the profile before assigning tasks.
- **Manager tries to assign to self but passes own UUID explicitly**: `resolveAssigneeWorkspaceMembership` returns 1 row (self is in W1) → check passes → INSERT proceeds normally.

---

## Journey E: WebDayControl Oppgaver tab — `addTaskAction` wrapper compatibility

**Actors:** Manager, web dashboard (`/dashboard/day-control/sessions/:id` → Oppgaver tab)

**Precondition:**
- Manager is on the Oppgaver tab of a department session in WebDayControl
- The session has an active `department_session` record
- `apps/web/src/app/dashboard/_actions/add-task-action.ts` has been rewritten as a thin wrapper (Sortie 3)
- No UI changes deployed — form and submit flow unchanged

**Steps:**

1. Manager fills in the task title field in the Oppgaver tab form and clicks "Legg til oppgave."
2. React form calls `addTaskAction({ session_id, title, hook_id?, assignee_profile_id? })` — identical call signature to pre-Sortie-3.
3. `addTaskAction` wrapper body invokes `runTaskTool('create_session', { ...input }, { actor: serverDerivedActor, channel: 'chat' })`.
4. `task.create_session` tool body fires: `gateTaskAction` (manager passes), assignee workspace-check if `assignee_profile_id` present, INSERT `session_task`.
5. Dual emit: `"task created"` (canonical) + `"task.added_manual"` (alias, 30-day window).
6. `addTaskAction` returns `{ id: <new_uuid> }` to the form — same shape as pre-Sortie-3.
7. Oppgaver tab re-renders with the new task in the list.

**Postcondition:**
- `session_task` row created via the canonical `task.create_session` tool path (previously was a shadow Server Action outside the capability registry)
- Telemetry event family is now `"task created"` (C4-visible) instead of the old `task.added_manual` event that bypassed capability registry
- All existing Oppgaver tab UI code continues to work without modification
- `addTaskAction` is no longer a shadow capability — it is now a thin wrapper over a registered, gated tool

**Error paths:**

- **Gate denied (employee calling Server Action directly)**: The `gateTaskAction` check happens inside the tool body — if called with an employee-role actor, it returns `{ ok: false, error: 'gate_denied' }`. The form should surface the error (pre-Sortie-3 behavior unchanged, as the gate was already present via `gateAction('task.add_task_manual')`).
- **Session not found**: `session_id` from form does not match an active `department_session` in the workspace → tool returns `{ ok: false, error: 'session_not_found' }` → form shows error toast.
- **Assignee workspace mismatch**: If `assignee_profile_id` is supplied and fails the workspace-membership check → same `{ ok: false, error: 'assignee_not_in_workspace' }` → form shows error toast.
- **Type mismatch after migration**: `MyTaskRow.hook_linked_*` fields added in Sortie 3 are structurally compatible with existing `TaskWithHook` consumer types (`string` ⊆ `string | null`) — no runtime errors from the new columns.
