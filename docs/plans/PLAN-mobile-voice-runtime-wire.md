---
title: "Plan — mobile-voice-runtime-wire"
status: in_progress
updated: 2026-05-20
created: 2026-05-20
module: mobile
tags: [plan, voice, livekit, mobile, runtime, adr-0132, adr-0135, adr-0297]
---

# Plan — mobile-voice-runtime-wire

> Branch: `feat/mobile-voice-runtime-wire` | Worktree: /home/sxtnl/dev/smartout.ai-mobile-wt-5 | Base: `campaign/mobile` @ `bc7c27bf6` | Module: mobile | Started: 2026-05-20

## Goal

Close the runtime gaps that remain after `mobile-voice-bootstrap-pipe` shipped its BFF + UI scaffold. End-state: mobile user logs in → long-presses FAB → speaks or types → AI agent uses **live workforce context** to answer + drives mobile UI via tool RPC + supports text conversation when voice not desired. Production parity with web Botsson voice surface.

## Background

Predecessor sortie (`mobile-voice-bootstrap-pipe`, merged into campaign/mobile as commit `c4be0101d` on 2026-05-20) shipped:

- BFF route `/api/emma/voice/transcript` extended to assemble + return `WorkforceSnapshot` inline on cold-start, drift-aware on warm turns (P1)
- GET `/api/emma/voice/snapshot/[version]` resolver route for size-guard overflow (P2.5 F1)
- Mobile UI surfaces: FAB long-press opens BotssonSheet, AI Prefs section in Chat Settings, TranscriptPane component, FabHint first-run tooltip, openWithIntent API on BotssonProvider (P2)
- `ai-prefs.ts` reduced to type re-export shim; canonical store = `use-botsson-settings-store.ts` (P2.5 F2)
- FabHint animations gated by `useReducedMotion` (P2.5 F3)

What did NOT ship:

- Mobile never publishes `botsson-context` on LiveKit data channel. Voice-agent (`services/voice-agent/src/context.ts:setSessionContext`) runs with null user/workspace context for mobile sessions. Workforce snapshot reaches voice-agent only on web.
- Mobile does not register client tools nor listen for `botsson-tool-call` events. Voice-agent (`services/voice-agent/src/client-tool-rpc.ts`) RPC protocol implemented but mobile dead-wired. L-0234 view-tools mirror absent on mobile.
- Mobile text chat (typed conversation via `/api/emma/chat`) not wired to TranscriptPane.

This sortie closes those three runtime gaps + final UX polish.

## Tasks

Sequential — each gate unblocks the next.

- [ ] **P3 — Mobile publishes botsson-context on data channel**
      - Parse `snapshot` field from BFF `/api/emma/voice/transcript` response (cold-start + drift cases)
      - Lift snapshot to BotssonProvider context state
      - On `RoomEvent.Connected` (or first turn after room ready), publish snapshot payload on data-channel topic `botsson-context`
      - Voice-agent `setSessionContext()` fires; `getSessionContextSnapshot()` returns non-null
      - Telemetry: `voice.bootstrap.snapshot_published` (mobile-side emit when data channel ack)

- [ ] **P3-verify — Voice-agent context proof artefact**
      - Falsifiable proof: docker log inspection OR unit test in voice-agent OR mock-LiveKit test in mobile asserting publish + payload shape
      - L-0233 enforcement — no "I assume it works"; explicit artefact required before P4

- [ ] **P4 — Mobile registers + serves botsson-tool-call RPC**
      - Publish `botsson-tools-register` topic at session start with 5 tool schemas (mobile_navigate_to, mobile_open_sheet, mobile_show_toast, mobile_start_punch, mobile_call_leader)
      - Subscribe to `botsson-tool-call` topic; dispatch via `executeMobileTool()`
      - Publish `botsson-tool-result` with call_id correlation; voice-agent Promise resolves before 10s timeout
      - Smoke: voice prompt "åpne vaktlisten" → mobile navigates to /schedule within 2s
      - Feature flag `HARNESS_ADAPTER_VOICE_ENABLED` state verified or flipped per P0 audit
      - Telemetry: `voice.bootstrap.tool_registered`, `voice.bootstrap.rpc_completed` with latency_ms

- [ ] **P5 — Mobile text chat wired to /api/emma/chat**
      - When `mode === 'text'`, BotssonProvider posts to `/api/emma/chat` instead of `/api/emma/voice/transcript`
      - Response renders in TranscriptPane (same pane reused for voice + text — single transcript stream)
      - Channel pin = 'chat' server-side (BFF re-pins regardless of client hint per ADR-0078)
      - Telemetry: `mobile.chat.message_sent`, `mobile.chat.response_received`

