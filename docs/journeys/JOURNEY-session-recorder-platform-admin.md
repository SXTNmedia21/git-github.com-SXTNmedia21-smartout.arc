---
title: "Journey — Session Recorder + Platform Admin Intervention"
status: draft
updated: 2026-04-22
created: 2026-04-22
module: MODULE_BOTSSON
tags: [journey, botsson, platform-admin, session-recorder, observability]
---

# Journey — Session Recorder + Platform Admin Intervention

## Context

Landed via ADR-0184 (Session Recorder) + ADR-0185 (Platform Admin Session Intervention), Phase D1, 2026-04-22.

Every Emma session is now recorded turn-by-turn into `agent_session_recording` with PII redacted on write (envelope kept encrypted for break-glass). Platform Admin has 4 intervention surfaces on a live or historical session: flag, whisper, force-stop, break-glass PII reveal. All are C4-gated and audit-logged per `activity_trail`.

**Phase 2 caveats** — these journeys are authored against the end-state. As of D1 landing:

- `SessionList` recorder overlay is wired in `GuardianMonitor`.
- `TurnTimeline`, `TurnCard`, `RedactedPill`, `AdminActionDrawer` are built but not yet composed into `GuardianDashboard`.
- BFF endpoints: `flag`, `whisper`, `sessions/[id]`, `break-glass/[envelope_id]` are live. `flag-session`, `force-stop`, `_metrics` are Phase 2 follow-ups.

Until Phase 2 lands, journeys 1, 2, and 4 operate on partial UI surfaces; journey 3 (API-only) works end-to-end today.

---

## Journey 1: Admin triages a buggy session

**Precondition:** Platform Admin logged in (`is_godmode=true`), workspace has at least one Emma session from the last 90 days, session has at least one recorded turn.

1. Admin navigates to `/platform-admin/guardian` → System renders `GuardianMonitor` → Admin sees `SessionList` in the left rail, each row annotated with turn-count pill (`5t`), flag-count (`⚑ 2`), and attention-score marker (`⚠ 0.82`) when present.
2. Admin clicks a flagged row → System selects the session → Admin sees session details (full `TurnTimeline` composition pending Phase 2; today `SessionDetails` panel).
3. Admin expands a `TurnCard` → System renders full `content_redacted` JSON + meta keys → Admin identifies the offending tool call (e.g. `schedule.shift_created` with wrong day).
4. Admin hovers the card → System fades in the Flag icon (opacity 0→100, 200ms) → Admin clicks → `window.prompt("Hvorfor flagger du denne?")` → Admin enters reason → `POST /api/botsson/recorder/flag` with `{ turn_id, reason }` → Server stamps `is_flagged=true`, `flag_reason`, `flagged_by_profile_id` on `agent_session_recording`.
5. System extends retention from 90d to 365d for this session (cron sweeper honours `is_flagged`).
6. Admin opens `AdminActionDrawer` → Admin types a whisper → `POST /api/botsson/recorder/whisper` with `{ session_id, content }` → Server gates on `engine_authority_config.recorder.whisper`, inserts `agent_session_whisper` row with `is_consumed=false`.
7. On the next Emma turn for that session, `prompt-builder.ts` loads unconsumed whispers for the `session_id`, wraps them in `<admin_note visibility="internal" from="platform_admin">…</admin_note>`, marks the whisper `is_consumed=true`, emits `prompt_built` recorder turn containing the admin_note. Emma honours the guidance without quoting it verbatim.

**Postcondition:** Turn flagged with retention extended; whisper queued and consumed on next turn; both events appear in `activity_trail`.

**Error paths:**
- Session has no turns → `TurnTimeline` shows "Ingen turns." empty state; no crash.
- Whisper content > 2000 chars → BFF returns 400 (Zod validation) → Drawer shows alert.
- Admin lacks workspace access → RLS returns 0 rows → `TurnTimeline` shows "Session not found" (404 from BFF).
- `recorder.whisper` authority level is `disabled` or `read_only` → BFF returns 403 → Drawer alert "Whisper ikke tillatt for denne workspace".

---

## Journey 2: Platform Admin break-glass PII reveal

**Precondition:** Admin has `is_godmode=true`. Session contains a recorded turn whose `content_redacted` includes a PII pill (e.g. `<personnummer>`) backed by an `agent_session_envelope` row whose `redact_after > now()`. `engine_authority_config.recorder.pii_reveal` is `confirm` for the workspace (admin has per-incident flipped the default `disabled` → `confirm`).

1. Admin expands the turn in `TurnTimeline` → System renders `RedactedPill` components in place of PII strings → Admin hovers the pill → System reveals a "Vis (5s)" button (opacity fade, 200ms).
2. Admin clicks "Vis" → Client calls `GET /api/botsson/recorder/break-glass/{envelope_id}` → Server resolves `auth.uid()`, verifies `is_godmode`, verifies `recorder.pii_reveal='confirm'` for the envelope's workspace, calls `decrypt_envelope` RPC (pgcrypto symmetric, key from env).
3. Server returns `{ pii_class, plaintext, redact_after }` → Server simultaneously inserts `activity_trail` row `admin.pii_reveal` with `admin_profile_id`, `envelope_id`, `pii_class`, `duration_ms=5000`, and increments `pii_reveal_count` on the admin's session.
4. Client renders raw value in the pill for 5 seconds → After 5s the pill auto-redacts back to `<personnummer>`.

