---
title: "Journey — Mobile text chat wired to /api/emma/chat"
feature: mobile-voice-runtime-wire
status: draft
updated: 2026-05-20
created: 2026-05-20
module: mobile
tags: [journey, chat, mobile, bff, adr-0078, adr-0132]
---

# Journey — Mobile text chat wired to /api/emma/chat

## Context

BotssonProvider already supports `mode === 'text'`. BotssonSheet UI shows a text input field. But typed messages don't reach the BFF — text-mode codepath is stubbed. TranscriptPane renders only voice transcripts. For users who prefer typing (noisy environment, privacy, accessibility), text chat must work.

## Journey: User opens AI sheet in text mode, types question, sees response

**Precondition:**
- Employee authenticated on mobile
- User long-presses FAB OR taps "Skriv" toggle in BotssonSheet → mode = 'text'

**Steps:**

1. BotssonSheet shows text input + send button instead of mic
2. User types: "Hva er min vakt i morgen?"
3. User taps send → mobile POSTs `/api/emma/chat` with `{ text, sessionId, channel: 'chat' }`
4. **NEW (P5)**: Text-mode codepath calls existing BFF chat route (which already handles channel-pin per ADR-0078 server-side)
5. BFF assembles snapshot (or reuses cached) → forwards to stage-engine with channel='chat' pinned
6. Stage-engine returns response text
7. **NEW (P5)**: Mobile receives response → appends both user message + agent response to TranscriptPane state
8. TranscriptPane auto-scrolls to latest
9. User can continue typing OR switch to voice mode → voice session resumes with same snapshot context

**Postcondition:**
- Text chat round-trip visible
- Same TranscriptPane used for voice + text (single transcript stream)
- Telemetry: `mobile.chat.message_sent` + `mobile.chat.response_received`
- Session context shared between voice + text modes within same BotssonSheet lifetime

**Error paths:**

- Network failure → mobile shows inline error "Kunne ikke sende meldingen. Prøv igjen." with retry button
- BFF 401 (auth expired mid-session) → mobile triggers reauth flow; current text input preserved
- BFF 500 → fallback "Botsson har problemer akkurat nå. Prøv om litt." + telemetry `mobile.chat.error`
- User switches to voice mid-conversation → voice session inherits text transcript history via shared TranscriptPane state

## Acceptance

- [ ] Typed message visible in TranscriptPane within 100ms of send tap (user message)
- [ ] Agent response visible in TranscriptPane within network round-trip + LLM latency (~2-4s typical)
- [ ] Both voice + text messages render in same TranscriptPane with role discrimination
- [ ] Channel server-side pinned to 'chat' regardless of client hint
- [ ] PII whitelist enforced (chat-mode allows broader PII than voice per ADR-0078)
- [ ] Telemetry events fire with non-empty workspace_id + actor_id

## References

- ADR-0078 — channel pinning + PII boundary
- ADR-0132 — mobile thin client; AI through web BFF
- `apps/web/src/app/api/emma/chat/route.ts` (BFF endpoint)
- `apps/mobile/src/components/ai/BotssonSheet.tsx` (text input UI)
- `apps/mobile/src/providers/botsson-provider.tsx` (mode + channel derivation)