- [ ] **P6 — UX polish**
      - Orb state machine refinement: visual states match `voiceStatus` granularly (idle, connecting, listening, thinking, speaking, error). All animations `useReducedMotion`-gated
      - TranscriptPane auto-scroll edge cases (long messages, slow speakers)
      - Error UX: mic-permission-denied dialog, network-failure fallback to text mode, voice-policy-flip mid-session friendly message
      - Settings finalisation: AI prefs section persists + reads via single canonical store; remove `use-botsson-settings-store.ts` vs `ai-prefs.ts` duplicate path remnants if any survive P2.5
      - Onboarding hint visible on first long-press attempt (FabHint already exists; verify trigger logic correct)

- [ ] **P7 — System-steward gate**
      - Full plan vs reality check
      - ADR slot grep + draft for any new architectural decision (e.g. amendment to ADR-0151 for H2 deviation)
      - Decision log entry registered
      - Telemetry registry parity audit (L-0298)

- [ ] **P8 — Verification + walkthrough**
      - `pnpm turbo typecheck` 0 errors across `@smartout/{ai,mobile,telemetry,web}`
      - PWA smoke on `localhost:8083`: login → long-press FAB → speak "hvem jobber kveldsvakt på torsdag" → receive contextual answer → say "åpne vaktlisten" → mobile navigates → switch to text mode → type message → response renders
      - All telemetry events verified emitting in PostHog dev project (or activity_trail if PostHog unreachable)

- [ ] **P9 — Handoff + close-feature signal**
      - HANDOFF doc written (decisions, learnings, debt, next steps)
      - ADR drafted if needed
      - All 4 journey docs marked `status: verified` with proof refs
      - Signal Pontus: ready for close-feature.sh

## Acceptance Criteria

- [ ] Voice-agent `getSessionContextSnapshot()` returns non-null workforce snapshot for mobile sessions (P3 proof artefact)
- [ ] Voice command "åpne vaktlisten" → mobile navigates to `/schedule` within 2s (P4 smoke)
- [ ] Text message round-trip visible in TranscriptPane (P5 PWA test)
- [ ] All telemetry events fire with non-empty workspace_id + actor_id per ADR-0134 (L-0177 enforced)
- [ ] PWA walkthrough Pontus-grade — full flow without errors
- [ ] `pnpm turbo typecheck` 0 errors (workaround for WSL2 OOM: per-package `tsc --noEmit --skipLibCheck`)
- [ ] Decision log updated + handoff written

## Out of Scope (explicit)

- gpt-realtime model upgrade (separate sortie wt-4 territory; carry-on plan + 5 journeys live on campaign/mobile)
- Realtime LLM persona parity audit (CRITICAL parked from P0 audit; requires council before code)
- Voice transcript persistence to DB (low priority; punt)
- Mic permission UX redesign beyond denial dialog (P6 polish boundary)
- Mobile authoring verbs (forbidden by ADR-0133)
- New AI capability tools beyond existing 5 (P4 wires existing, doesn't invent)

## References

- ADR-0078 — channel pinning + voice-no-PII rule
- ADR-0132 — mobile thin client; AI through web BFF
- ADR-0133 — mobile-execute boundary
- ADR-0134 — telemetry IDs non-empty + fail-fast
- ADR-0135 — mobile voice = LiveKit (not Ultravox)
- ADR-0151 — workspace_id derived server-side
- ADR-0240 — capability boundary (no cross-namespace writes)
- ADR-0297 — workforce snapshot bootstrap pipe
- ADR-0366 — OKLCH literal ban
- L-0083 — telemetry registry concurrent additions (pair-per-line union)
- L-0176 — docstring drift (write after body satisfies ADR)
- L-0177 — fail-fast on null IDs / row-not-found
- L-0233 — two LLM contexts (voice-agent context proof required)
- L-0234 — voice view-tools mirror via activity-event
- L-0298 — telemetry registry entry requires emit() call-site in same commit

## Predecessor Handoff Reference

Predecessor sortie `mobile-voice-bootstrap-pipe`:
- 3 journeys (workforce-snapshot, tool-rpc, bff-parity) shipped with `status: verified` frontmatter
- Merge commit: `c4be0101d feat(merge): feat/mobile-mobile-voice-bootstrap-pipe into campaign/mobile`
- P2.5 fixes landed direct on campaign/mobile (commits `0bac5e690`, `8419045e3`, `bc7c27bf6`) — orchestrator discipline note: agent committed direct to campaign branch instead of stopping when wt-5 was deleted; logged as L-NEW for future dispatch protocol
