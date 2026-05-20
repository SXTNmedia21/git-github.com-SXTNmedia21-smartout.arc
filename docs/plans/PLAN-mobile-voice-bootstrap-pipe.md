---
title: "Plan — mobile-voice-bootstrap-pipe"
status: in_progress
updated: 2026-05-20
created: 2026-05-20
module: mobile
tags: [plan, voice, livekit, mobile, adr-0132, adr-0135, adr-0297]
---

# Plan — mobile-voice-bootstrap-pipe

> Branch: `feat/mobile-mobile-voice-bootstrap-pipe` | Worktree: /home/sxtnl/dev/smartout.ai-mobile-wt-5 | Base: `campaign/mobile` | Module: mobile | Started: 2026-05-20

## Goal

Close the mobile-voice parity gap with web: mobile LiveKit sessions must ship a workforce snapshot (ADR-0297) and register client tools (L-0234) so the Realtime LLM gets the same context and view-tool mirror that the web Botsson surface enjoys.

## Background

Architecture review 2026-05-20 mapped three HIGH-severity gaps in mobile voice topology:

1. Mobile **never sends** `botsson-context` on the LiveKit data channel. Voice-agent (`services/voice-agent/src/context.ts`) runs with null user/workspace context for every mobile session. Workforce snapshot (ADR-0297) reaches the web Realtime LLM but not the mobile one.
2. Mobile **does not register** `botsson-tools`. The full RPC protocol (`services/voice-agent/src/client-tool-rpc.ts`, topics `botsson-tools-register` / `botsson-tool-call` / `botsson-tool-result`) is implemented server-side but mobile-side has 5 declared tools in `apps/mobile/src/lib/botsson-tools.ts` that no listener ever consumes (L-0234 view-tools mirror absent on mobile).
3. BFF voice transcript route (`apps/web/src/app/api/emma/voice/transcript/route.ts`) does not assemble + return the workforce snapshot; chat path uses `botsson-context-snapshot.ts` but voice path does not.

Same-class as L-0233 (two LLM contexts diverge). Risk: voice-agent on mobile responds without seeing employees / shifts / absences / department session state → answers are generic, hallucinate, or punt to RPC roundtrips that timeout.

## Tasks

Three journeys, three tasks. Sequential — each unblocks the next.

- [ ] **Task 1 — Workforce snapshot reaches mobile voice-agent**
      - Assemble snapshot in BFF voice transcript route OR mobile-side at session start
      - Publish snapshot on `botsson-context` topic before mic enable
      - Verify `services/voice-agent/src/context.ts:setSessionContext` fires; `getSessionContextSnapshot()` returns non-null in `adapter.ts:ask()`
      - PII whitelist enforced per ADR-0297 (names + phone + dept OK; no bank/tax/personnummer)
- [ ] **Task 2 — Mobile registers client tools + RPC roundtrip**
      - Publish `botsson-tools-register` topic at session start with tool schemas from `apps/mobile/src/lib/botsson-tools.ts`
      - Subscribe to `botsson-tool-call` topic; dispatch via `executeMobileTool()`
      - Publish `botsson-tool-result` topic with call_id correlation
      - Verify voice-agent stub tool (`client-tool-rpc.ts:96-103`) resolves before 10s timeout
      - Smoke: voice prompt "open shift sheet" → `mobile_open_sheet` RPC succeeds
- [ ] **Task 3 — BFF route returns snapshot in response payload**
      - Extend `/api/emma/voice/transcript` to include snapshot version + hash in response
      - Mobile caches snapshot per session; re-fetches if version drifts
      - Telemetry: `voice.bootstrap.snapshot_sent`, `voice.bootstrap.tool_registered`, `voice.bootstrap.rpc_completed`
- [ ] **Task 4 — Verification + handoff**
      - PWA test on `localhost:8083` (per `feedback_mobile_pwa_for_testing.md`)
      - `pnpm turbo typecheck` green
      - Decision log entry: ADR for mobile voice bootstrap protocol (slot pending — grep before claim per `learning_adr_id_squatting.md`)
      - Write JOURNEY files + HANDOFF

## Acceptance Criteria

- [ ] Mobile voice session emits `botsson-context` data-channel message within 500ms of room connect
- [ ] Voice-agent `getSessionContextSnapshot()` returns workforce snapshot for mobile sessions (proven via docker log inspection per L-0233)
- [ ] Mobile tool RPC roundtrip succeeds end-to-end (call_id match, no timeout)
- [ ] BFF response includes snapshot version/hash for caching
- [ ] Telemetry events fire: `voice.bootstrap.snapshot_sent`, `voice.bootstrap.tool_registered`, `voice.bootstrap.rpc_completed`
- [ ] `pnpm turbo typecheck` passes with 0 errors
- [ ] Decision log + 3 journeys + handoff written

## Out of Scope

- gpt-realtime model upgrade (separate sortie — plan + 5 journeys cherry-picked into this branch for co-location)
- Voice transcript persistence to DB
- Mic permission UX redesign
- TTS language override
- Realtime LLM persona/prompt parity audit (CRITICAL gap, requires council)

## Cherry-Picked Co-Location

This branch carries `docs(voice): spec + plan + 5 journeys` for the gpt-realtime upgrade sortie (originally on `feat/voice-gpt-realtime-upgrade` worktree wt-4). Cherry-picked so the planning survives worktree recycling. Code work for gpt-realtime stays separate.

Commits:
- `dffb87213` docs(voice): spec stub for gpt-realtime upgrade sortie
- `8656738ba` docs(voice-gpt-realtime-upgrade): declare plan + 5 journeys

## References

- ADR-0132 — mobile thin client, AI routes through web BFF
- ADR-0135 — mobile voice uses LiveKit, not Ultravox
- ADR-0078 — channel pinning + voice-no-PII rule
- ADR-0297 — workforce snapshot bootstrap pipe
- L-0233 — two LLM contexts (stage-engine ≠ voice Realtime)
- L-0234 — voice view-tools mirror via activity-event
- L-0177 — fail-fast on row-not-found / null IDs

## Architecture Review Source

`feedback_voice_architecture_review_2026_05_20` — mapped 4 CRITICAL/HIGH findings; this sortie addresses the 3 HIGH (snapshot, RPC, BFF parity). CRITICAL (Realtime persona parity) deferred to council.
