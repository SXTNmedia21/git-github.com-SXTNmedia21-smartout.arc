---
title: "Journey — Task RPC Read-Path (Sortie B)"
status: done
updated: 2026-05-13
created: 2026-05-13
module: cascade
tags: [sortie-b, journey, rpc, ADR-0298, ADR-0300]
---

# Journey — Task RPC Read-Path (Sortie B)

> Branch: `feat/task-rpc-readpath` | ADR: ADR-0300 | Parent: ADR-0298

Cross-reference: [ADR-0298](../decisions/0298-task-ontology-five-sources.md) (task ontology parent), [ADR-0300](../decisions/0300-task-rpc-readpath.md) (this sortie), [ADR-0151](../decisions/0151-identity-derivation-server-side.md) (identity derivation), [ADR-0078](../decisions/0078-workspace-isolation.md) (workspace isolation).

---

## Journey 1: Employee — Mobile Task List Union

**Role:** Employee (active workspace member, authenticated JWT)
**Precondition:** Profile exists in workspace W1. At least one task exists across any of the 4 sources (`session_task`, `schedule_day_task`, `personal_task`, `emma_task`). Mobile app is open and authenticated.

1. Employee opens the Tasks screen in the mobile app → `useMyTasks` hook mounts.
2. Hook calls `supabase.rpc('fn_list_my_tasks')` with no arguments (identity derived from JWT inside the RPC via `auth.uid()`).
3. RPC executes as SECURITY DEFINER, resolves `caller_profiles` CTE from `auth.uid()`, returning all workspace_ids where the caller has an active profile.
4. UNION across 4 sources:
   - `session_task` rows assigned to `auth.uid()` (D6 cascade tasks)
   - `schedule_day_task` rows assigned to `auth.uid()` OR where `assigned_to IS NULL` and workspace matches (D6 ad-hoc + pickup)
   - `personal_task` rows owned by `auth.uid()` (C2 user-curated)
   - `emma_task` rows assigned to `auth.uid()` (C2 agent-curated, max-3 guardrail enforced at write time)
5. Each row is normalized: status mapped via `fn_normalize_session_task_status` / `fn_normalize_priority`; `source` discriminator column identifies origin table.
6. Result set sorted compliance-first (D6 cascade tasks before personal/emma), then by due_at ascending.
7. Hook transforms rows into `MyTaskRow[]` and renders the task list → Employee sees unified task list across all sources.

**Postcondition:** Task list reflects current DB state. Source discriminator is available for per-row UI rendering (e.g. compliance badge on session_task rows).

**Error paths:**
- Anon JWT (not authenticated): `caller_profiles` CTE returns 0 rows → RPC returns empty result set. UI shows empty state. No error thrown, no 401. Employee must re-authenticate via app auth flow.
- Network error: `useMyTasks` catches Supabase error, sets `isError=true`, renders error state CTA.
- Empty workspace (no tasks): RPC returns 0 rows → UI shows empty state with "Ingen oppgaver" message.

---

## Journey 2: NULL-Assigned Schedule Day Task — Workspace Pickup Flow

**Role:** Manager (creates ad-hoc task), Employee (picks up task)
**Precondition:** Manager and Employee both belong to workspace W1. A second workspace W2 exists with different members. `schedule_day_task` is created with `assigned_to = NULL` for workspace W1.

1. Manager creates a `schedule_day_task` row for workspace W1 with `assigned_to = NULL` (e.g. "Fyll på desinfisering", no specific assignee).
2. Any W1 member opens the Tasks screen → `useMyTasks` → `fn_list_my_tasks` called.
3. RPC's `schedule_day_task` branch includes `WHERE assigned_to = auth.uid() OR assigned_to IS NULL` filtered by workspace_id match (caller's workspace_ids from CTE).
4. W1 employee sees the NULL-assigned task in their list — it appears as a pickup task with source discriminator `schedule_day_task`.
5. W1 employee completes or claims the task via the appropriate mutation (Sortie 3 capability scope).
6. Task disappears from pickup pool once completed (status update reflected on next `useMyTasks` refetch).

**Postcondition:** NULL-assigned task was visible to all W1 members simultaneously. First completer owns the completion.

**Error paths:**
- W2 member calls `fn_list_my_tasks`: `caller_profiles` CTE resolves W2's workspace_ids only. The NULL-assigned W1 task has `workspace_id = W1` — workspace_id join in the CTE filters it out. W2 member sees 0 rows from this source. **Workspace boundary holds — no cross-workspace leak.**
- NULL-assigned task in W2 similarly does NOT appear for W1 members: same CTE workspace filter applies symmetrically.

---

## Journey 3: Multi-Workspace Caller — Single RPC Fetch Across Both Workspaces

**Role:** Regional manager E2 (active member of both workspace W1 and workspace W2)
**Precondition:** Profile rows exist for E2 in both W1 and W2. Both `is_active = true`. Tasks exist in both workspaces assigned to E2's profile_id (or NULL-assigned in both).

1. E2 opens the Tasks screen on mobile → `useMyTasks` → `fn_list_my_tasks` called once.
2. RPC resolves `caller_profiles` CTE: `SELECT workspace_id FROM profile WHERE id = auth.uid() AND is_active = true` — returns both W1 and W2.
3. UNION branches use `WHERE workspace_id = ANY(caller_workspace_ids)` — all 4 sources span both workspaces in a single pass.
4. Result set contains tasks from both W1 and W2, source-discriminated and normalized.
5. E2 sees a unified cross-workspace task list — no separate W1 / W2 calls needed. Source discriminator + workspace_id column allow per-row workspace attribution in UI.

**Postcondition:** R8 multi-workspace invariant satisfied. One RPC call, one result set, complete task view for multi-workspace actors. No N+1 pattern.

**Error paths:**
- E2 deactivated from W2 (`is_active = false`): `caller_profiles` CTE excludes the W2 row. W2 tasks do NOT appear in E2's list — deactivated membership is transparent to the caller. Only W1 tasks returned.
- E2 removed entirely from W2 (`profile` row deleted): same effect as deactivation — CTE returns only W1 workspace_id.
- W1 active + W2 deleted: CTE filters to W1 only; no error, no phantom rows.