**Postcondition:** Audit trail contains a full record of who revealed what envelope when; envelope contents are visible to the admin for exactly 5 seconds; no plaintext is persisted in the DOM beyond that window.

**Error paths:**
- Envelope `redact_after < now()` → Server returns 410 Gone (cron sweeper purged plaintext) → Client shows "Ikke lenger tilgjengelig".
- Admin is not godmode → Server returns 403 → Client shows alert.
- `recorder.pii_reveal` is not `confirm` (still `disabled`) → Server returns 403 "Break-glass not enabled for this workspace — flip authority first" → Client shows alert.
- Envelope encryption key misconfigured (env missing) → Server returns 500 → Logged to Sentry; admin sees generic error.

---

## Journey 3: Developer replays schedule wrong-day bug

**Precondition:** User reported a bug: "Emma created my shift on Wednesday but I said Tuesday." User provided `session_id` (or admin found it via SessionList). Developer has admin JWT for the workspace.

1. Developer calls `GET /api/botsson/recorder/sessions/{session_id}` → Server verifies workspace access (RLS), queries `agent_session_recording` ordered by `turn_index` ascending, returns `{ session_id, workspace_id, turn_count, turns: [...] }`.
2. Developer inspects the turn timeline. For each turn they see:
   - `turn_kind` + `phase` (e.g. `user_input` / `classifier_input` → `classifier_output` → `llm_request` → `llm_response` → `tool_call` → `tool_result`)
   - `content_redacted` JSONB (user message, classifier I/O, LLM I/O, tool I/O — PII redacted)
   - `meta` (latency_ms, model version, git SHA, retry_count, etc.)
3. Developer pinpoints the issue — e.g. `classifier_input.current_date` is `2026-04-23T12:00:00Z` (UTC) but the user said "tomorrow" and workspace TZ is `Europe/Oslo` (+02:00) → classifier resolved to wrong day because TZ context was missing from `buildClassifierContext()`.
4. Developer opens a fix PR referencing the session and adding TZ to classifier input.
5. Developer flags the session in the UI with `"root-cause identified, fix in PR #NNN"` to keep it retained for 365d as evidence.

**Postcondition:** Root cause identified with evidence in hand; fix references a concrete recorded session; regression test can be seeded from the recorded input.

**Error paths:**
- Session not found or outside user's workspaces → 404 / 403.
- Session has been redaction-swept (>90d, not flagged) → Response has metadata but `content_redacted` keys may be stubs.
- Developer unauthenticated → 401, redirect to login.

---

## Journey 4: End-user flags turn from Arena LogView

**Precondition:** User (not platform-admin, not godmode) has Botsson Arena open, LogView tab active, sees a suspicious tool call or telemetry entry. User is logged in with a session that belongs to their own workspace.

1. User hovers a row in Tool Calls or Telemetri tab → System fades in the Flag icon in the row-end (opacity 0→100, 200ms — same Nordic Split motion as the admin-side).
2. User clicks the icon → `window.prompt("Hvorfor flagger du denne?")` → User enters reason.
3. Client calls `POST /api/botsson/recorder/flag-session` with `{ session_id, reason, source: 'arena_logview' }`.
4. **Phase 2 reality:** `/flag-session` endpoint is not yet implemented → Server returns 404 → Client shows a discrete alert and logs the intent so the user's signal isn't lost entirely.
5. **Phase 2 target:** Server creates a lightweight `agent_session_flag` row (or session-level flag on the recording), emits `recorder.session_flagged`, Platform Admin sees the row appear in `SessionList` within 2s via Supabase Realtime.

**Postcondition (Phase 2 target):** Session is flagged session-level; Platform Admin sees the flag in SessionList within 2s; retention extended to 365d.

**Error paths (Phase 2):**
- Network fails → Client shows toast with retry option; failed flag not lost (localStorage queue).
- User is not part of the session's workspace → 403.
- User on voice channel attempting to flag → falls back to chat UI (voice has no hover affordance).

**Phase 1e reality:** hover affordance is wired, endpoint returns 404, fallback alert fires. The UX gesture is ready for Phase 2 endpoint landing.

---

## Source artefacts

| Artefact | Path |
|----------|------|
| Spec | `docs/superpowers/specs/2026-04-22-session-recorder-platform-admin-design.md` |
| Plan | `docs/superpowers/plans/2026-04-22-session-recorder-platform-admin.md` |
| ADR-0184 | `docs/decisions/0184-session-recorder.md` |
| ADR-0185 | `docs/decisions/0185-platform-admin-session-intervention.md` |
| System map | `docs/architecture/BOTSSON-SYSTEM-MAP.md` §3 Session Recording |
| Campaign | `docs/plans/CAMPAIGN-botsson-arena.md` Phase D |
| E2E (TDD) | `apps/e2e/tests/botsson-recorder/*.spec.ts` (3 specs, skip-gated until Phase 2) |
| Learnings | `docs/learnings/0105-recorder-before-writer-dead-letter-trap.md`, `0106-whisper-not-takeover.md`, `0107-tiered-retention-resolves-capture-vs-retention.md`, `0108-code-trace-catches-what-grep-briefing-misses.md` |
