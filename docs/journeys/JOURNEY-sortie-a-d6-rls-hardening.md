---
title: "JOURNEY — Sortie A D6 RLS Hardening"
status: done
updated: 2026-05-13
created: 2026-05-13
module: cascade
tags: [sortie-a, journey, rls]
---

# JOURNEY — Sortie A D6 RLS Hardening

> Feature: `feat/sortie-a-d6-rls-hardening` | Branch closed: 2026-05-13

These journeys cover the four actors relevant to the `shift_approval` RLS WITH CHECK hardening shipped in Sortie A. The policies defend the JWT-path write surface; service_role writers (BFF Server Actions, engine-dispatch, agent tools) bypass RLS by design (see ADR-0299 + L-0238).

Cross-references: [ADR-0151](0151-forgery-defense-actor-derivation.md) (forgery defense), [ADR-0298](0298-task-ontology-five-sources.md) (parent ADR), [ADR-0299](0299-sortie-a-d6-rls-with-check.md) (this sortie).

---

## Journey 1: Forger — Cross-Workspace Forgery Attempt (Negative Path)

**Role:** External attacker holding a valid employee JWT for workspace_A
**Precondition:**
- Attacker is authenticated in workspace_A and holds a valid Supabase JWT.
- A `shift_approval` row exists in workspace_B (`workspace_id = workspace_B_id`).
- Attacker knows the `approval_id` of the workspace_B row (e.g. via enumeration or leaked data).

| Step | Attacker action | System response | Result |
|------|-----------------|-----------------|--------|
| 1 | Sends `PATCH /rest/v1/shift_approval?approval_id=eq.{workspace_B_row_id}` with workspace_A JWT in `Authorization: Bearer …` header | PostgREST evaluates USING clause of UPDATE policy: `workspace_id = auth.jwt()->>'workspace_id'`. `auth.jwt()->>'workspace_id'` resolves to workspace_A. Row's `workspace_id` = workspace_B. Predicate fails. | Row excluded from result set — 0 rows in scope |
| 2 | — | If body passes WITH CHECK: not evaluated (row never reached USING). PostgREST returns `HTTP 204 No Content` with `Content-Range: */0`. | Attacker sees `*/0` — 0 rows affected. No data leaked, no modification. |
| 3 | Attacker retries with body containing `workspace_id: workspace_B_id` (body forgery attempt) | WITH CHECK: `workspace_id = auth.jwt()->>'workspace_id'` — JWT resolves to workspace_A, body's workspace_B fails check. PostgREST rejects with `HTTP 403 Forbidden` or `400 Bad Request` depending on RLS strict mode. | Blocked. No row written. |

**Postcondition:** workspace_B row is unmodified. Attacker receives `204 */0` (USING block) or `403/400` (WITH CHECK block). No data exposed.

**Error paths:**

| Scenario | System behavior | Attacker sees |
|----------|-----------------|---------------|
| JWT expired | PostgREST rejects at auth layer — `401 Unauthorized` | Cannot proceed |
| No `shift_approval` row with that ID in workspace_A | USING filters to 0 rows; `204 */0` | No information about workspace_B row existence |

---

## Journey 2: Manager Approves Shift via Mr. Botsson Agent (Happy Path)

**Role:** Manager (profile with `role IN ('manager', 'admin', 'owner')` in workspace)
**Precondition:**
- Manager is authenticated in the workspace.
- A `shift_approval` row exists with `status = 'pending'` for a shift in their department.
- `engine_authority_config` has `schedule.approve_shift` with `allow = true` for the workspace.

| Step | User action | System response | User sees |
|------|-------------|-----------------|-----------|
| 1 | Manager says "Godkjenn timene til {name} for forrige uke" to Mr. Botsson | Botsson routes intent to `approve_shift` tool in `operations` capability | Botsson responds "Sjekker…" |
| 2 | — | `approve_shift` tool calls `ctx.supabaseAdmin` (service_role). RLS policies are **bypassed** (intentional — admin-tier tooling). `UPDATE shift_approval SET status = 'approved', manager_approved_at = now() WHERE approval_id = {id}` executes directly. | — |
| 3 | — | Tool calls `emit("shift confirmed", { entity_type: "shift_approval", entity_id: approvalId, actor_id: managerProfileId, workspace_id: workspaceId })`. Routes to PostHog + Logger + activity_trail + engine_event (4 destinations). | — |
| 4 | — | Botsson returns confirmation text to manager. | "Timer for {name} er godkjent." |

**Postcondition:** `shift_approval.status = 'approved'`, `manager_approved_at` set, telemetry emitted to all 4 destinations, `activity_trail` row created with manager as actor.

**Error paths:**

