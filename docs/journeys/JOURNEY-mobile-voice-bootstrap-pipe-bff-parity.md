---
title: "Journey — BFF voice route returns workforce snapshot for caching"
feature: mobile-voice-bootstrap-pipe
status: verified
updated: 2026-05-20
created: 2026-05-20
module: mobile
tags: [journey, voice, bff, mobile, adr-0297]
---

# Journey — BFF voice route returns workforce snapshot for caching

## Context

BFF route `/api/emma/voice/transcript` currently forwards transcript to stage-engine and returns response text + sessionId + pipelineLatencyMs + intent. Chat route uses `apps/web/src/lib/botsson-context-snapshot.ts` to assemble snapshot but voice route does not. Mobile needs the snapshot delivered server-side (single source of truth, PII whitelist enforced) and cached client-side to avoid re-fetching every turn.

## Journey: Voice session bootstraps snapshot via BFF on first turn

**Precondition:**
- Mobile voice session connected (LiveKit room joined)
- Mobile has not yet sent `botsson-context` (cold start)

**Steps:**

1. User speaks first utterance: "Hei Botsson"
2. ASR fires → Mobile POSTs `/api/emma/voice/transcript` with `{ text, sessionId: null, channel: 'voice' }`
3. **NEW**: BFF detects `sessionId: null` (cold start) → assembles workforce snapshot via `botsson-context-snapshot.ts` (PII whitelist applied)
4. BFF forwards transcript to stage-engine with workforce facts inlined in system-prompt slice
5. Stage-engine returns response text
6. **NEW**: BFF returns response `{ text, sessionId, pipelineLatencyMs, intent, snapshot: { version, hash, payload } }`
7. **NEW**: Mobile receives snapshot → publishes on `botsson-context` data-channel topic (voice-agent receives, future turns get context locally)
8. Mobile caches snapshot in session-scope state with version
9. User speaks second utterance: "Vis vaktene"
10. Mobile POSTs `/api/emma/voice/transcript` with `{ text, sessionId, channel: 'voice', snapshot_version }`
11. **NEW**: BFF compares incoming version vs current → if match, omit snapshot from response (saves bytes); if drift, includes refreshed snapshot
12. Mobile receives response → re-publishes `botsson-context` only if version changed
13. TTS speaks → User hears coherent contextual answer

**Postcondition:**
- Snapshot lifecycle: assembled once (cold start), refreshed only on drift, never re-assembled per turn
- Voice-agent + stage-engine see identical context (single source of truth via BFF)
- PII whitelist enforced in one place

**Error paths:**

- Cold start snapshot assembly fails (DB error, missing workspace) → BFF returns response without snapshot field; mobile continues with minimal context; telemetry `voice.bootstrap.snapshot_assembly_failed`
- Mobile sends stale `snapshot_version` after server-side drift → BFF returns refreshed snapshot in response; mobile re-publishes
- BFF cannot resolve workspace_id from JWT (ADR-0151) → Returns 401; mobile ends voice session with auth-error UX
- Snapshot payload exceeds data-channel size limit (LiveKit data messages capped) → BFF returns version+hash only; mobile fetches full payload via separate GET `/api/emma/voice/snapshot/:version`

## Acceptance

- [ ] Cold-start voice turn returns response with snapshot inline (single round-trip)
- [ ] Subsequent turns with matching version omit snapshot field (response payload smaller)
- [ ] Server-side workforce update (new shift added) triggers next-turn snapshot refresh
- [ ] PII whitelist test passes: snapshot never contains bank_account, tax_id, personnummer
- [ ] Telemetry `voice.bootstrap.snapshot_sent` fires server-side at assembly; `voice.bootstrap.snapshot_applied` fires client-side at publish
- [ ] Web + mobile share `botsson-context-snapshot.ts` (no copy-paste duplication)

## References

- ADR-0297 — workforce snapshot bootstrap pipe
- ADR-0151 — derive workspace_id server-side (never from request body)
- ADR-0078 — channel-pin 'voice'; PII whitelist applies
- ADR-0134 — workspace_id + actor_id non-empty on telemetry
- `apps/web/src/lib/botsson-context-snapshot.ts` (reuse)
- `apps/web/src/app/api/emma/voice/transcript/route.ts` (extend)
