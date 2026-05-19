---
title: "User Journey: Mobile P0 Fix Sweep"
status: done
created: 2026-05-19
updated: 2026-05-19
module: mobile
tags: [user-journey, mobile, sync, offline, task, payroll, shift-chat, telemetry, p0]
---

# User Journey: Mobile P0 Fix Sweep

> Branch: `feat/mobile-p0-fix-sweep` | Audit-driven plumbing sortie (2026-05-19).
> Journeys describe what the user EXPERIENCES post-fix vs the pre-fix silent failures.
> Technical root causes and decisions are in `HANDOFF-p0-fix-sweep.md`.

---

## Journey 1: Employee completes personal task while offline (P0-A)

**Role:** Employee
**Precondition:** App loaded and authenticated. Network disabled. Employee has at least one personal task visible in TaskFeed.

### Happy path

1. Employee taps a personal task in TaskFeed → tap "Merk som fullført"
   → System validates the queue payload at enqueue time: `completeTaskSchema` requires `{ id: uuid, source: enum }` → `source: "personal"` is included → validation passes
   → Optimistic completion applied immediately in UI (task marked done locally)
   → Action enqueued in SyncWorker offline queue with `{ id, source: "personal" }`
   → Employee sees task marked done; no spinner, no error

2. Employee re-enables network
   → SyncWorker drains offline queue
   → `complete_task` handler sends `POST /api/mobile/tasks/[id]/complete` with body `{ source: "personal" }`
   → BFF routes to `task.complete` tool with source discriminator → `personal_task.completed_at` set
   → `"task completed"` event emits to PostHog + Logger + activity_trail + engine_event (4 destinations)
   → Employee sees no change (already optimistic); background sync silent

**Postcondition:** `personal_task.completed_at` is set in Supabase. `activity_trail` has a "task completed" row. PostHog funnel records completion. Engine_event fires (downstream D6 hooks process if any registered for personal task completion).

### Error paths

| Scenario | What happens |
|----------|-------------|
| Token expired during offline period | SyncWorker receives 401 on POST → marks action as `pending_auth` → retries automatically when employee re-authenticates |
| `source` missing from payload (call-site bug, not possible after P0-A) | `completeTaskSchema` Zod validation throws at enqueue time with `"complete_task: missing source discriminator (ADR-0298 R3)"` — action never enters queue |
| Invalid `source` value (not in enum) | Same Zod throw at enqueue — caught at development time, not runtime |
| BFF non-2xx (task not found, already completed) | SyncWorker logs error, marks action as `failed` → operator retry via SyncWorker admin surface |

---

## Journey 2: Manager creates session task from mobile (P0-B)

**Role:** Manager
**Precondition:** App loaded and authenticated. Active `department_session` exists for the manager's department. Network available.

### Happy path

1. Manager opens TaskFeed → taps "Ny oppgave"
   → Task-create sheet mounts
   → Manager fills title, selects assignee (another employee), marks as compliance-required → taps "Lagre"
   → `getProfileContext()` resolves `workspace_id` + `profile_id` (throws fast if either missing — see Error paths)
   → `useCreateTask.mutate()` fires
   → `session_task` row inserted via BFF (`task.create_session` tool)
   → `emit()` called with canonical event `"task created"` (not the deprecated alias):
     - `source: "session"`
     - `actor_kind: "employee"` (manager is an employee in the cascade model)
     - `assigned_to_self: false` (different assignee selected)
     - `compliance: true` (manager flagged as compliance-required)
     - `reason: "Opprettet fra mobil"`
     - `manual: true`
   → Event routes to 4 destinations: PostHog, Logger, activity_trail, **engine_event**
   → Manager sees new task appear in TaskFeed (TanStack Query invalidation)

2. Backend: engine_event row received by engine-dispatch
   → Downstream D6 workflow (shift checkout compliance gate) registers the new compliance task
   → Shift checkout will now be blocked until the compliance task is completed (if applicable workflow rule is active)

**Postcondition:** `session_task` row exists. `activity_trail` row exists. PostHog event recorded. `engine_event` row exists — checkout gate will enforce compliance task before shift close.

### Error paths

| Scenario | What happens |
|----------|-------------|
| `getProfileContext()` throws (no workspace_id or profile_id) | Mutation never fires. Error boundary renders auth error. No enqueue. No corrupt telemetry. |
| Network disabled at task creation | `useCreateTask` mutation fails (not offline-queue-backed for CREATE in V1 — see ADR-0298 R6 chat-only restriction). User sees error toast. Action not lost to silent failure. |
| `session_task` insert fails (permission, constraint) | BFF returns 4xx → TanStack Query `onError` fires → error toast. No emit() call (only fires in onSuccess per convention). |

---

## Journey 3: Employee views payroll empty state (P0-D)

**Role:** Employee
**Precondition:** Employee has no payroll periods yet (new workspace, first pay period not yet processed).

### Happy path

1. Employee opens Payroll tab
   → System queries `payroll_period` → empty result
   → Empty state renders:
     **"Ingen lønnsgrunnlag tilgjengelig ennå. Ditt første lønnsgrunnlag vises her etter første lønnskjøring."**
   → Correct product positioning: Smartout delivers wage basis (lønnsgrunnlag), not a payslip (lønnsslipp)

**Postcondition:** Employee understands Smartout generates wage basis for accountants to process — not a final payslip document.

### Error paths

| Scenario | What happens |
|----------|-------------|
| Network fails on payroll fetch | Error state renders: **"Kunne ikke laste lønnsgrunnlag"** (previously said "lønnsslipp") |
| Partial data (some periods, some missing) | Only verified periods displayed; no lønnsslipp terminology in any rendered string |

---

## Journey 4: Employee opens shift chat (known limitation — P0-C)

**Role:** Employee
**Precondition:** Employee is on an active shift. Shift has an associated shift-chat conversation (legacy `chat_conversation` row).

### Post-fix behavior

1. Employee opens Skiftkort / shift-clock screen
   → `useShiftChat` mounts → reads `chat_conversation` + `chat_message` via legacy Supabase query → message history loads and displays correctly (read path unchanged)
   → Realtime subscription active: new messages from other participants appear in real time

2. Employee types a message and taps Send
   → `useShiftChat.sendMessage()` calls `enqueue("send_message", { ..., conversation_id, ... })`
   → `sendMessageSchema` validates: requires `channel_id` (uuid) — payload has `conversation_id` instead → **Zod throws at enqueue**
   → `useShiftChat` catches the throw → optimistic message prepend is rolled back (no stuck pending bubble)
   → Console warning logged: `"[useShiftChat] send rejected at enqueue — shift chat pending channel/channel_message migration"`
   → Employee sees their typed message disappear (rollback); no error toast in current implementation (UX decision: loud console, silent UI to avoid confusing the user mid-shift)

**Postcondition:** No message lost silently (pre-fix: enqueued with wrong field, lost on sync). No broken UI state. The known limitation is auditable in device logs. Full fix tracked in `mobile-shift-chat-bff-migration`.

**Known limitation:** Sending shift chat messages from mobile is currently disabled as a consequence of the mid-migration schema state. Reading message history (from other participants) works correctly.

### Error paths

| Scenario | What happens |
|----------|-------------|
| `chat_conversation` not found for shift | `useShiftChat` returns empty message list. No crash. |
| Realtime subscription drops | Message list freezes until reconnect; no data loss (read from Supabase on reconnect) |
| Employee on a shift that already uses `channel` (new schema) | Same Zod throw — until `mobile-shift-chat-bff-migration` ships, send is blocked regardless of which conversation schema the shift uses |