| Scenario | System behavior | User sees |
|----------|-----------------|-----------|
| `approval_id` not found | service_role UPDATE returns 0 rows; tool returns `{ ok: false, error: "not_found" }` | Botsson: "Fant ikke timegodkjenningen. Sjekk om den allerede er godkjent." |
| `engine_authority_config` blocks | `gateAction` returns `{ allowed: false }` before DB write | Botsson: "Godkjenning er ikke aktivert for dette arbeidsstedet." |
| DB error | service_role throws; tool catches + emits failure event | Botsson: "Noe gikk galt. Prøv igjen eller kontakt support." |

---

## Journey 3: Employee Confirms Own Hours via Mobile App (Happy Path)

**Role:** Employee (profile with a `shift_approval` row for their own pay period)
**Precondition:**
- Employee is authenticated with valid JWT in mobile app.
- `shift_approval` row exists with `employee_profile_id = auth.uid()` and `status = 'pending'`.
- `engine_authority_config` has `timesheet.confirm_hours` with `allow = true`.

| Step | User action | System response | User sees |
|------|-------------|-----------------|-----------|
| 1 | Taps "Godkjenn timer" on hours summary card | Mobile client sends `PATCH /api/mobile/shift-approvals/{approval_id}/confirm` with JWT in header | Loading indicator |
| 2 | — | BFF route calls `resolveMobileActor(token)` — derives `profileId` + `workspaceId` server-side from JWT. Returns `401` if token invalid. | — |
| 3 | — | BFF calls `confirmHoursAction({ approvalId, actorProfileId, actorWorkspaceId })`. `gateAction("timesheet.confirm_hours")` checks `engine_authority_config`. | — |
| 4 | — | Server Action writes via `ctx.supabaseAdmin` (service_role). RLS bypassed (intentional). `UPDATE shift_approval SET employee_confirmed_at = now(), status = 'confirmed' WHERE approval_id = {id}`. | — |
| 5 | — | `emit("hours confirmed", { entity_type: "shift_approval", … })` fires (4 destinations). | — |
| 6 | — | BFF returns `{ ok: true, approvalId }` with HTTP 200. | "Timer godkjent" badge on hours card |

**Postcondition:** `shift_approval.status = 'confirmed'`, `employee_confirmed_at` set, telemetry emitted.

**Error paths:**

| Scenario | System behavior | User sees |
|----------|-----------------|-----------|
| JWT expired | `resolveMobileActor` returns null; BFF `401` | "Logg inn på nytt" error banner |
| Already confirmed | UPDATE returns 0 rows (status constraint); `422` | "Timer allerede godkjent" toast |
| `allow = false` | `gateAction` blocks; `422` | "Ikke autorisert" toast |
| Offline | Mobile sync queue enqueues; retried on reconnect | Offline indicator |

---

## Journey 4: Engine-Dispatch Creates shift_approval Row (Happy Path)

**Role:** Engine-dispatch cron (platform-level process, runs as service_role)
**Precondition:**
- A `department_session` closes or a `schedule_shift` completes.
- Engine-dispatch queue triggers `queue_shift_approval` action for the relevant profile.
- No existing `shift_approval` row for that profile + period.

| Step | System action | Response | Effect |
|------|---------------|----------|--------|
| 1 | Engine-dispatch evaluates `queue_shift_approval` action handler | Calls Supabase via service_role — RLS bypassed (intentional, platform write) | — |
| 2 | `INSERT INTO shift_approval (approval_id, workspace_id, employee_profile_id, period_start, period_end, status) VALUES (…, 'pending')` | Row created. `workspace_id` sourced from D6 session context (not from any request body — no forgery vector). | `shift_approval` row in `pending` state |
| 3 | Engine-dispatch emits `shift_approval created` to activity_trail + engine_event | Downstream engine_state picks up event and schedules notification to employee | Manager dashboard shows row in "Venter på godkjenning" list |

**Postcondition:** `shift_approval` row created with `status = 'pending'`. Row is now eligible for Journey 2 (manager approval) or Journey 3 (employee confirmation).

**Error paths:**

| Scenario | System behavior |
|----------|-----------------|
| Duplicate row (shift already processed) | `INSERT` violates unique constraint on `(employee_profile_id, period_start)`. Engine-dispatch catches, logs, skips — idempotent. |
| `workspace_id` missing from D6 session context | Engine-dispatch fails fast (NOT NULL constraint). Emits `shift_approval creation failed` to activity_trail. Does NOT create row with NULL workspace_id (telemetry contract ADR-0134). |

---

## Out of Scope (Sortie A)

- `personal_task` + `emma_task` WITH CHECK hardening (Sortie A.2, reserved)
- `schedule_shift` policy changes beyond audit comments (no ALTER POLICY)
- Read path: `fn_list_my_tasks` RPC (Sortie 2)
- Task capability (Sortie 3)
- Mobile Kalender UI (Sortie 4)
