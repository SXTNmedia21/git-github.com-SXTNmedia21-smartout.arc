---
title: "Journey — fn_list_my_tasks RPC Contract and Auth Divergence"
status: verified
feature: task-mgr-sortie-2-rpc
updated: 2026-05-14
created: 2026-05-14
module: task-manager
tags: [journey, rpc, security-definer, task, fn_list_my_tasks]
---

# Journey — fn_list_my_tasks RPC Contract and Auth Divergence

> Feature: task-mgr-sortie-2-rpc | ADR-0317 | L-0245

Three user-facing paths through `fn_list_my_tasks`:

1. Mobile employee — reads tasks via RPC (anon JWT, auth.uid() resolves)
2. Mobile manager — same RPC path, sees workspace-wide unassigned tasks
3. Agent caller (stage-engine) — bypasses RPC, uses TS-fallback with explicit ctx filters

---

## Journey 1: Mobile Employee — "Hva må jeg gjøre i dag?"

**Precondition:**
- Employee is authenticated on mobile app (Expo/React Native)
- Employee has an active profile in at least one workspace
- Supabase anon key used; `auth.uid()` resolves to their user UUID

**Steps:**

1. Employee opens the Kalender tab or taps Botsson FAB on mobile.
2. App calls `supabase.rpc('fn_list_my_tasks', { p_window_start: ..., p_window_end: ... })`.
3. Supabase executes `fn_list_my_tasks` with `SECURITY DEFINER`.
4. CTE `caller_profiles` runs: `SELECT profile_id, workspace_id FROM profile WHERE user_id = auth.uid() AND is_active = true`.
5. Function returns UNION of:
   - ARM 1 `session_task`: tasks assigned to employee OR unassigned in their workspace, filtered by session date in window.
   - ARM 2 `schedule_day_task`: daily ad-hoc tasks assigned to employee OR unassigned, filtered by shift_date in window.
   - ARM 3 `personal_task`: employee's own tasks (due_at in window OR no due_at = open backlog).
   - ARM 4 `emma_task`: Emma-scheduled tasks for this employee (due_at in window OR no due_at).
6. Response includes normalized `status` column (pending/done/cancelled/triggered/overdue) and `source` discriminator.
7. App renders task list grouped by source or sorted by `due_at`.
8. On success, BFF or UI hook emits `task.list_mine` telemetry with `{ row_count, path: "rpc", window_days }`.

**Postcondition:** Employee sees all their open tasks across all 4 sources in one normalized list.

**Error paths:**
- `auth.uid()` resolves but no active profile found → `caller_profiles` CTE returns 0 rows → empty result set, no error. App shows "Ingen oppgaver i dette tidsvinduet."
- RPC EXECUTE not granted to `anon` role → PostgREST returns 403. Check: only `authenticated` role has EXECUTE grant. Employee must be logged in.
- Window params malformed → PostgreSQL TIMESTAMPTZ parse error → Supabase returns 400 with `code: "22007"`. App falls back to default window.

---

## Journey 2: Mobile Manager — Workspace-wide Task View

**Precondition:**
- Manager is authenticated, has `manager` or `admin` role in workspace
- Manager wants to see all unassigned tasks in addition to own assigned tasks

**Steps:**

1. Manager opens dashboard task section or asks Botsson "vis alle åpne oppgaver".
2. Same RPC call as Journey 1: `supabase.rpc('fn_list_my_tasks', {...})`.
3. `caller_profiles` CTE resolves manager's `profile_id` and `workspace_id`.
4. ARM 1 (`session_task`): returns tasks where `assigned_to = manager_profile_id OR assigned_to IS NULL`. Manager sees both their own assigned tasks AND unassigned pickup-eligible tasks.
5. ARM 2 (`schedule_day_task`): same pattern — assigned to manager OR unassigned.
6. ARM 3 (`personal_task`): returns only manager's own personal tasks (owner-scoped, no override).
7. ARM 4 (`emma_task`): returns only manager's own Emma tasks.
8. Response: `origin_actor = 'cascade_cron'` on hook-spawned session tasks, `'human'` on manually-added tasks. Manager can filter by `origin_actor` to see hook vs ad-hoc split.
9. `hook_linked_procedure_id` and `hook_linked_routine_id` (ARM 1 only via session_hook LEFT JOIN) are available — app can resolve task type (procedure checklist vs routine) via these FKs.

