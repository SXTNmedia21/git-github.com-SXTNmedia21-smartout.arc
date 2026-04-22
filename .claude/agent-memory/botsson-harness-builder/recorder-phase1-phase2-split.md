---
name: Session Recorder Phase 1 vs Phase 2 split
description: Clear inventory of what landed in D1 (Phase 1a-1e) vs what is still Phase 2 for the session-recorder stack
type: project
---

**Phase 1 (D1) landed 2026-04-22** — ADR-0184 + ADR-0185 both accepted.

What shipped end-to-end:
- 3 tables: `agent_session_recording`, `agent_session_envelope`, `agent_session_whisper` + pgcrypto + cron TTL
- `services/stage-engine/src/core/session-recorder.ts` fire-and-forget helper
- Hooks in prompt-builder (whisper injection + prompt_built turn), agent-router (classifier + LLM turns), authority (authority_load), guardian-evaluator (guardian_eval), memory-manager (memory_read/write)
- 4 BFF endpoints: `POST /flag`, `POST /whisper`, `GET /sessions/[id]`, `GET /break-glass/[envelope_id]` + `decrypt_envelope` RPC
- `useRecorderSessions` hook + `SessionList` overlay (wired into `GuardianMonitor`)
- Components built but **not composed** into GuardianDashboard: `TurnTimeline`, `TurnCard`, `RedactedPill`, `AdminActionDrawer`
- Arena LogView hover-flag affordance (posts to 404-ing `/flag-session` with graceful alert fallback)
- 3 E2E specs (`apps/e2e/tests/botsson-recorder/`) — skip-gated with `SKIP_UNTIL_COMPOSED` / `SKIP_UNTIL_PROBES`

Phase 2 follow-ups (non-blocking for D1 acceptance):
1. Compose `TurnTimeline` + `AdminActionDrawer` + `RedactedPill` into `GuardianDashboard`
2. Build 3 missing endpoints: `POST /flag-session`, `POST /force-stop`, `GET /_metrics`
3. Recorder failure-injection for E2E Q8b (debug toggle + metrics exposure)
4. Then flip the 3 E2E `SKIP_UNTIL_*` flags → false

**Why:** Correctness + data-path was prioritized over UX composition in D1. All the unobservable behaviour (capture, redact, whisper injection, break-glass audit) is wired and unit-tested; the UX surface to consume it is Phase 2.

**How to apply:** When anyone asks "where does X live in recorder" or "why doesn't the drawer show up", cross-reference this split before diving in. The answer is almost always "built in Phase 1, composed in Phase 2."

## Known divergence from spec

ADR-0185 authority seed originally intended `workspace_id=NULL` for platform-scope authority rows (`recorder.pii_reveal`, `recorder.break_glass_enable`). Schema's NOT NULL constraint on `engine_authority_config.workspace_id` blocked this. Seed is per-workspace `disabled` rows instead; godmode-access routes via RLS, not NULL authority rows. Documented in ADR-0184 divergence #1 and ADR-0185.
