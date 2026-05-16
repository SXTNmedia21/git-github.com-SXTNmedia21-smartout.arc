---
title: "User Journeys — hard-delete-operations-complete"
feature: hard-delete-operations-complete
status: verified
created: 2026-05-13
updated: 2026-05-13
tags: [sortie-5b, journeys, capability, task]
---

# User Journeys — hard-delete-operations-complete

---

## Journey A: Manager completes session_task via web (Server Action path)

**Precondition:** Manager is authenticated. A `session_task` row exists with `status='open'` for their workspace. The `completeSessionTaskAction` Server Action is wired to the UI button.

1. Manager clicks "Marker som ferdig" on a task in the dashboard → UI calls `completeSessionTaskAction(taskId)`.
2. Server Action derives `workspaceId` and `profileId` from session (server-side; not from request body per ADR-0151).
3. Server Action calls `complete.execute({id: taskId, source: 'session'}, ctx)` inside the `task` capability.
4. `task.complete` tool body calls `gate_action` RPC with `p_action='task.complete'`, `p_workspace_id`, `p_profile_id`, `p_payload={id, source}` → DB returns `{allowed: true}`.
5. Tool body executes `UPDATE session_task SET status='done', completed_at=now() WHERE id=taskId AND workspace_id=workspaceId`.
6. Tool body calls `emit('task completed', {workspaceId, profileId, taskId, source: 'session'})` → fans out to PostHog + Logger + `activity_trail` + `engine_event`.
7. Server Action returns `{success: true}` → UI marks task done locally.

**Postcondition:** `session_task.status='done'`, `completed_at` set, gate_evaluation row written, activity_trail entry present.

**Error paths:**
- `gate_action` returns `allowed: false` → `task.complete` returns error string → Server Action surfaces error toast.
- `session_task` row not found (wrong workspace) → UPDATE affects 0 rows → tool returns "Task not found" → error toast.
- DB unavailable → unhandled exception → Server Action catches and returns generic error.

---

## Journey B: Manager completes task via Botsson chat (capability tool path)

**Precondition:** Manager has an active Botsson chat session. A task is pending. The `aliasTaskVerbs` shim is active (Sortie 5c not yet shipped).

1. Manager types "Marker oppgave [ID] som ferdig" → BFF `/api/botsson/chat` receives message.
2. Intent classifier routes to `task` capability (direct match, or via `aliasTaskVerbs` shim if phrased with "operations" prefix).
3. Stage Engine loads `task` capability tools for the resolved authority level.
4. LLM selects `task.complete` tool with `{id: <taskId>, source: 'session'}` parameters.
5. Tool body executes gate → UPDATE → emit (same path as Journey A steps 4-6).
6. Tool returns "Oppgave fullfort." → LLM formats response → BFF streams response to chat UI.

**Postcondition:** Same as Journey A. Telemetry event family is `task completed` (not the deprecated `operations.complete_task` family).

**Error paths:**
- Authority level is `read_only` → `task.complete` not in exposed tool set → LLM responds "Jeg har ikke tilgang til å fullføre oppgaver."
- Channel is `voice` → `task.complete` is available on voice (not PII-gated) → executes normally.
- Intent misrouted to `operations` → `operations` capability no longer has `complete_task` tool → LLM cannot invoke it → stage engine returns "Tool not found" → LLM falls back to generic response.

---

## Journey C: Eval harness scenario (test path, no `complete_task` fixtures)

**Precondition:** `packages/ai/src/evals/operations.eval.ts` has been updated (Sortie 5b Phase 5). Only `createDeviation` fixtures remain.

1. CI runs `pnpm vitest run evals/operations.eval.ts` (or equivalent eval script).
2. Harness loads `operations` capability eval fixtures.
3. Fixtures cover: `createDeviation` with valid params → tool body executes → mock DB insert succeeds → emit verified.
4. No fixture exercises `complete_task` — the tool does not exist in the capability.
5. Assertions stay green: `createDeviation` coverage 100%; `complete_task` fixture count = 0 (expected).

**Postcondition:** Eval suite passes. No phantom references to deleted tool. Coverage gap for `task.complete` eval lives in `evals/task.eval.ts` (Sortie 3 shipped).

**Error paths:**
- If any fixture references `operations.complete_task` by name → tool lookup fails → eval harness throws `Tool not found` → CI red. This is the correct failure mode; fix = remove the stale fixture.
- `createDeviation` gate mock returns `allowed: false` → eval asserts tool returns error string, not throws → green by design (tool surfaces gate denials gracefully).
