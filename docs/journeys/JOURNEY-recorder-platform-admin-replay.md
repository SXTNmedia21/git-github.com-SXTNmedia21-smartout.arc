---
title: "Journey: Recorder — Platform Admin Session Replay"
status: done
created: 2026-05-09
updated: 2026-05-09
module: MODULE_BOTSSON
tags: [botsson, recorder, platform-admin, session-replay, guardian, whisper, force-stop, break-glass, journey]
decisions: [ADR-0184, ADR-0185]
---

# Journey: Recorder — Platform Admin Session Replay

## Journey: Platform Admin Reviews a Flagged Session

**Precondition:**
- Viewer has `is_godmode = true` (platform admin).
- At least one session exists in `agent_session_recording`.
- Viewer is on `/platform-admin/guardian` in the dashboard.

**Steps:**

1. Admin navigates to `/platform-admin/guardian`
   → System renders `SessionList` component
   → Admin sees list of sessions (via `useRecorderSessions` hook — Realtime + REST-fallback)
   → Flagged sessions shown with visual indicator (`is_flagged`)

2. Admin clicks on a flagged session
   → System calls `GET /api/botsson/recorder/sessions/[id]`
   → System returns all turns sorted by `turn_index` (service-role read of `agent_session_recording`)
   → Admin sees turn-by-turn transcript (TurnTimeline — pending composition in Phase 2)

3. Admin reviews a suspicious turn
   → Turn shows `content_redacted` (PII removed from display)
   → Admin sees `attention_score`, `turn_kind`, `phase`

**Postcondition (read-only replay):**
- No system state changed.
- Admin has reviewed session content.

**Error paths:**
- Session not found → 404 from API. UI shows "Sesjonen ble ikke funnet."
- Admin is not godmode → RLS rejects read. 403 from API. Redirect to unauthorized page.

---

## Journey: Platform Admin Injects a Whisper

**Precondition:**
- Admin has godmode.
- A live session exists (agent is mid-conversation with an employee).
- C4 authority for `recorder.whisper` is set to `execute` for the platform (ADR-0185).

**Steps:**

1. Admin selects a live session → sees current turn state
2. Admin types a whisper message in the AdminActionDrawer
   → Admin taps "Send whisper"
3. System calls `POST /api/botsson/recorder/whisper`
   → System inserts row into `agent_session_whisper` (`content`, `admin_profile_id`, `is_consumed = false`)
   → API responds 200

4. On the next turn (next user message to Botsson):
   → `prompt-builder.ts` reads unconsumed whispers
   → Wraps whisper content in `<admin_note>` tag in the system prompt
   → Marks whisper `is_consumed = true`
   → Agent incorporates admin context into response (never user-facing)

**Postcondition:**
- Whisper consumed. Agent has incorporated admin guidance.
- Whisper row marked `is_consumed = true`.
- Employee never sees the whisper text — it is injected into system prompt only.

**Error paths:**
- C4 authority check fails → 403. Admin sees "Tillatelse nektet for whisper."
- Session ended between whisper send and next turn → whisper row stays `is_consumed = false`. No side-effects; stale whisper is ignored on next session.

---

## Journey: Platform Admin Force-Stops a Session

**Precondition:**
- Admin has godmode.
- C4 authority for `recorder.force_stop` is set to `execute`.
- A live session is causing unsafe or non-compliant output.

**Steps:**

1. Admin identifies a problematic live session
2. Admin taps "Force stop" in the AdminActionDrawer (or dedicated button)
3. System calls `POST /api/botsson/recorder/force-stop`
   → System generates auto-whisper: "Previous turn interrupted by admin, begin fresh"
   → System inserts whisper row into `agent_session_whisper`
   → `prompt-builder` picks it up on next turn via `<admin_note>` pipe

4. Next user message → agent sees the admin note, resets context, begins fresh turn
   → No "session terminated" message to user — transition is soft (whisper-based)

**Postcondition:**
- Session continues but agent has been reset by admin guidance.
- Activity logged in `activity_trail`.

**Error paths:**
- C4 authority check fails → 403.
- No active session found → 404.

---

## Journey: Platform Admin Break-Glass PII Reveal

**Precondition:**
- Admin has godmode.
- C4 authority for `recorder.pii_reveal = 'confirm'`.
- An encrypted `agent_session_envelope` row exists (TTL 30d from creation).
- A compliance or safety event requires viewing raw PII.

**Steps:**

1. Admin navigates to the flagged turn with PII envelope
2. Admin taps "Break glass" (reveal PII)
   → UI shows 5-second confirmation window
3. Admin confirms within 5 seconds
4. System calls `GET /api/botsson/recorder/break-glass/[envelope_id]`
   → System calls `decrypt_envelope` RPC (SECURITY DEFINER, godmode-only)
   → System decrypts pgcrypto-encrypted `agent_session_envelope` content
   → System logs the reveal in `activity_trail` (who, when, which envelope)
   → Admin sees decrypted raw content in UI (5-second display window)

**Postcondition:**
- PII revealed to admin (read-only).
- Reveal event permanently recorded in `activity_trail`.
- Envelope TTL unaffected — raw PII remains available for remainder of 30d window.

**Error paths:**
- Envelope TTL expired → 404. "PII-data er ikke lenger tilgjengelig (utløpt etter 30 dager)."
- C4 authority not `confirm` → 403. "Konfigurer recorder.pii_reveal='confirm' for å aktivere."
- Admin confirmation times out (> 5s) → UI reverts. API not called.

## Design Notes

- **SessionLane vs `session_lane` table:** ADR-0185 references `session_lane.status='interrupted'` — this is aspirational. `SessionLane` is an in-memory promise queue, not a persisted table. The whisper-pipe achieves the same operational intent.
- **5s UI window:** server-side enforcement is NOT implemented — this is client-enforced only. Future hardening: server-side TTL on `decrypt_envelope` RPC.
- **`TurnTimeline` + `AdminActionDrawer`:** components exist but pending composition in platform-admin/guardian layout (Phase 2 scope).
