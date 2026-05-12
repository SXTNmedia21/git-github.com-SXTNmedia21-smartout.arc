---
title: F-CHAT-LIST User Journeys
status: verified
created: 2026-05-11
updated: 2026-05-11
module: MODULE_BOTSSON
feature: f-chat-list
tags: [journey, botsson, chat-list]
e2e_test: TBD-deferred-post-MVP
---

# F-CHAT-LIST — User Journeys

Three journeys delivered by F-CHAT-LIST per Council G1 (2026-05-11). Backend: `engine_sessions` single source of truth (ADR-0296). BFF: `/api/botsson/sessions/*` family. UI: HistoryView tab inside BotssonArena with AnimatePresence transitions.

---

## Journey 1: Employee browses chat history

**Precondition:** Logged-in employee with at least one prior Botsson chat session in workspace (`engine_sessions` row with `mode='agent'`, `channel='chat'`, `is_archived=false`, `profile_id=auth.uid()`).

1. User opens Arena (clicks Botsson orb) → System renders BotssonArena with default view active
2. User clicks "Historikk" view tab → System fetches `GET /api/botsson/sessions`; request resolves `workspace_id` from JWT + `profile_id` from `auth.uid()`; returns 50 most-recent non-archived sessions
3. User sees sessions list grouped by time buckets: I dag / I går / Denne uka / Eldre. Each row shows: first user-turn slice (max 60 chars) as title, relative timestamp.
4. User clicks a session row → AnimatePresence spring transition (8px nudge + opacity, 300ms ease-out) switches to conversation pane; System fetches `GET /api/botsson/sessions/[id]`; full conversation reconstructed from `engine_sessions.collected_data.conversation`
5. User reads transcript in conversation pane; URL updates to `?session=<uuid>`

**Postcondition:** User has read prior conversation. `?session=<uuid>` present in URL bar. No DB mutations occurred.

**Error paths:**
- List request returns 500 → retry message shown in list pane; "Kunne ikke laste historikk"
- Session request returns 404 (race condition / concurrent archive) → return to list pane + sonner toast "Samtalen ble ikke funnet"
- Session request returns 500 → sonner toast "Kunne ikke laste samtalen"; list remains visible

---

## Journey 2: Employee starts a new chat

**Precondition:** User in Arena with any view active (Historikk or existing conversation pane).

1. User clicks "Ny chat" button (MessageSquarePlus icon, right of "Historikk" tab header)
2. System: `startNewChat()` in BotssonProvider clears `currentSessionId` state, calls `router.replace` to remove `?session=` param from URL
3. System: BotssonChat re-mounts with empty messages array; input field gains focus
4. User types message and sends → BFF `POST /api/botsson/chat` receives request with `sessionId: undefined` in body
5. Stage-engine chat handler at `services/stage-engine/src/routes/agent/chat.ts:278-325` detects `sessionId=undefined`, calls `createAgentSession()`, creates new `engine_sessions` row, returns `sessionId` in response body alongside assistant reply
6. BotssonChat persists new sessionId via `setCurrentSessionId(data.sessionId)`; URL stays clean (no redirect needed until user navigates to Historikk)

**Postcondition:** New chat live with first assistant reply rendered. Opening Historikk shows the new session at top of list (within TanStack staleTime 30s). No orphaned sessions created.

**Error paths:**
- Stage-engine returns 500 on first send → error chip shown in chat; `sessionId` stays null; retry on next send creates new session (idempotent — no zombie sessions from failed creates because `engine_sessions` INSERT is atomic with first turn write)
- Network timeout → same as 500 path

---

## Journey 3: Admin archives a chat session

**Precondition:** Admin role (or owner) viewing Historikk list with at least one session present. Admin must have `workspace_id` resolved to own workspace (no cross-workspace archive).

1. Admin hovers over a session row → archive icon (Trash2 or Archive from Lucide) fades in (opacity 0 → 100, 200ms ease)
2. Admin clicks archive icon → optimistic remove: session row disappears from list immediately (AnimatePresence exit animation 150ms)
3. System sends `DELETE /api/botsson/sessions/[id]`; BFF sets `is_archived=true` on `engine_sessions` row; verifies `profile_id=auth.uid()` AND `workspace_id=$resolved_ws` before UPDATE (no cross-profile archive)
4. System emits `botsson.session.archived` telemetry event with ADR-0152 entity discriminator (`entity_type: "agent_session"`, `entity_id: session_id`)
5. `activity_trail` records the archival event for audit. GuardianMonitor continues to see session via `agent_session_recording` fan-out (ADR-0184) — archive hides from owner list only, recorder retention contract unchanged
6. Sonner toast confirms "Samtale arkivert"

**Postcondition:** Session hidden from employee/admin Historikk list. `engine_sessions.is_archived=true` in DB. `agent_session_recording` rows untouched — platform admin recorder feed unaffected.

**Error paths:**
- `DELETE` returns 500 → rollback optimistic remove: session row reappears in list (AnimatePresence enter animation); sonner toast "Kunne ikke arkivere samtalen"
- `DELETE` returns 404 (race: concurrent archive by another admin) → session already gone; treat as success silently (list already shows it absent)
- Admin attempts archive of another profile's session → BFF 403 (RLS + profile_id guard); optimistic rollback; toast "Ikke tilgang"