**Postcondition:** Manager sees all their tasks plus unassigned workspace tasks. Can assign or complete any unassigned task.

**Error paths:**
- Manager has profiles in multiple workspaces → RPC returns union across ALL active workspaces (ADR-0298 R8). Manager may see tasks from other workspaces. This is by design; UI filters by workspace context.
- `hook_linked_procedure_id` present but procedure row deleted → FK stays UUID; app resolves null on lookup. `resolveTaskType` returns `'unknown'` — acceptable V1.

---

## Journey 3: Agent Caller (stage-engine) — "Hva har jeg å gjøre?" via Botsson Chat

**Precondition:**
- User is in a Botsson chat session (web or mobile)
- stage-engine invokes capability via service_role JWT
- `ctx.workspaceId` and `ctx.profileId` are server-derived from BFF session (ADR-0151)
- `auth.uid()` is NULL in service_role context

**Steps:**

1. User says: "hva har jeg å gjøre i dag" / "vis oppgavelisten" / "hva er åpent".
2. Intent classifier routes to `task` capability, tool `list_mine`.
3. `listMine.execute(params, ctx)` is called.
4. Execute body does NOT call `fn_list_my_tasks` RPC (would return empty result — Invariant 1, ADR-0317).
5. Execute performs 4 direct table queries via `ctx.supabaseAdmin`:
   - ARM 1: `session_task` — `.eq("workspace_id", ctx.workspaceId).or("assigned_to.eq.${ctx.profileId},assigned_to.is.null")`
   - ARM 2: `schedule_day_task` — `.eq("workspace_id", ctx.workspaceId).or(...).gte("shift_date", windowStart).lte("shift_date", windowEnd)`
   - ARM 3: `personal_task` — `.eq("workspace_id", ctx.workspaceId).eq("profile_id", ctx.profileId)`
   - ARM 4: `emma_task` — `.eq("workspace_id", ctx.workspaceId).eq("profile_id", ctx.profileId)`
6. Results are normalized inline (same status/priority mapping as RPC) and merged into one array.
7. If `rows.length === 0`: returns `"Du har ingen åpne oppgaver i dette tidsvinduet."`.
8. Else: returns `JSON.stringify({ tasks: rows })`.
9. LLM receives the JSON and presents a natural-language summary to the user.
10. Caller (BFF or collector context) MAY emit `task.list_mine` with `{ path: "ts_fallback", row_count, window_days }`.

**Postcondition:** User receives a natural-language list of their open tasks from Botsson. No empty result due to auth.uid()=NULL.

**Error paths:**
- One of the 4 ARM queries fails (e.g. `schedule_day_task` table not reachable) → execute returns early with `"Feil ved lasting av dagsplanoppgaver: {error.message}"`. Partial results are NOT returned. This is intentional: partial UNION would misrepresent the task surface.
- `ctx.profileId` or `ctx.workspaceId` is empty string → `nonEmpty()` guard in telemetry throws at emit time, not at query time (queries with empty string return 0 rows, not errors). Upstream BFF MUST enforce non-empty derivation (ADR-0151).
- Voice channel call (`ctx.channel === "voice"`) → `list_mine` is allowed on voice (no PII in output shape, no free-text input). Channel guard does NOT block this tool. Read: `// Tool 1 — task.list_mine — Channels: chat + voice`.

---

## Auth Divergence Summary

| Caller | Path | auth.uid() | Identity source | Invariant |
|--------|------|-----------|----------------|-----------|
| Mobile anon JWT | `fn_list_my_tasks` RPC | Resolves to user UUID | `caller_profiles` CTE | ADR-0317 Invariant 1 |
| Browser session JWT | `fn_list_my_tasks` RPC | Resolves to user UUID | `caller_profiles` CTE | ADR-0317 Invariant 1 |
| stage-engine service_role | TS-fallback (listMine.execute) | NULL | `ctx.workspaceId` + `ctx.profileId` | ADR-0317 Invariant 1 + ADR-0298 R4 |
| Edge Functions service_role | Direct table reads | NULL | caller-supplied filter | ADR-0298 R4 |

**Rule:** Any new consumer that needs this data MUST determine which path applies based on auth context. Service_role consumers MUST NEVER call the RPC.
